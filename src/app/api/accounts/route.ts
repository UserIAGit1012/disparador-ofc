import { NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';

export async function GET() {
  try {
    const data = await chatwootGet('/api/v1/profile');
    const accounts = (data.accounts || [])
      .filter((a: any) => a.status === 'active')
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .map((a: any) => ({ id: a.id, name: a.name }));
    return NextResponse.json(accounts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
