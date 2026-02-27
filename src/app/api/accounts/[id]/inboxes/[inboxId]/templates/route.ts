import { NextRequest, NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; inboxId: string } }
) {
  try {
    // Templates are embedded in the inbox object
    const data = await chatwootGet(
      `/api/v1/accounts/${params.id}/inboxes/${params.inboxId}`
    );
    const templates = data.message_templates || [];
    return NextResponse.json(templates);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
