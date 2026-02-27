import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { conversation_ids, template_name, days } = await req.json();

    if (!conversation_ids?.length || !template_name || !days) {
      return NextResponse.json(
        { error: 'Missing required fields: conversation_ids, template_name, days' },
        { status: 400 }
      );
    }

    const sb = getSupabaseServer();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data, error } = await sb
      .from('dispatch_messages')
      .select('conversation_id')
      .in('conversation_id', conversation_ids)
      .eq('template_name', template_name)
      .eq('status', 'sent')
      .gte('sent_at', cutoff.toISOString());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const blockedIds = Array.from(new Set((data || []).map((r: any) => r.conversation_id)));

    return NextResponse.json({ blocked_ids: blockedIds });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
