import { readFileSync } from 'node:fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.argv[2] || 'adminmarilia@gmail.com';

// O ?email=... do GoTrue admin API NÃO filtra; precisa paginar e bater localmente.
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
  console.log('User NOT found');
  process.exit(1);
}
console.log(`User: ${user.email} (${user.id})`);
console.log(`Confirmed: ${user.email_confirmed_at ? 'yes' : 'NO'}`);

const profRes = await fetch(
  `${SUPA_URL}/rest/v1/user_profiles?user_id=eq.${user.id}&select=*`,
  { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
);
const profiles = await profRes.json();
console.log('Profile:', JSON.stringify(profiles, null, 2));
