import { NextRequest, NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';

// Fetch conversation details in parallel batches to get last_activity_at
async function enrichWithActivity(accountId: string, items: any[]): Promise<void> {
  const BATCH_SIZE = 10;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((item) =>
        chatwootGet(`/api/v1/accounts/${accountId}/conversations/${item.conversation_id}`)
      )
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        batch[j].last_activity_at = result.value.last_activity_at || null;
      }
    }
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const funnelId = searchParams.get('funnel_id');
    const stageId = searchParams.get('stage_id');
    const fetchAll = searchParams.get('all') === 'true';

    if (!funnelId || !stageId) {
      return NextResponse.json({ error: 'funnel_id and stage_id are required' }, { status: 400 });
    }

    const allItems: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await chatwootGet(
        `/api/v1/accounts/${params.id}/kanban_items?funnel_id=${funnelId}&stage_id=${stageId}&page=${page}`
      );

      const items = data.items || data.payload || [];
      const pagination = data.pagination || {};

      for (const item of items) {
        const convId = item.item_details?.conversation_id || item.conversation_display_id;
        if (!convId) continue;

        allItems.push({
          id: item.id,
          conversation_id: convId,
          name: item.conversation?.contact?.name || item.item_details?.title || `Card #${item.id}`,
          phone_number: item.conversation?.contact?.phone_number || null,
          last_activity_at: null,
          stage: item.funnel_stage,
        });
      }

      hasMore = fetchAll && pagination.has_more === true && page < 50;
      page++;

      if (!fetchAll) break;
    }

    // Deduplicate by conversation_id
    const seen = new Set<number>();
    const unique = allItems.filter((item) => {
      if (seen.has(item.conversation_id)) return false;
      seen.add(item.conversation_id);
      return true;
    });

    // Enrich with last_activity_at from conversation details
    await enrichWithActivity(params.id, unique);

    return NextResponse.json({
      items: unique,
      total: unique.length,
      pages_fetched: page - 1,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
