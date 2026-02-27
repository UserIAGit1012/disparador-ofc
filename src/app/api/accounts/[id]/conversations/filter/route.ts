import { NextRequest, NextResponse } from 'next/server';
import { chatwootPost } from '@/lib/chatwoot';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const page = req.nextUrl.searchParams.get('page') || '1';
    const data = await chatwootPost(
      `/api/v1/accounts/${params.id}/conversations/filter?page=${page}`,
      body
    );
    return NextResponse.json({
      data: data.payload || [],
      meta: data.meta || { all_count: 0 },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
