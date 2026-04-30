import { NextRequest, NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function extractPhoneNumberId(inbox: any): string | null {
  return (
    inbox?.provider_config?.phone_number_id ||
    inbox?.channel?.provider_config?.phone_number_id ||
    inbox?.phone_number_id ||
    null
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { perms, response } = await requireAuth(req);
  if (!perms) return response;
  try {
    const data = await chatwootGet(`/api/v1/accounts/${params.id}/inboxes`);
    const raw = data.payload || data || [];
    const mapped = raw.map((i: any) => ({
      id: i.id,
      name: i.name,
      channel_type: i.channel_type,
      phone_number: i.phone_number,
      phone_number_id: extractPhoneNumberId(i),
    }));
    const filtered = perms.isAdmin
      ? mapped
      : mapped.filter(
          (i: any) =>
            i.phone_number_id &&
            perms.allowedPhoneIds.includes(String(i.phone_number_id))
        );
    return NextResponse.json(filtered);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
