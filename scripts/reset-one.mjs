// Reseta a senha de UM usuário específico.
// Uso: node scripts/reset-one.mjs <email>
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

const email = process.argv[2];
if (!email) {
  console.error('Uso: node scripts/reset-one.mjs <email>');
  process.exit(1);
}

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const bytes = randomBytes(14);
let password = '';
for (let i = 0; i < 14; i++) password += chars[bytes[i] % chars.length];

// O ?email= do GoTrue admin nem sempre filtra; lista todos e bate localmente.
async function findByEmail(target) {
  let page = 1;
  while (true) {
    const r = await fetch(
      `${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
    );
    const d = await r.json();
    const users = d?.users || [];
    const hit = users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (hit) return hit;
    if (users.length < 200) return null;
    page++;
  }
}

const user = await findByEmail(email);
if (!user) {
  console.error('Usuário não encontrado');
  process.exit(1);
}

const updateRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${user.id}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
  },
  body: JSON.stringify({ password, email_confirm: true }),
});
if (!updateRes.ok) {
  console.error('Falha no update:', await updateRes.text());
  process.exit(1);
}

const loginRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: ANON },
  body: JSON.stringify({ email, password }),
});
const loginOk = loginRes.ok;

console.log(`Email: ${email}`);
console.log(`Senha: ${password}`);
console.log(`User ID: ${user.id}`);
console.log(`Login test: ${loginOk ? 'OK' : 'FALHOU'}`);
