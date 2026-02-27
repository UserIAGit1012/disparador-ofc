import { NextRequest, NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await chatwootGet(`/api/v1/accounts/${params.id}/labels`);
    return NextResponse.json(data.payload || data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
