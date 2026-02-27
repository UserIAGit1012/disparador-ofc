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
    const { action } = await req.json(); // "pause" or "cancel"
    const sb = getSupabaseServer();

    const { data: dispatch } = await sb
      .from('dispatches')
      .select('status')
      .eq('id', dispatchId)
      .single();

    if (!dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 });
    }

    if (action === 'pause') {
      // Pause: set status to "paused" so executor skips it
      await sb.from('dispatches').update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      }).eq('id', dispatchId);

      return NextResponse.json({ success: true, status: 'paused' });
    }

    if (action === 'cancel') {
      // Cancel: set dispatch to cancelled and all pending messages to cancelled
      await sb.from('dispatches').update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      }).eq('id', dispatchId);

      await sb.from('dispatch_messages').update({
        status: 'cancelled',
        error_message: 'Cancelado pelo usuario',
      }).eq('dispatch_id', dispatchId).eq('status', 'pending');

      // Get final counts
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
        sent_count: sentCount,
        error_count: errorCount,
        estimated_cost_usd: totalCost,
      }).eq('id', dispatchId);

      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    if (action === 'resume') {
      // Resume a paused dispatch
      await sb.from('dispatches').update({
        status: 'running',
        updated_at: new Date().toISOString(),
      }).eq('id', dispatchId);

      return NextResponse.json({ success: true, status: 'running' });
    }

    return NextResponse.json({ error: 'Invalid action. Use: pause, cancel, resume' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
