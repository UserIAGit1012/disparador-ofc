import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { chatwootPost, chatwootGet } from '@/lib/chatwoot';
import { getMessageCostUsd } from '@/lib/costs';

function getSupabaseServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey || anonKey);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

const MAX_EXECUTION_MS = 8000; // 8s safety margin for Vercel (fallback only — browser drives sends now)
const MAX_CONSECUTIVE_ERRORS = 5; // Circuit breaker: stop after 5 errors in a row

function resolveVar(
  variablesConfig: Record<string, any>,
  key: string,
  contact: { name?: string; phone?: string }
): string {
  const config = variablesConfig[key];
  if (!config) return '';
  switch (config.type) {
    case 'contact_name':
      return contact.name || '';
    case 'contact_phone':
      return contact.phone || '';
    case 'fixed':
    default:
      return config.value || '';
  }
}

function buildProcessedParamsForContact(
  templateConfig: any,
  contact: { name?: string; phone?: string }
): Record<string, any> {
  const variablesConfig = templateConfig.variablesConfig || {};
  const bodyParams: Record<string, string> = {};

  for (const [key] of Object.entries(variablesConfig)) {
    if (key === 'header_media_url') continue;
    bodyParams[key] = resolveVar(variablesConfig, key, contact);
  }

  const processedParams: Record<string, any> = { body: bodyParams };

  const headerMediaUrl = variablesConfig['header_media_url']?.value;
  if (headerMediaUrl) {
    const baseParams = templateConfig.processedParams || {};
    if (baseParams.header) {
      processedParams.header = baseParams.header;
    } else {
      processedParams.header = { media_url: headerMediaUrl };
    }
  }

  return processedParams;
}

function buildMessageContent(
  templateConfig: any,
  contact: { name?: string; phone?: string }
): string {
  const components = templateConfig.components || [];
  const variablesConfig = templateConfig.variablesConfig || {};
  const parts: string[] = [];

  for (const comp of components) {
    if (comp.type === 'HEADER' && comp.text) {
      let text = comp.text;
      text = text.replace(/\{\{(\d+)\}\}/g, (_: string, num: string) =>
        resolveVar(variablesConfig, num, contact) || `{{${num}}}`
      );
      parts.push(`*${text}*`);
    }
    if (comp.type === 'BODY' && comp.text) {
      let text = comp.text;
      text = text.replace(/\{\{(\d+)\}\}/g, (_: string, num: string) =>
        resolveVar(variablesConfig, num, contact) || `{{${num}}}`
      );
      parts.push(text);
    }
    if (comp.type === 'FOOTER' && comp.text) {
      parts.push(`_${comp.text}_`);
    }
  }

  return parts.join('\n\n') || '';
}

// Check if dispatch was paused or cancelled (reads fresh status from DB)
async function isDispatchStopped(sb: SupabaseClient, dispatchId: string): Promise<boolean> {
  const { data } = await sb
    .from('dispatches')
    .select('status')
    .eq('id', dispatchId)
    .single();
  return data?.status === 'paused' || data?.status === 'cancelled';
}

