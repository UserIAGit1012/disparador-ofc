import { NextRequest, NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; funnelId: string } }
) {
  try {
    const data = await chatwootGet(
      `/api/v1/accounts/${params.id}/funnels/${params.funnelId}`
    );
    const funnel = data.payload || data;

    // Stages can be an object keyed by slug or an array
    let stages: any[] = [];
    if (Array.isArray(funnel.stages)) {
      stages = funnel.stages;
    } else if (funnel.stages && typeof funnel.stages === 'object') {
      // Convert object format { slug: { name, position, ... } } to array
      stages = Object.entries(funnel.stages).map(([slug, stage]: [string, any]) => ({
        id: slug,
        name: stage.name,
        position: stage.position,
        funnel_id: funnel.id,
      }));
      stages.sort((a, b) => a.position - b.position);
    }

    return NextResponse.json(stages);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
