// Meta Graph API client (server-side)
// Manages multiple Meta Business Accounts (WABAs) globally — list/add/edit/remove,
// fetch their phone numbers and message templates directly via Graph API.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface MetaBusinessRecord {
  id: string;
  name: string;
  business_account_id: string;
  access_token: string;
  created_at?: string;
  updated_at?: string;
}

export type MetaBusinessPublic = Omit<MetaBusinessRecord, 'access_token'> & {
  access_token_masked: string;
};

function getSupabaseServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey || anonKey);
}

function maskToken(token: string): string {
  if (token.length <= 10) return '••••••';
  return token.slice(0, 6) + '…' + token.slice(-4);
}

export function toPublic(b: MetaBusinessRecord): MetaBusinessPublic {
  const { access_token, ...rest } = b;
  return { ...rest, access_token_masked: maskToken(access_token) };
}

export async function listBusinesses(): Promise<MetaBusinessRecord[]> {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('meta_business_accounts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getBusinessById(
  id: string
): Promise<MetaBusinessRecord | null> {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('meta_business_accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function createBusiness(input: {
  name: string;
  business_account_id: string;
  access_token: string;
}): Promise<MetaBusinessRecord> {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('meta_business_accounts')
    .insert({
      name: input.name,
      business_account_id: input.business_account_id,
      access_token: input.access_token,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateBusiness(
  id: string,
  input: { name?: string; business_account_id?: string; access_token?: string }
): Promise<MetaBusinessRecord> {
  const sb = getSupabaseServer();
  const patch: any = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.business_account_id !== undefined)
    patch.business_account_id = input.business_account_id;
  if (input.access_token !== undefined && input.access_token.length > 0)
    patch.access_token = input.access_token;
  const { data, error } = await sb
    .from('meta_business_accounts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBusiness(id: string) {
  const sb = getSupabaseServer();
  const { error } = await sb
    .from('meta_business_accounts')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

async function graphFetch(
  path: string,
  accessToken: string,
  init?: RequestInit
) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${GRAPH_API_BASE}${path}${sep}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `Graph API error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// The stored business_account_id may be a WABA ID directly OR a Business Manager ID
// (parent that contains multiple WABAs). This helper resolves to the actual list of
// WABAs we can call /phone_numbers and /message_templates against.
async function resolveWABAs(
  business: MetaBusinessRecord
): Promise<{ id: string; name?: string }[]> {
  // Quick path: try to use the stored ID as a WABA directly
  try {
    await graphFetch(
      `/${business.business_account_id}/phone_numbers?limit=1`,
      business.access_token
    );
    return [{ id: business.business_account_id, name: business.name }];
  } catch {
    // Fall through to BM resolution
  }

  const wabas: { id: string; name?: string }[] = [];
  for (const edge of [
    'owned_whatsapp_business_accounts',
    'client_whatsapp_business_accounts',
  ]) {
    try {
      const r = await graphFetch(
        `/${business.business_account_id}/${edge}?fields=id,name`,
        business.access_token
      );
      if (Array.isArray(r?.data)) {
        for (const w of r.data) wabas.push({ id: w.id, name: w.name });
      }
    } catch {
      // Silently skip — token may not have access to one of the edges
    }
  }
  return wabas;
}

export async function listPhoneNumbersFor(business: MetaBusinessRecord) {
  const wabas = await resolveWABAs(business);
  const results = await Promise.all(
    wabas.map(async (w) => {
      try {
        const data = await graphFetch(
          `/${w.id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier`,
          business.access_token
        );
        return (data?.data || []).map((n: any) => ({
          ...n,
          waba_id: w.id,
          waba_name: w.name,
        }));
      } catch {
        return [];
      }
    })
  );
  return results.flat();
}

export async function listTemplatesFor(
  business: MetaBusinessRecord,
  limit = 200
) {
  const wabas = await resolveWABAs(business);
  const results = await Promise.all(
    wabas.map(async (w) => {
      try {
        const data = await graphFetch(
          `/${w.id}/message_templates?limit=${limit}&fields=name,language,status,category,components,id,quality_score,rejected_reason`,
          business.access_token
        );
        return (data?.data || []).map((t: any) => ({
          ...t,
          waba_id: w.id,
          waba_name: w.name,
        }));
      } catch {
        return [];
      }
    })
  );
  return results.flat();
}

export async function createTemplateOnWABA(
  business: MetaBusinessRecord,
  wabaId: string,
  payload: {
    name: string;
    language: string;
    category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
    components: any[];
  }
) {
  return graphFetch(`/${wabaId}/message_templates`, business.access_token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteTemplateOnWABA(
  business: MetaBusinessRecord,
  wabaId: string,
  name: string,
  hsmId?: string
) {
  const qs = new URLSearchParams({ name });
  if (hsmId) qs.set('hsm_id', hsmId);
  return graphFetch(
    `/${wabaId}/message_templates?${qs.toString()}`,
    business.access_token,
    { method: 'DELETE' }
  );
}
