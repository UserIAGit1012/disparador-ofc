import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dispatchId = params.id;
    const sb = getSupabaseServer();

    // Get the original dispatch
    const { data: dispatch, error: dispatchErr } = await sb
      .from('dispatches')
      .select('*')
      .eq('id', dispatchId)
      .single();

    if (dispatchErr || !dispatch) {
      return NextResponse.json(
        { error: 'Dispatch not found' },
        { status: 404 }
      );
    }

    // Get failed messages
    const { data: failedMessages, error: msgErr } = await sb
      .from('dispatch_messages')
      .select('*')
      .eq('dispatch_id', dispatchId)
      .eq('status', 'error');

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    if (!failedMessages || failedMessages.length === 0) {
      return NextResponse.json(
        { error: 'No failed messages to retry' },
        { status: 400 }
      );
    }

    // Create a new dispatch for retries
    const { data: newDispatch, error: createErr } = await sb
      .from('dispatches')
      .insert({
        account_id: dispatch.account_id,
        inbox_id: dispatch.inbox_id,
        template_name: dispatch.template_name,
        template_category: dispatch.template_category,
        total_conversations: failedMessages.length,
        status: 'pending',
        delay_min: dispatch.delay_min,
        delay_max: dispatch.delay_max,
        template_config: dispatch.template_config,
        conversation_data: failedMessages.map((m: any) => ({
          conversation_id: m.conversation_id,
          contact_name: m.contact_name,
          contact_phone: m.contact_phone,
        })),
      })
      .select()
      .single();

    if (createErr || !newDispatch) {
      return NextResponse.json({ error: createErr?.message || 'Failed to create retry dispatch' }, { status: 500 });
    }

    // Pre-insert dispatch_messages for the retry
    const retryMessages = failedMessages.map((m: any) => ({
      dispatch_id: newDispatch.id,
      conversation_id: m.conversation_id,
      contact_name: m.contact_name,
      contact_phone: m.contact_phone,
      template_name: dispatch.template_name,
      template_category: dispatch.template_category,
      status: 'pending',
    }));

    await sb.from('dispatch_messages').insert(retryMessages);

    return NextResponse.json({
      success: true,
      dispatch_id: newDispatch.id,
      retry_count: failedMessages.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
