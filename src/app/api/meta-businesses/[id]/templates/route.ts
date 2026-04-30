import { NextRequest, NextResponse } from 'next/server';
import {
  createTemplateOnWABA,
  getBusinessById,
  listTemplatesFor,
} from '@/lib/meta-graph';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { perms, response } = await requireAuth(req);
  if (!perms) return response;
  try {
    const b = await getBusinessById(params.id);
    if (!b)
      return NextResponse.json({ error: 'business not found' }, { status: 404 });
    let data = await listTemplatesFor(b);
    if (!perms.isAdmin) {
      data = data.filter((t: any) =>
        perms.allowedWabaIds.includes(String(t.waba_id))
      );
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { perms, response } = await requireAuth(req);
  if (!perms) return response;
  try {
    const b = await getBusinessById(params.id);
    if (!b)
      return NextResponse.json({ error: 'business not found' }, { status: 404 });

    const body = await req.json();
    const wabaId: string = (body.waba_id || '').trim();
    if (!wabaId) {
      return NextResponse.json(
        { error: 'waba_id obrigatorio (selecione um numero)' },
        { status: 400 }
      );
    }

    if (!perms.isAdmin && !perms.allowedWabaIds.includes(wabaId)) {
      return NextResponse.json(
        { error: 'Sem permissao para criar templates nesta WABA' },
        { status: 403 }
      );
    }

    const name: string = (body.name || '').trim();
    const language: string = (body.language || 'pt_BR').trim();
    const category: string = (body.category || 'MARKETING').toUpperCase();
    const components: any[] = Array.isArray(body.components) ? body.components : [];

    if (!name) return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 });
    if (!/^[a-z0-9_]+$/.test(name))
      return NextResponse.json(
        { error: 'Nome deve conter apenas letras minusculas, numeros e underscore' },
        { status: 400 }
      );
    if (!['AUTHENTICATION', 'MARKETING', 'UTILITY'].includes(category))
      return NextResponse.json(
        { error: 'Categoria invalida (use MARKETING, UTILITY ou AUTHENTICATION)' },
        { status: 400 }
      );
    if (!components.some((c) => c?.type === 'BODY'))
      return NextResponse.json(
        { error: 'Componente BODY obrigatorio' },
        { status: 400 }
      );

    const result = await createTemplateOnWABA(b, wabaId, {
      name,
      language,
      category: category as any,
      components,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
