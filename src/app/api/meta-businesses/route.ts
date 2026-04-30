import { NextRequest, NextResponse } from 'next/server';
import { createBusiness, listBusinesses, toPublic } from '@/lib/meta-graph';
import { requireAdmin, requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Auth required to LIST (so admin UI works) but no admin requirement —
// non-admins still need to know BM names for context. Tokens stay masked.
export async function GET(req: NextRequest) {
  const { perms, response } = await requireAuth(req);
  if (!perms) return response;
  try {
    const list = await listBusinesses();
    return NextResponse.json(list.map(toPublic));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { perms, response } = await requireAdmin(req);
  if (!perms) return response;
  try {
    const body = await req.json();
    const name = (body.name || '').trim();
    const business_account_id = (body.business_account_id || '').trim();
    const access_token = (body.access_token || '').trim();

    if (!name || !business_account_id || !access_token) {
      return NextResponse.json(
        { error: 'name, business_account_id e access_token sao obrigatorios' },
        { status: 400 }
      );
    }

    const created = await createBusiness({
      name,
      business_account_id,
      access_token,
    });
    return NextResponse.json(toPublic(created));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
