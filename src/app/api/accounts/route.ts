import { NextRequest, NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CachedAccountIds {
  ids: Set<number>;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const accountsByUserCache = new Map<string, CachedAccountIds>();

function extractPhoneNumberId(inbox: any): string | null {
  return (
    inbox?.provider_config?.phone_number_id ||
    inbox?.channel?.provider_config?.phone_number_id ||
    inbox?.phone_number_id ||
    null
  );
}

async function accountsAllowedForUser(
  userKey: string,
  allowedPhoneIds: string[],
  candidateAccountIds: number[]
): Promise<Set<number>> {
  const now = Date.now();
  const cached = accountsByUserCache.get(userKey);
  if (cached && cached.expiresAt > now) {
    return cached.ids;
  }

  const allowedSet = new Set(allowedPhoneIds.map(String));
  const results = await Promise.all(
    candidateAccountIds.map(async (id) => {
      try {
        const data = await chatwootGet(`/api/v1/accounts/${id}/inboxes`);
        const inboxes = data.payload || data || [];
        const hit = inboxes.some((i: any) => {
          const pid = extractPhoneNumberId(i);
          return pid && allowedSet.has(String(pid));
        });
        return hit ? id : null;
      } catch {
        return null;
      }
    })
  );
  const ids = new Set(results.filter((x): x is number => x !== null));
  accountsByUserCache.set(userKey, { ids, expiresAt: now + CACHE_TTL_MS });
  return ids;
}

export async function GET(req: NextRequest) {
  const { perms, response } = await requireAuth(req);
  if (!perms) return response;

  try {
    const data = await chatwootGet('/api/v1/profile');
    const allActive = (data.accounts || [])
      .filter((a: any) => a.status === 'active')
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .map((a: any) => ({ id: a.id as number, name: a.name as string }));

    if (perms.isAdmin) {
      return NextResponse.json(allActive);
    }

    if (perms.allowedPhoneIds.length === 0) {
      return NextResponse.json([]);
    }

    const allowed = await accountsAllowedForUser(
      perms.userId,
      perms.allowedPhoneIds,
      allActive.map((a: { id: number }) => a.id)
    );
    const filtered = allActive.filter((a: { id: number }) => allowed.has(a.id));
    return NextResponse.json(filtered);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
