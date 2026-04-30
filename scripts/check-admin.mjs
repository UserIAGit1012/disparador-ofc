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

const userRes = await fetch(
  `${SUPA_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
  { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
);
const userData = await userRes.json();
const user = userData?.users?.[0];
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
