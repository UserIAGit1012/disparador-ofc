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

function generatePassword(length = 14): string {
  const charset =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const arr = new Uint32Array(length);
  // crypto is global in Node 20+ runtime
  (globalThis as any).crypto.getRandomValues(arr);
  let pw = '';
  for (let i = 0; i < length; i++) pw += charset[arr[i] % charset.length];
  return pw;
}

// GET — list all users with their profiles (admin only)
export async function GET(req: NextRequest) {
  const { perms, response } = await requireAdmin(req);
  if (!perms) return response;

  const sb = getServiceClient();

  // Page through auth.users (admin API)
  const { data: authData, error: authErr } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  const users = authData?.users || [];
  const userIds = users.map((u: any) => u.id);

  let profiles: any[] = [];
  if (userIds.length > 0) {
    const { data } = await sb
      .from('user_profiles')
      .select('user_id, name, is_admin, allowed_phone_ids, allowed_waba_ids')
      .in('user_id', userIds);
    profiles = data || [];
  }
  const profMap = new Map(profiles.map((p) => [p.user_id, p]));

  const merged = users.map((u: any) => {
    const p = profMap.get(u.id) || {};
    return {
      user_id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      name: p.name || null,
      is_admin: p.is_admin || false,
      allowed_phone_ids: p.allowed_phone_ids || [],
      allowed_waba_ids: p.allowed_waba_ids || [],
    };
  });

  return NextResponse.json(merged);
}

// POST — bulk create users from a list of emails (admin only)
// Body: { emails: string[] }
// Returns: [{ email, user_id, password, error? }]
export async function POST(req: NextRequest) {
  const { perms, response } = await requireAdmin(req);
  if (!perms) return response;

  const body = await req.json().catch(() => ({}));
  const emails: string[] = Array.isArray(body.emails)
    ? body.emails.map((e: string) => String(e || '').trim().toLowerCase()).filter(Boolean)
    : [];
  if (emails.length === 0) {
    return NextResponse.json({ error: 'emails (array) obrigatorio' }, { status: 400 });
  }

  const sb = getServiceClient();
  const out: any[] = [];

  for (const email of emails) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      out.push({ email, error: 'Email invalido' });
      continue;
    }
    const password = generatePassword(14);
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      out.push({ email, error: error.message });
      continue;
    }
    const userId = data?.user?.id;
    if (!userId) {
      out.push({ email, error: 'failed to create user' });
      continue;
    }
    // Insert empty profile row
    await sb.from('user_profiles').upsert(
      { user_id: userId, name: null, is_admin: false, allowed_phone_ids: [], allowed_waba_ids: [] },
      { onConflict: 'user_id' }
    );
    out.push({ email, user_id: userId, password });
  }

  return NextResponse.json(out);
}
