import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { chatwootPost, chatwootGet } from '@/lib/chatwoot';
import { getMessageCostUsd } from '@/lib/costs';

function getSupabaseServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey || anonKey);
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dispatchId = params.id;
    const sb = getSupabaseServer();

    // 1. Fetch dispatch
    const { data: dispatch, error: dispatchErr } = await sb
      .from('dispatches')
      .select('*')
      .eq('id', dispatchId)
      .single();

    if (dispatchErr || !dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 });
    }

    // 2. Check status — only proceed if in a startable state
    if (!['pending', 'scheduled', 'running'].includes(dispatch.status)) {
      return NextResponse.json({
        done: true,
        reason: dispatch.status === 'completed' ? 'completed' : 'stopped',
        remaining: 0,
        sent_count: dispatch.sent_count || 0,
        error_count: dispatch.error_count || 0,
        total: dispatch.total_conversations || 0,
        delay_min: dispatch.delay_min || 5,
        delay_max: dispatch.delay_max || 15,
      });
    }

    // Atomically transition to running if pending/scheduled
    if (dispatch.status !== 'running') {
      const { data: updated } = await sb.from('dispatches')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', dispatchId)
        .in('status', ['pending', 'scheduled'])
        .select('id');

      if (!updated || updated.length === 0) {
        // Status changed between read and update (cancelled/paused) — re-check
        const { data: fresh } = await sb.from('dispatches').select('status').eq('id', dispatchId).single();
        if (fresh?.status !== 'running') {
          return NextResponse.json({
            done: true,
            reason: 'stopped',
            remaining: 0,
            sent_count: dispatch.sent_count || 0,
            error_count: dispatch.error_count || 0,
            total: dispatch.total_conversations || 0,
            delay_min: dispatch.delay_min || 5,
            delay_max: dispatch.delay_max || 15,
          });
        }
      }
    }

    // 3. Atomically claim 1 pending message → sending
    const { data: pendingMsgs } = await sb
      .from('dispatch_messages')
      .select('id')
      .eq('dispatch_id', dispatchId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (!pendingMsgs || pendingMsgs.length === 0) {
      // No pending messages — check if there are still "sending" in flight
      const { count: sendingCount } = await sb
        .from('dispatch_messages')
        .select('*', { count: 'exact', head: true })
        .eq('dispatch_id', dispatchId)
        .eq('status', 'sending');

      if (!sendingCount || sendingCount === 0) {
        // All done — finalize
        await finalizeDispatch(sb, dispatchId);
        return NextResponse.json({
          done: true,
          reason: 'completed',
          remaining: 0,
          sent_count: dispatch.sent_count || 0,
          error_count: dispatch.error_count || 0,
          total: dispatch.total_conversations || 0,
          delay_min: dispatch.delay_min || 5,
          delay_max: dispatch.delay_max || 15,
        });
      }

      // Still have "sending" messages in flight — wait
      return NextResponse.json({
        done: false,
        waiting: true,
        remaining: sendingCount,
        sent_count: dispatch.sent_count || 0,
        error_count: dispatch.error_count || 0,
        total: dispatch.total_conversations || 0,
        delay_min: dispatch.delay_min || 5,
        delay_max: dispatch.delay_max || 15,
      });
    }

    // Atomic claim: update only if still pending
    const { data: claimed } = await sb
      .from('dispatch_messages')
      .update({ status: 'sending' })
      .eq('id', pendingMsgs[0].id)
      .eq('status', 'pending')
      .select('*');

    if (!claimed || claimed.length === 0) {
      // Race: already claimed by another execution — report remaining
      const { count: remainCount } = await sb
        .from('dispatch_messages')
        .select('*', { count: 'exact', head: true })
        .eq('dispatch_id', dispatchId)
        .eq('status', 'pending');

      return NextResponse.json({
        done: (remainCount || 0) === 0,
        reason: (remainCount || 0) === 0 ? 'completed' : undefined,
        sent: false,
        remaining: remainCount || 0,
        sent_count: dispatch.sent_count || 0,
        error_count: dispatch.error_count || 0,
        total: dispatch.total_conversations || 0,
        delay_min: dispatch.delay_min || 5,
        delay_max: dispatch.delay_max || 15,
      });
    }

    const msg = claimed[0];
    const templateConfig = dispatch.template_config || {};
    let sentCount = dispatch.sent_count || 0;
    let errorCount = dispatch.error_count || 0;
    let sentOk = false;
    let hadError = false;

    const contact = {
      name: msg.contact_name || undefined,
      phone: msg.contact_phone || undefined,
    };
    const processedParams = buildProcessedParamsForContact(templateConfig, contact);
    const messageContent = buildMessageContent(templateConfig, contact);

    // 5. Send via Chatwoot API
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

      // 6. Post-send actions (non-blocking)
      if (dispatch.open_conversation) {
        try {
          await chatwootPost(
            `/api/v1/accounts/${dispatch.account_id}/conversations/${msg.conversation_id}/toggle_status`,
            { status: 'open' }
          );
        } catch { /* must not block */ }
      }
      if (dispatch.assign_agent_id) {
        try {
          await chatwootPost(
            `/api/v1/accounts/${dispatch.account_id}/conversations/${msg.conversation_id}/assignments`,
            { assignee_id: dispatch.assign_agent_id }
          );
        } catch { /* must not block */ }
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

      // 7. Mark as sent
      await sb.from('dispatch_messages').update({ status: 'sent' }).eq('id', msg.id);

      const cost = getMessageCostUsd(msg.template_category || 'MARKETING');
      try {
        await sb.from('dispatch_messages').update({
          sent_at: new Date().toISOString(),
          cost_usd: cost,
        }).eq('id', msg.id);
      } catch { /* columns may not exist */ }

      sentCount++;
      sentOk = true;
    } catch (err: any) {
      // Mark as error
      await sb.from('dispatch_messages').update({ status: 'error' }).eq('id', msg.id);
      try {
        await sb.from('dispatch_messages').update({
          error_message: err.message?.substring(0, 500) || 'Unknown error',
        }).eq('id', msg.id);
      } catch { /* column may not exist */ }

      errorCount++;
      hadError = true;
    }

    // 8. Update dispatch counts
    await sb.from('dispatches').update({
      sent_count: sentCount,
      error_count: errorCount,
      updated_at: new Date().toISOString(),
    }).eq('id', dispatchId);

    // Count remaining
    const { count: remaining } = await sb
      .from('dispatch_messages')
      .select('*', { count: 'exact', head: true })
      .eq('dispatch_id', dispatchId)
      .eq('status', 'pending');

    const allDone = (remaining || 0) === 0;
    if (allDone) {
      // Check no "sending" either
      const { count: sendingLeft } = await sb
        .from('dispatch_messages')
        .select('*', { count: 'exact', head: true })
        .eq('dispatch_id', dispatchId)
        .eq('status', 'sending');

      if (!sendingLeft || sendingLeft === 0) {
        await finalizeDispatch(sb, dispatchId);
      }
    }

    return NextResponse.json({
      done: allDone,
      reason: allDone ? 'completed' : undefined,
      sent: sentOk,
      error: hadError,
      remaining: remaining || 0,
      sent_count: sentCount,
      error_count: errorCount,
      total: dispatch.total_conversations || 0,
      delay_min: dispatch.delay_min || 5,
      delay_max: dispatch.delay_max || 15,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function finalizeDispatch(sb: SupabaseClient, dispatchId: string) {
  const { data: msgs } = await sb
    .from('dispatch_messages')
    .select('status, cost_usd')
    .eq('dispatch_id', dispatchId);

  const sentCount = (msgs || []).filter((m: any) => m.status === 'sent').length;
  const errorCount = (msgs || []).filter((m: any) => m.status === 'error').length;
  const totalCost = (msgs || [])
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
