// Create or reset a single admin user with a random password.
// Usage: node scripts/create-admin.mjs <email>
// Reads .env.local in CWD.

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SERVICE) {
  console.error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/create-admin.mjs <email>');
  process.exit(1);
}

function genPassword(len = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

async function findUserByEmail(email) {
  const res = await fetch(
    `${SUPA_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
  );
  const data = await res.json().catch(() => ({}));
  return data?.users?.[0] || null;
}

async function adminCreateUser(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Admin Marilia' },
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function adminUpdatePassword(userId, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
    },
    body: JSON.stringify({ password, email_confirm: true }),
  });
  return res.ok;
}

async function upsertAdminProfile(userId, name) {
  const res = await fetch(`${SUPA_URL}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({ user_id: userId, name, is_admin: true }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function testLogin(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
}

const password = genPassword(16);
let userId = null;
let action = '';

const r = await adminCreateUser(email, password);
if (r.ok) {
  userId = r.data?.id || r.data?.user?.id;
  action = 'CREATED';
} else if (
  r.data?.msg?.includes('already') ||
  r.data?.error_description?.includes('already') ||
  r.data?.code === 'email_exists' ||
  r.status === 422
) {
  const existing = await findUserByEmail(email);
  if (!existing) {
    console.error('User exists but could not find by email:', JSON.stringify(r.data));
    process.exit(1);
  }
  const ok = await adminUpdatePassword(existing.id, password);
  userId = existing.id;
  action = ok ? 'PASSWORD_RESET' : 'RESET_FAILED';
} else {
  console.error('Create failed:', r.status, JSON.stringify(r.data));
  process.exit(1);
}

if (!userId) {
  console.error('No user id returned');
  process.exit(1);
}

const profile = await upsertAdminProfile(userId, 'Admin Marilia');
if (!profile.ok) {
  console.error('Failed to upsert admin profile:', profile.status, JSON.stringify(profile.data));
  process.exit(1);
}

const loginOk = await testLogin(email, password);

console.log('');
console.log('================ ADMIN LOGIN ================');
console.log(`Email:    ${email}`);
console.log(`Senha:    ${password}`);
console.log(`User ID:  ${userId}`);
console.log(`Ação:     ${action}`);
console.log(`Admin:    SIM (is_admin=true)`);
console.log(`Login:    ${loginOk ? 'OK' : 'FALHOU'}`);
console.log('=============================================');
