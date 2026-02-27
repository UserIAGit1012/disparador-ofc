import { NextRequest, NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await chatwootGet(`/api/v1/accounts/${params.id}/inboxes`);
    const inboxes = (data.payload || data).map((i: any) => ({
      id: i.id,
      name: i.name,
      channel_type: i.channel_type,
      phone_number: i.phone_number,
    }));
    return NextResponse.json(inboxes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
