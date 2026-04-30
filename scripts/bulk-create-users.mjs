// Bulk create Supabase auth users via Admin API.
// Usage: node scripts/bulk-create-users.mjs
// Reads .env.local in CWD.

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

// Load .env.local manually
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
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const USERS = [
  ['VICTOR LELIS', 'vendasvictorlelis@gmail.com', false],
  ['LEO ARAUJO', 'vendasleoaraujo904@gmail.com', false],
  ['FELIPE FONSECA', 'vendasfelipefonseca19@gmail.com', true],
  ['GABRIEL VEIGA', 'gabrielveigavendas@gmail.com', true],
  ['CABO PEREIRA VENDAS', 'cabogpereira@gmail.com', true],
  ['NUTRI NATHAN VENDAS', 'nutri.nathanperformance@gmail.com', true],
  ['LEANDRO PERES VENDAS', 'perfornance.peresvendas@gmail.com', true],
  ['GG ROCHA VENDAS', 'gg.performancevendas@gmail.com', true],
  ['JOAO CURRY', 'curryjoao2@gmail.com', true],
  ['ALFY POLY VENDAS', 'vendas.alfypolypeak@gmail.com', true],
  ['BRUNO SANTOS VENDAS', 'vendas.brunosantospeak@gmail.com', false],
  ['BRAULIO PINDUCA VENDAS', 'vendas.pinducapeak@gmail.com', true],
  ['BASA VENDAS', 'vendas.basapeak@gmail.com', true],
  ['BIANCHI VENDAS', 'vendas.bianchipeak@gmail.com', true],
  ['EDVAN VENDAS', 'vendas.edvanpeak@gmail.com', true],
  ['FRANCIELLE VENDAS', 'vendas.franciellepeak@gmail.com', false],
  ['HORSE VENDAS', 'vendas.horsepeak@gmail.com', false],
  ['ISA PECINI VENDAS', 'vendas.isapecinipeak@gmail.com', false],
  ['JOHANN VENDAS', 'vendas.johannpeak@gmail.com', false],
  ['JORLAN VENDAS', 'vendas.jorlanpeak@gmail.com', false],
  ['JULIA CACERES VENDAS', 'vendas.jucacerespeak@gmail.com', false],
  ['JULIO GORILA VENDAS', 'vendas.juliogorilapeak@gmail.com', true],
  ['LALA VENDAS', 'vendas.lalapeak@gmail.com', true],
  ['RAFA BRANDAO VENDAS', 'vendas.rafabrandaopeak@gmail.com', true],
  ['RUDE BOY VENDAS', 'vendas.rudeboypeak@gmail.com', false],
  ['PANTERA VENDAS', 'panteraconsultoria7@gmail.com', false],
  ['TENENTE BRENO VENDAS', 'vendas.tenentepeak@gmail.com', true],
  ['VITOR CHAVES VENDAS', 'vendas.vitorchavespeak@gmail.com', true],
  ['ZANCANELLI VENDAS', 'vendas.zancanellipeak@gmail.com', true],
  ['VITOR PORTO VENDAS', 'vitorportovendas.peak@gmail.com', true],
  ['ANGELA BORGES VENDAS', 'angelaborgesvendas.peak@gmail.com', false],
  ['GNOMO VENDAS', 'vendasgnomo.peak@gmail.com', false],
  ['KAREN BRANDAO VENDAS', 'karenbrandaovendas.peak@gmail.com', true],
  ['LUCAS PINHEIRO VENDAS', 'lucaspinheirovendas.peak@gmail.com', true],
  ['GIGA VENDAS', 'fbgigavendas.peak@gmail.com', true],
  ['LUANA MENDES VENDAS', 'luana.mendesvendasserpa@gmail.com', false],
  ['FIALHO VENDAS', 'performance.fialhovendas@gmail.com', true],
  ['PAIZAO', 'paizao.performance@gmail.com', false],
  ['XICORIA', 'performancexicoria@gmail.com', true],
];

function genPassword(len = 14) {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

async function adminCreateUser(email, password, displayName) {
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
      user_metadata: { display_name: displayName },
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function findUserByEmail(email) {
  // O ?email=... do GoTrue admin API NÃO filtra (ignora silenciosamente);
  // precisa paginar e bater email localmente.
  const target = email.toLowerCase();
  let page = 1;
  while (true) {
    const res = await fetch(
      `${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
    );
    const data = await res.json().catch(() => ({}));
    const users = data?.users || [];
    const hit = users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) return null;
    page++;
  }
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

async function testLogin(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON,
    },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
}

const results = [];
for (const [name, email, discontinued] of USERS) {
  const password = genPassword(14);
  let userId = null;
  let status = '';
  try {
    const r = await adminCreateUser(email, password, name);
    if (r.ok) {
      userId = r.data?.id || r.data?.user?.id;
      status = 'CREATED';
    } else if (
      r.data?.msg?.includes('already') ||
      r.data?.error_description?.includes('already') ||
      r.data?.code === 'email_exists' ||
      r.status === 422
    ) {
      // already exists — find and reset password
      const existing = await findUserByEmail(email);
      if (existing) {
        const ok = await adminUpdatePassword(existing.id, password);
        userId = existing.id;
        status = ok ? 'RESET' : 'RESET_FAILED';
      } else {
        status = `ERR ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`;
      }
    } else {
      status = `ERR ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`;
    }
  } catch (err) {
    status = 'EXCEPTION ' + err.message;
  }
  results.push({ name, email, discontinued, userId, password, status });
  process.stderr.write(`[${results.length}/${USERS.length}] ${email} -> ${status}\n`);
}

// Test login on first successfully-created/reset user
const candidate = results.find((r) => r.status === 'CREATED' || r.status === 'RESET');
let loginTest = 'SKIPPED';
if (candidate) {
  const ok = await testLogin(candidate.email, candidate.password);
  loginTest = ok ? `OK (${candidate.email})` : `FAILED (${candidate.email})`;
}
process.stderr.write(`\nLogin smoke test: ${loginTest}\n\n`);

// Markdown output to stdout
console.log('| # | Nome | Email | Senha | Status |');
console.log('|---|------|-------|-------|--------|');
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const tag = r.discontinued ? ' (Descontinuado)' : '';
  console.log(`| ${i + 1} | ${r.name}${tag} | \`${r.email}\` | \`${r.password}\` | ${r.status} |`);
}
console.log('');
console.log(`Login test: ${loginTest}`);
