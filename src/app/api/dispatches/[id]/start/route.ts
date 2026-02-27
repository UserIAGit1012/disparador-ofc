import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeDispatchById } from '@/lib/dispatch-executor';

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey || anonKey);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dispatchId = params.id;

    const result = await executeDispatchById(dispatchId);

    // Check if there are still pending messages to process
    const sb = getSupabaseServer();
    const { count: pendingCount } = await sb
      .from('dispatch_messages')
      .select('*', { count: 'exact', head: true })
      .eq('dispatch_id', dispatchId)
      .in('status', ['pending']);

    const hasMore = (pendingCount || 0) > 0;

    // Also check dispatch wasn't paused/cancelled
    const { data: dispatch } = await sb
      .from('dispatches')
      .select('status')
      .eq('id', dispatchId)
      .single();

    const canContinue = dispatch?.status === 'running' && hasMore;

    if (canContinue) {
      // Self-chain: trigger next batch server-side (no browser dependency)
      const host = req.headers.get('host') || process.env.VERCEL_URL || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const nextBatchUrl = `${protocol}://${host}/api/dispatches/${dispatchId}/start`;

      // Fire the request and wait just long enough for it to be received
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      try {
        await fetch(nextBatchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
      } catch {
        // Expected: abort after 2s. The request was already sent to Vercel.
      } finally {
        clearTimeout(timer);
      }
    }

    return NextResponse.json({
      success: true,
      hasMore: canContinue,
      pendingCount: pendingCount || 0,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