async function processDispatch(
  sb: SupabaseClient,
  dispatch: any,
  startTime: number
): Promise<number> {
  const { data: pendingMessages } = await sb
    .from('dispatch_messages')
    .select('*')
    .eq('dispatch_id', dispatch.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);

  if (!pendingMessages || pendingMessages.length === 0) {
    // Also check if there are any "sending" messages still in flight
    const { count: sendingCount } = await sb
      .from('dispatch_messages')
      .select('*', { count: 'exact', head: true })
      .eq('dispatch_id', dispatch.id)
      .eq('status', 'sending');

    if (!sendingCount || sendingCount === 0) {
      await finalizeDispatch(sb, dispatch.id);
    }
    return 0;
  }

  const templateConfig = dispatch.template_config || {};
  const delayMin = dispatch.delay_min || 5;
  const delayMax = dispatch.delay_max || 15;
  let sentCount = dispatch.sent_count || 0;
  let errorCount = dispatch.error_count || 0;
  let processed = 0;
  let consecutiveErrors = 0;

  // Check if already stopped before processing any message
  const alreadyStopped = await isDispatchStopped(sb, dispatch.id);
  if (alreadyStopped) return 0;

  for (const msg of pendingMessages) {
    // Check time budget
    if (Date.now() - startTime > MAX_EXECUTION_MS) break;

    // Circuit breaker: too many consecutive errors
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      await sb.from('dispatches').update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      }).eq('id', dispatch.id);
      break;
    }

    // Check if user paused/cancelled EVERY message for instant cancel
    if (processed > 0) {
      const stopped = await isDispatchStopped(sb, dispatch.id);
      if (stopped) break;
    }

    // Atomically claim this message (prevents duplicate sending if two executions run concurrently)
    const { data: claimed } = await sb.from('dispatch_messages')
      .update({ status: 'sending' })
      .eq('id', msg.id)
      .eq('status', 'pending')
      .select('id');

    if (!claimed || claimed.length === 0) {
      // Already claimed by another execution or cancelled — skip
      continue;
    }

    const contact = {
      name: msg.contact_name || undefined,
      phone: msg.contact_phone || undefined,
    };
    const processedParams = buildProcessedParamsForContact(templateConfig, contact);
    const messageContent = buildMessageContent(templateConfig, contact);

    try {
      await chatwootPost(
        `/api/v1/accounts/${dispatch.account_id}/conversations/${msg.conversation_id}/messages`,
        {
          content: messageContent,
          message_type: 'outgoing',
          template_params: {
            name: msg.template_name,
            language: templateConfig.language || 'pt_BR',
            category: msg.template_category || 'MARKETING',
            processed_params: processedParams,
          },
        }
      );

      // Post-send actions (non-blocking)
      if (dispatch.open_conversation) {
        try {
          await chatwootPost(
            `/api/v1/accounts/${dispatch.account_id}/conversations/${msg.conversation_id}/toggle_status`,
            { status: 'open' }
          );
        } catch { /* must not block dispatch flow */ }
      }
      if (dispatch.assign_agent_id) {
        try {
          await chatwootPost(
            `/api/v1/accounts/${dispatch.account_id}/conversations/${msg.conversation_id}/assignments`,
            { assignee_id: dispatch.assign_agent_id }
          );
        } catch { /* must not block dispatch flow */ }
      }
      if (dispatch.post_send_labels && dispatch.post_send_labels.length > 0) {
        try {
          const convData = await chatwootGet(
            `/api/v1/accounts/${dispatch.account_id}/conversations/${msg.conversation_id}`
          );
          const currentLabels: string[] = convData?.labels || [];
          const merged = Array.from(new Set([...currentLabels, ...dispatch.post_send_labels]));
          await chatwootPost(
            `/api/v1/accounts/${dispatch.account_id}/conversations/${msg.conversation_id}/labels`,
            { labels: merged }
          );
        } catch { /* must not block dispatch flow */ }
      }

      // Critical: update status to "sent" first (must succeed)
      const { error: sentErr } = await sb.from('dispatch_messages').update({
        status: 'sent',
      }).eq('id', msg.id);

      if (sentErr) {
        console.error(`Failed to mark message ${msg.id} as sent:`, sentErr.message);
      }

      // Nice-to-have: add extra fields (may fail if columns don't exist)
      const cost = getMessageCostUsd(msg.template_category || 'MARKETING');
      try {
        await sb.from('dispatch_messages').update({
          sent_at: new Date().toISOString(),
          cost_usd: cost,
        }).eq('id', msg.id);
      } catch { /* columns may not exist */ }

      sentCount++;
      processed++;
      consecutiveErrors = 0;
    } catch (err: any) {
      // Critical: update status to "error" first
      const { error: errUpdate } = await sb.from('dispatch_messages').update({
        status: 'error',
      }).eq('id', msg.id);

      if (errUpdate) {
        console.error(`Failed to mark message ${msg.id} as error:`, errUpdate.message);
      }

      // Nice-to-have: add error message
      try {
        await sb.from('dispatch_messages').update({
          error_message: err.message?.substring(0, 500) || 'Unknown error',
        }).eq('id', msg.id);
      } catch { /* column may not exist */ }

      errorCount++;
      consecutiveErrors++;
    }

    // Update dispatch counts
    await sb.from('dispatches').update({
      sent_count: sentCount,
      error_count: errorCount,
      updated_at: new Date().toISOString(),
    }).eq('id', dispatch.id);

    // Delay between messages (skip if running out of time)
    const delay = randomDelay(delayMin, delayMax);
    if (Date.now() - startTime + delay < MAX_EXECUTION_MS) {
      await sleep(delay);
    } else {
      break;
    }
  }

  // Check if all messages are done (no pending and no sending)
  const { count: remainingCount } = await sb
    .from('dispatch_messages')
    .select('*', { count: 'exact', head: true })
    .eq('dispatch_id', dispatch.id)
    .in('status', ['pending', 'sending']);

  if (remainingCount === 0) {
    await finalizeDispatch(sb, dispatch.id);
  }

  return processed;
}

