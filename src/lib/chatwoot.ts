// Server-side only Chatwoot client
const BASE_URL = process.env.CHATWOOT_BASE_URL!;
const API_TOKEN = process.env.CHATWOOT_API_TOKEN!;

const headers = {
  'Content-Type': 'application/json',
  api_access_token: API_TOKEN,
};

export async function chatwootGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { headers, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwoot API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function chatwootPost(path: string, body: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwoot API error ${res.status}: ${text}`);
  }
  return res.json();
}
