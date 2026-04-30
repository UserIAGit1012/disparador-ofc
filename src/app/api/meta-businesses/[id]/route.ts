import { NextRequest, NextResponse } from 'next/server';
import {
  deleteBusiness,
  getBusinessById,
  toPublic,
  updateBusiness,
} from '@/lib/meta-graph';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { perms, response } = await requireAdmin(req);
  if (!perms) return response;
  try {
    const b = await getBusinessById(params.id);
    if (!b) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(toPublic(b));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { perms, response } = await requireAdmin(req);
  if (!perms) return response;
  try {
    const body = await req.json();
    const updated = await updateBusiness(params.id, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      business_account_id:
        typeof body.business_account_id === 'string'
          ? body.business_account_id.trim()
          : undefined,
      access_token:
        typeof body.access_token === 'string'
          ? body.access_token.trim()
          : undefined,
    });
    return NextResponse.json(toPublic(updated));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { perms, response } = await requireAdmin(req);
  if (!perms) return response;
  try {
    await deleteBusiness(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
