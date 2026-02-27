import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { chatwootPost } from '@/lib/chatwoot';
import { getMessageCostUsd } from '@/lib/costs';

function getSupabaseServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

const MAX_EXECUTION_MS = 55000; // ~55s safety margin for Vercel timeout

// Resolve a template variable for a specific contact
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

// Build per-contact processed params from template_config and contact data
function buildProcessedParamsForContact(
  templateConfig: any,
  contact: { name?: string; phone?: string }
): Record<string, any> {
  const variablesConfig = templateConfig.variablesConfig || {};
  const bodyParams: Record<string, string> = {};

  for (const [key, config] of Object.entries(variablesConfig)) {
    if (key === 'header_media_url') continue;
    bodyParams[key] = resolveVar(variablesConfig, key, contact);
  }

  const processedParams: Record<string, any> = { body: bodyParams };

  // Handle header media
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

// Build the resolved message text for display in Chatwoot
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

// Process a single dispatch - shared between cron and direct execution
async function processDispatch(
  sb: SupabaseClient,
  dispatch: any,
  startTime: number
): Promise<number> {
  // Get pending messages for this dispatch
  const { data: pendingMessages } = await sb
    .from('dispatch_messages')
    .select('*')
    .eq('dispatch_id', dispatch.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);

  if (!pendingMessages || pendingMessages.length === 0) {
    await finalizeDispatch(sb, dispatch.id);
    return 0;
  }

  const templateConfig = dispatch.template_config || {};
  const delayMin = dispatch.delay_min || 5;
  const delayMax = dispatch.delay_max || 15;
  let sentCount = dispatch.sent_count || 0;
  let errorCount = dispatch.error_count || 0;
  let processed = 0;

  for (const msg of pendingMessages) {
    // Check time budget
    if (Date.now() - startTime > MAX_EXECUTION_MS) break;

    // Build per-contact processed params
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

      const cost = getMessageCostUsd(msg.template_category || 'MARKETING');
      await sb.from('dispatch_messages').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        cost_usd: cost,
      }).eq('id', msg.id);

      sentCount++;
      processed++;
    } catch (err: any) {
      await sb.from('dispatch_messages').update({
        status: 'error',
        error_message: err.message,
      }).eq('id', msg.id);
      errorCount++;
    }

    // Update dispatch counts
    await sb.from('dispatches').update({
      sent_count: sentCount,
      error_count: errorCount,
      updated_at: new Date().toISOString(),
    }).eq('id', dispatch.id);

    // Delay between messages
    const delay = randomDelay(delayMin, delayMax);
    if (Date.now() - startTime + delay < MAX_EXECUTION_MS) {
      await sleep(delay);
    } else {
      break;
    }
  }

  // Check if all messages are done
  const { count } = await sb
    .from('dispatch_messages')
    .select('*', { count: 'exact', head: true })
    .eq('dispatch_id', dispatch.id)
    .eq('status', 'pending');

  if (count === 0) {
    await finalizeDispatch(sb, dispatch.id);
  }

  return processed;
}

// Execute a specific dispatch by ID (called from /api/dispatches/[id]/start)
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

  // Only process pending, running or scheduled dispatches
  if (!['pending', 'running', 'scheduled'].includes(dispatch.status)) {
    return { processed: 0, message: `Dispatch status is ${dispatch.status}, skipping` };
  }

  // Mark as running
  await sb.from('dispatches').update({
    status: 'running',
    updated_at: new Date().toISOString(),
  }).eq('id', dispatchId);

  const processed = await processDispatch(sb, dispatch, startTime);

  return { processed, message: `Processed ${processed} messages for dispatch ${dispatchId}` };
}

// Execute scheduled dispatches (called from cron)
export async function executeScheduledDispatches() {
  const sb = getSupabaseServer();
  const now = new Date().toISOString();

  // Find scheduled dispatches that are due + pending/running with remaining messages
  const { data: scheduledDispatches } = await sb
    .from('dispatches')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(5);

  const { data: pendingDispatches } = await sb
    .from('dispatches')
    .select('*')
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: true })
    .limit(5);

  const dispatches = [...(scheduledDispatches || []), ...(pendingDispatches || [])];

  // Deduplicate by id
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

    // Mark as running
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