export async function executeDispatchById(dispatchId: string) {
  const sb = getSupabaseServer();
  const startTime = Date.now();

  const { data: dispatch, error } = await sb
    .from('dispatches')
    .select('*')
    .eq('id', dispatchId)
    .single();

  if (error || !dispatch) {
    throw new Error(`Dispatch not found: ${dispatchId}`);
  }

  if (!['pending', 'running', 'scheduled'].includes(dispatch.status)) {
    return { processed: 0, message: `Dispatch status is ${dispatch.status}, skipping` };
  }

  // Mark as running — only if status is still in an allowed state (prevents race with cancel/pause)
  const { data: updated } = await sb.from('dispatches').update({
    status: 'running',
    updated_at: new Date().toISOString(),
  }).eq('id', dispatchId).in('status', ['pending', 'running', 'scheduled']).select('id');

  if (!updated || updated.length === 0) {
    // Status was changed (e.g. cancelled/paused) between our read and update
    return { processed: 0, message: `Dispatch ${dispatchId} status changed, skipping` };
  }

  const processed = await processDispatch(sb, dispatch, startTime);

  return { processed, message: `Processed ${processed} messages for dispatch ${dispatchId}` };
}

export async function executeScheduledDispatches() {
  const sb = getSupabaseServer();
  const now = new Date().toISOString();

  const { data: scheduledDispatches } = await sb
    .from('dispatches')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(5);

  const { data: runningDispatches } = await sb
    .from('dispatches')
    .select('*')
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: true })
    .limit(5);

  const dispatches = [...(scheduledDispatches || []), ...(runningDispatches || [])];
  const seen = new Set<string>();
  const uniqueDispatches = dispatches.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });

  if (uniqueDispatches.length === 0) {
    return { processed: 0, message: 'No dispatches to process' };
  }

  const startTime = Date.now();
  let totalProcessed = 0;

  for (const dispatch of uniqueDispatches) {
    if (Date.now() - startTime > MAX_EXECUTION_MS) break;

    await sb.from('dispatches').update({
      status: 'running',
      updated_at: new Date().toISOString(),
    }).eq('id', dispatch.id);

    const processed = await processDispatch(sb, dispatch, startTime);
    totalProcessed += processed;
  }

  return { processed: totalProcessed, message: `Processed ${totalProcessed} messages` };
}

async function finalizeDispatch(sb: SupabaseClient, dispatchId: string) {
  const { data: sentMsgs } = await sb
    .from('dispatch_messages')
    .select('status, cost_usd')
    .eq('dispatch_id', dispatchId);

  const sentCount = (sentMsgs || []).filter((m: any) => m.status === 'sent').length;
  const errorCount = (sentMsgs || []).filter((m: any) => m.status === 'error').length;
  const totalCost = (sentMsgs || [])
    .filter((m: any) => m.status === 'sent')
    .reduce((sum: number, m: any) => sum + (parseFloat(m.cost_usd) || 0), 0);

  await sb.from('dispatches').update({
    status: 'completed',
    sent_count: sentCount,
    error_count: errorCount,
    estimated_cost_usd: totalCost,
    updated_at: new Date().toISOString(),
  }).eq('id', dispatchId);
}
