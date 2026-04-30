import { NextRequest, NextResponse } from 'next/server';
import { deleteTemplateOnWABA, getBusinessById } from '@/lib/meta-graph';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; name: string } }
) {
  const { perms, response } = await requireAuth(req);
  if (!perms) return response;
  try {
    const b = await getBusinessById(params.id);
    if (!b)
      return NextResponse.json({ error: 'business not found' }, { status: 404 });
    const url = new URL(req.url);
    const wabaId = url.searchParams.get('waba_id');
    if (!wabaId)
      return NextResponse.json(
        { error: 'waba_id (query param) obrigatorio' },
        { status: 400 }
      );
    if (!perms.isAdmin && !perms.allowedWabaIds.includes(wabaId)) {
      return NextResponse.json(
        { error: 'Sem permissao para excluir templates nesta WABA' },
        { status: 403 }
      );
    }
    const hsmId = url.searchParams.get('hsm_id') || undefined;
    await deleteTemplateOnWABA(
      b,
      wabaId,
      decodeURIComponent(params.name),
      hsmId
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
