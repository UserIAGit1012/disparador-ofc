import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey || anonKey);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dispatchId = params.id;
    const sb = getSupabaseServer();

    // Get dispatch record
    const { data: dispatch, error: dispatchErr } = await sb
      .from('dispatches')
      .select('*')
      .eq('id', dispatchId)
      .single();

    if (dispatchErr || !dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 });
    }

    // Get message counts by status
    const { data: messages } = await sb
      .from('dispatch_messages')
      .select('status')
      .eq('dispatch_id', dispatchId);

    const counts = {
      pending: 0,
      sent: 0,
      error: 0,
    };

    for (const msg of messages || []) {
      if (msg.status in counts) {
        counts[msg.status as keyof typeof counts]++;
      }
    }

    return NextResponse.json({
      id: dispatch.id,
      status: dispatch.status,
      total_conversations: dispatch.total_conversations,
      sent_count: counts.sent,
      error_count: counts.error,
      pending_count: counts.pending,
      estimated_cost_usd: dispatch.estimated_cost_usd,
      template_name: dispatch.template_name,
      created_at: dispatch.created_at,
      updated_at: dispatch.updated_at,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
