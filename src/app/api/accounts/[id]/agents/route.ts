import { NextRequest, NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await chatwootGet(`/api/v1/accounts/${params.id}/agents`);
    const agents = (Array.isArray(data) ? data : data.payload || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      availability_status: a.availability_status,
    }));
    return NextResponse.json(agents);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
