import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey || anonKey);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dispatchId = params.id;
    const sb = getSupabaseServer();

    // Verify dispatch exists
    const { data: dispatch } = await sb
      .from('dispatches')
      .select('id, status')
      .eq('id', dispatchId)
      .single();

    if (!dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 });
    }

    // Delete messages first (cascade should handle this, but be explicit)
    await sb
      .from('dispatch_messages')
      .delete()
      .eq('dispatch_id', dispatchId);

    // Delete the dispatch
    const { error } = await sb
      .from('dispatches')
      .delete()
      .eq('id', dispatchId);

    if (error) {
      return NextResponse.json({ error: `Failed to delete: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: dispatchId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
