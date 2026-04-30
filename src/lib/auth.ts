// Server-side authorization helpers.
// Reads the Supabase JWT from the Authorization header and resolves the user's
// profile (admin flag + allowed phone/WABA ids) to enforce access control.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UserPermissions {
  userId: string;
  email: string;
  isAdmin: boolean;
  allowedPhoneIds: string[];
  allowedWabaIds: string[];
}

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey || anonKey);
}

export async function getUserPermissions(
  req: NextRequest
): Promise<UserPermissions | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const sb = getServiceClient();
  const { data: userResp, error } = await sb.auth.getUser(token);
  if (error || !userResp?.user) return null;
  const user = userResp.user;

  const { data: profile } = await sb
    .from('user_profiles')
    .select('is_admin, allowed_phone_ids, allowed_waba_ids')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email || '',
    isAdmin: profile?.is_admin || false,
    allowedPhoneIds: profile?.allowed_phone_ids || [],
    allowedWabaIds: profile?.allowed_waba_ids || [],
  };
}

export async function requireAuth(req: NextRequest) {
  const perms = await getUserPermissions(req);
  if (!perms) {
    return {
      perms: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { perms, response: null };
}

export async function requireAdmin(req: NextRequest) {
  const { perms, response } = await requireAuth(req);
  if (!perms) return { perms: null, response };
  if (!perms.isAdmin) {
    return {
      perms: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { perms, response: null };
}
