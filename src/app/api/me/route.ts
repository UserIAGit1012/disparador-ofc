import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { perms, response } = await requireAuth(req);
  if (!perms) return response;
  return NextResponse.json({
    user_id: perms.userId,
    email: perms.email,
    is_admin: perms.isAdmin,
    allowed_phone_ids: perms.allowedPhoneIds,
    allowed_waba_ids: perms.allowedWabaIds,
  });
}
