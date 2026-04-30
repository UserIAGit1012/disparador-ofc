// Testa login de todas as credenciais salvas em CREDENCIAIS.local.md
// (gitignored — só roda localmente)
import { readFileSync, existsSync } from 'node:fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!existsSync('CREDENCIAIS.local.md')) {
  console.error('CREDENCIAIS.local.md não encontrado');
  process.exit(1);
}
const creds = readFileSync('CREDENCIAIS.local.md', 'utf8');

// Parse linhas no formato:  | N | Nome | `email` | `senha` |
const rows = [];
for (const line of creds.split('\n')) {
  const m = line.match(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`/);
  if (m) {
    const [, name, email, password] = m;
    if (password.includes('não definida') || password.includes('dry-run')) continue;
    rows.push({ name: name.trim(), email: email.trim(), password: password.trim() });
  }
}

console.log(`Testando ${rows.length} login(s)...\n`);

async function tryLogin(email, password) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON },
      body: JSON.stringify({ email, password }),
    });
    const dt = Date.now() - t0;
    if (res.ok) {
      const data = await res.json();
      return { ok: true, dt, userId: data.user?.id };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, dt, error: err.msg || err.error_description || res.status };
  } catch (e) {
    return { ok: false, dt: Date.now() - t0, error: e.message };
  }
}

let pass = 0;
let fail = 0;
const failures = [];
for (const r of rows) {
  const res = await tryLogin(r.email, r.password);
  if (res.ok) {
    pass++;
    process.stdout.write(`✓ ${r.email.padEnd(40)} (${res.dt}ms)\n`);
  } else {
    fail++;
    failures.push({ ...r, error: res.error });
    process.stdout.write(`✗ ${r.email.padEnd(40)} FALHOU: ${res.error}\n`);
  }
}

console.log(`\n=== Resultado: ${pass}/${rows.length} OK | ${fail} falha(s) ===`);
if (failures.length > 0) {
  console.log('\nFalhas:');
  for (const f of failures) console.log(`  - ${f.email} (${f.name}): ${f.error}`);
}
