// Reseta a senha de todos os usuários não-admin com senhas aleatórias.
// Preserva administradores (não toca neles).
// Uso: node scripts/reset-all-passwords.mjs            -> só dry-run (lista quem vai ser resetado)
//      node scripts/reset-all-passwords.mjs --apply    -> executa o reset

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

const APPLY = process.argv.includes('--apply');

function genPassword(len = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

async function listAllAuthUsers() {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
    );
    const data = await res.json();
    const users = data?.users || [];
    all.push(...users);
    if (users.length < 200) break;
    page++;
  }
  return all;
}

async function listProfiles(userIds) {
  if (userIds.length === 0) return new Map();
  const inList = userIds.map((id) => `"${id}"`).join(',');
  const res = await fetch(
    `${SUPA_URL}/rest/v1/user_profiles?select=user_id,name,is_admin&user_id=in.(${userIds.join(',')})`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
  );
  const profiles = await res.json();
  return new Map(profiles.map((p) => [p.user_id, p]));
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
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt.slice(0, 200)}`);
  }
}

async function testLogin(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
}

const authUsers = await listAllAuthUsers();
const profiles = await listProfiles(authUsers.map((u) => u.id));

const targets = authUsers.filter((u) => {
  const p = profiles.get(u.id);
  return !p?.is_admin;
});
const admins = authUsers.filter((u) => profiles.get(u.id)?.is_admin);

process.stderr.write(
  `\nTotal: ${authUsers.length} usuário(s) | Admins (preservados): ${admins.length} | Para resetar: ${targets.length}\n`
);
process.stderr.write(`Modo: ${APPLY ? 'APLICANDO MUDANÇAS' : 'DRY-RUN (use --apply para executar)'}\n\n`);

const results = [];
for (const u of targets) {
  const newPassword = genPassword(14);
  const profile = profiles.get(u.id);
  const name = profile?.name || u.user_metadata?.display_name || '';
  let status = 'DRY-RUN';
  if (APPLY) {
    try {
      await adminUpdatePassword(u.id, newPassword);
      const ok = await testLogin(u.email, newPassword);
      status = ok ? 'OK' : 'RESET (login fail)';
    } catch (err) {
      status = `ERR: ${err.message.slice(0, 60)}`;
    }
  }
  results.push({
    name,
    email: u.email,
    password: APPLY ? newPassword : '(dry-run)',
    status,
  });
  process.stderr.write(`[${results.length}/${targets.length}] ${u.email} -> ${status}\n`);
}

// Tabela markdown no stdout
console.log('| # | Nome | Email | Senha | Status |');
console.log('|---|------|-------|-------|--------|');
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  console.log(`| ${i + 1} | ${r.name || '—'} | \`${r.email}\` | \`${r.password}\` | ${r.status} |`);
}

console.log('\n## Admins (não foram alterados)');
for (const u of admins) {
  const profile = profiles.get(u.id);
  console.log(`- \`${u.email}\` — ${profile?.name || '(sem nome)'}`);
}
