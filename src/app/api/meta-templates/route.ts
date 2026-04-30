import { NextRequest, NextResponse } from 'next/server';
import { listBusinesses, listTemplatesFor } from '@/lib/meta-graph';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { perms, response } = await requireAuth(req);
  if (!perms) return response;

  try {
    const businesses = await listBusinesses();
    const results = await Promise.all(
      businesses.map(async (b) => {
        try {
          let templates = await listTemplatesFor(b);
          if (!perms.isAdmin) {
            templates = templates.filter((t: any) =>
              perms.allowedWabaIds.includes(String(t.waba_id))
            );
          }
          return {
            business: {
              id: b.id,
              name: b.name,
              business_account_id: b.business_account_id,
            },
            templates,
            error: null,
          };
        } catch (err: any) {
          return {
            business: {
              id: b.id,
              name: b.name,
              business_account_id: b.business_account_id,
            },
            templates: [],
            error: err.message,
          };
        }
      })
    );
    const filtered = perms.isAdmin
      ? results
      : results.filter((r) => r.templates.length > 0);
    return NextResponse.json(filtered);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
