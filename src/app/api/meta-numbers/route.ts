import { NextRequest, NextResponse } from 'next/server';
import { listBusinesses, listPhoneNumbersFor } from '@/lib/meta-graph';
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
          let numbers = await listPhoneNumbersFor(b);
          if (!perms.isAdmin) {
            numbers = numbers.filter((n: any) =>
              perms.allowedPhoneIds.includes(String(n.id))
            );
          }
          return {
            business: {
              id: b.id,
              name: b.name,
              business_account_id: b.business_account_id,
            },
            numbers,
            error: null,
          };
        } catch (err: any) {
          return {
            business: {
              id: b.id,
              name: b.name,
              business_account_id: b.business_account_id,
            },
            numbers: [],
            error: err.message,
          };
        }
      })
    );
    // For non-admin, drop businesses that ended with no visible numbers
    const filtered = perms.isAdmin
      ? results
      : results.filter((r) => r.numbers.length > 0);
    return NextResponse.json(filtered);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
