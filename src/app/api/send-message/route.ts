import { NextRequest, NextResponse } from 'next/server';
import { chatwootPost } from '@/lib/chatwoot';

export async function POST(req: NextRequest) {
  try {
    const { accountId, conversationId, template, content } = await req.json();

    if (!accountId || !conversationId || !template) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const data = await chatwootPost(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        content: content || '',
        message_type: 'outgoing',
        template_params: {
          name: template.name,
          language: template.language,
          category: template.category,
          processed_params: template.processedParams,
        },
      }
    );

    return NextResponse.json({ success: true, messageId: data.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
