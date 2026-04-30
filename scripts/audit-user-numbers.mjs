// Audita: cada vendedor não-admin tem acesso ao número que tem o nome dele?
// Cruza user_profiles.allowed_phone_ids com Meta Graph phone_numbers (verified_name).

import { readFileSync } from 'node:fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

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

async function listProfiles() {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/user_profiles?select=user_id,name,is_admin,allowed_phone_ids`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
  );
  return await res.json();
}

async function listBMs() {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/meta_business_accounts?select=id,name,business_account_id,access_token`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
  );
  return await res.json();
}

async function gFetch(path, token) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(
    `https://graph.facebook.com/v21.0${path}${sep}access_token=${encodeURIComponent(token)}`
  );
  if (!r.ok) return null;
  return r.json();
}

async function getAllNumbers(bms) {
  // Pega phone_numbers de todas as WABAs (owned + client) de todas as BMs em paralelo
  const allNumbers = [];
  await Promise.all(
    bms.map(async (b) => {
      const wabas = [];
      for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
        const r = await gFetch(`/${b.business_account_id}/${edge}?fields=id,name`, b.access_token);
        if (r?.data) for (const w of r.data) wabas.push({ id: w.id, name: w.name, bm: b.name });
      }
      await Promise.all(
        wabas.map(async (w) => {
          const data = await gFetch(
            `/${w.id}/phone_numbers?fields=id,display_phone_number,verified_name`,
            b.access_token
          );
          if (data?.data) {
            for (const n of data.data) {
              allNumbers.push({
                numberId: String(n.id),
                phone: n.display_phone_number,
                verifiedName: n.verified_name,
                wabaName: w.name,
                bm: b.name,
              });
            }
          }
        })
      );
    })
  );
  return allNumbers;
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function expertKeywords(userName, email) {
  // Extrai keywords do nome do vendedor pra dar match no verified_name do número.
  // Ex: "ANGELA BORGES VENDAS" -> ["angela", "borges"]
  const parts = (userName || '')
    .replace(/VENDAS|VENDA|PEAK|PERFORMANCE/gi, '')
    .split(/\s+/)
    .map((p) => normalize(p))
    .filter((p) => p.length >= 3);
  if (parts.length === 0) {
    // Fallback: usa parte do email antes do @
    const local = email.split('@')[0];
    parts.push(...local.split(/[._-]/).map(normalize).filter((p) => p.length >= 3));
  }
  return parts;
}

const [authUsers, profiles, bms] = await Promise.all([
  listAllAuthUsers(),
  listProfiles(),
  listBMs(),
]);
const profMap = new Map(profiles.map((p) => [p.user_id, p]));

console.log(`Buscando ${bms.length} BM(s) no Meta...`);
const allNumbers = await getAllNumbers(bms);
const numberById = new Map(allNumbers.map((n) => [n.numberId, n]));
console.log(`Total de números encontrados no Meta: ${allNumbers.length}\n`);

const nonAdminUsers = authUsers
  .map((u) => ({ ...u, profile: profMap.get(u.id) }))
  .filter((u) => !u.profile?.is_admin);

const reportRows = [];
const orphanNumbers = new Set(allNumbers.map((n) => n.numberId));

for (const u of nonAdminUsers) {
  const allowed = u.profile?.allowed_phone_ids || [];
  const assignedNumbers = allowed.map((id) => numberById.get(id)).filter(Boolean);
  for (const n of assignedNumbers) orphanNumbers.delete(n.numberId);

  const userName = u.profile?.name || u.user_metadata?.display_name || '';
  const keywords = expertKeywords(userName, u.email);

  // Tenta achar números no Meta cujo verified_name bate com keywords do vendedor
  const matchingByName = allNumbers.filter((n) => {
    const vn = normalize(n.verifiedName);
    return keywords.some((k) => vn.includes(k));
  });

  // Análise
  const assignedSet = new Set(assignedNumbers.map((n) => n.numberId));
  const matchSet = new Set(matchingByName.map((n) => n.numberId));
  const correctlyAssigned = matchingByName.filter((n) => assignedSet.has(n.numberId));
  const missingFromAssignment = matchingByName.filter((n) => !assignedSet.has(n.numberId));
  const wrongAssignment = assignedNumbers.filter((n) => !matchSet.has(n.numberId));

  let status;
  if (assignedNumbers.length === 0 && matchingByName.length > 0) {
    status = `⚠️  SEM ATRIBUIÇÃO — sugestão: ${matchingByName.map((n) => n.verifiedName).join(', ')}`;
  } else if (assignedNumbers.length === 0 && matchingByName.length === 0) {
    status = `❓ sem números atribuídos e nenhum número Meta bate com o nome`;
  } else if (missingFromAssignment.length > 0) {
    status = `⚠️  faltando atribuir: ${missingFromAssignment.map((n) => n.verifiedName).join(', ')}`;
  } else if (wrongAssignment.length > 0) {
    status = `⚠️  atribuído mas nome diverge: ${wrongAssignment.map((n) => `${n.verifiedName} (${n.phone})`).join(', ')}`;
  } else {
    status = `✅ OK`;
  }

  reportRows.push({
    user: userName || u.email,
    email: u.email,
    keywords: keywords.join(', '),
    assigned: assignedNumbers.map((n) => `${n.verifiedName} ${n.phone}`).join(' | ') || '(nenhum)',
    matchByName: matchingByName.map((n) => `${n.verifiedName} ${n.phone}`).join(' | ') || '(nenhum match)',
    status,
  });
}

console.log('\n## Relatório por vendedor\n');
for (const r of reportRows) {
  console.log(`### ${r.user}`);
  console.log(`Email: \`${r.email}\``);
  console.log(`Keywords usadas no match: \`${r.keywords}\``);
  console.log(`Atribuído atualmente: ${r.assigned}`);
  console.log(`Match por nome no Meta: ${r.matchByName}`);
  console.log(`Status: ${r.status}\n`);
}

if (orphanNumbers.size > 0) {
  console.log(`\n## Números no Meta sem atribuição a nenhum vendedor (${orphanNumbers.size})\n`);
  for (const id of orphanNumbers) {
    const n = numberById.get(id);
    console.log(`- ${n.verifiedName} — ${n.phone} (WABA: ${n.wabaName}, BM: ${n.bm})`);
  }
}

const ok = reportRows.filter((r) => r.status.startsWith('✅')).length;
const warn = reportRows.filter((r) => r.status.startsWith('⚠️')).length;
const unknown = reportRows.filter((r) => r.status.startsWith('❓')).length;
console.log(`\n## Resumo: ${ok} OK | ${warn} divergente | ${unknown} desconhecido | ${nonAdminUsers.length} total não-admin`);
