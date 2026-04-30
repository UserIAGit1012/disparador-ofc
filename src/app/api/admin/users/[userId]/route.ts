import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// PUT — update profile (assignments, name, admin flag)
// Body: { name?, is_admin?, allowed_phone_ids?, allowed_waba_ids? }
export async function PUT(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { perms, response } = await requireAdmin(req);
  if (!perms) return response;

  const body = await req.json().catch(() => ({}));
  const sb = getServiceClient();

  const patch: any = { updated_at: new Date().toISOString() };
  if (typeof body.name === 'string') patch.name = body.name.trim() || null;
  if (typeof body.is_admin === 'boolean') patch.is_admin = body.is_admin;
  if (Array.isArray(body.allowed_phone_ids))
    patch.allowed_phone_ids = body.allowed_phone_ids.map(String);
  if (Array.isArray(body.allowed_waba_ids))
    patch.allowed_waba_ids = body.allowed_waba_ids.map(String);

  // Upsert in case profile row doesn't exist yet
  const { error } = await sb
    .from('user_profiles')
    .upsert(
      { user_id: params.userId, ...patch },
      { onConflict: 'user_id' }
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE — delete the auth user (cascades user_profiles via FK ON DELETE CASCADE)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { perms, response } = await requireAdmin(req);
  if (!perms) return response;

  // Prevent self-delete
  if (perms.userId === params.userId) {
    return NextResponse.json(
      { error: 'Voce nao pode deletar a propria conta' },
      { status: 400 }
    );
  }

  const sb = getServiceClient();
  const { error } = await sb.auth.admin.deleteUser(params.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// POST — reset password (generate a new random one)
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { perms, response } = await requireAdmin(req);
  if (!perms) return response;

  const sb = getServiceClient();
  const charset =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const arr = new Uint32Array(14);
  (globalThis as any).crypto.getRandomValues(arr);
  let password = '';
  for (let i = 0; i < 14; i++) password += charset[arr[i] % charset.length];

  const { error } = await sb.auth.admin.updateUserById(params.userId, {
    password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, password });
}
