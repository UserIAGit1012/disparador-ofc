import { readFileSync } from 'node:fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(
  `${SUPA_URL}/rest/v1/meta_business_accounts?select=id,name,business_account_id,access_token`,
  { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
);
const data = await res.json();
console.log(`Total BMs: ${Array.isArray(data) ? data.length : 'ERR'}`);
if (Array.isArray(data)) {
  for (const b of data) {
    const token = b.access_token || '';
    console.log(`  [${b.id}] ${b.name} — BM=${b.business_account_id}, token=${token.slice(0, 10)}…(${token.length} chars)`);
  }
}

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    return `[${Date.now() - t0}ms] ${label} OK: ${JSON.stringify(r).slice(0, 200)}`;
  } catch (e) {
    return `[${Date.now() - t0}ms] ${label} ERR: ${e.message}`;
  }
}

async function gFetch(path, token, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`https://graph.facebook.com/v21.0${path}${sep}access_token=${encodeURIComponent(token)}`, { signal: ctrl.signal });
    clearTimeout(to);
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    clearTimeout(to);
    throw e;
  }
}

if (Array.isArray(data)) {
  for (const b of data) {
    console.log(`\n=== BM ${b.id} (${b.name}) ===`);
    console.log(await timed(`/${b.business_account_id}/phone_numbers?limit=1`, () => gFetch(`/${b.business_account_id}/phone_numbers?limit=1`, b.access_token)));
    console.log(await timed(`/${b.business_account_id}/owned_whatsapp_business_accounts`, () => gFetch(`/${b.business_account_id}/owned_whatsapp_business_accounts?fields=id,name`, b.access_token)));
    console.log(await timed(`/${b.business_account_id}/client_whatsapp_business_accounts`, () => gFetch(`/${b.business_account_id}/client_whatsapp_business_accounts?fields=id,name`, b.access_token)));
  }
}
