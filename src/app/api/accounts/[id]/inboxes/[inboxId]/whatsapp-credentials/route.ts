import { NextRequest, NextResponse } from 'next/server';
import { chatwootGet } from '@/lib/chatwoot';

// Fetch WhatsApp Cloud API credentials from Chatwoot inbox configuration
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; inboxId: string } }
) {
  try {
    const data = await chatwootGet(
      `/api/v1/accounts/${params.id}/inboxes/${params.inboxId}`
    );

    // Chatwoot stores WhatsApp credentials in the channel config
    const phoneNumberId = data.provider_config?.phone_number_id
      || data.channel?.provider_config?.phone_number_id
      || data.phone_number_id
      || null;

    const apiKey = data.provider_config?.api_key
      || data.channel?.provider_config?.api_key
      || data.provider_config?.business_account_id // fallback field names
      || null;

    if (!phoneNumberId || !apiKey) {
      return NextResponse.json({
        available: false,
        error: 'Credenciais WhatsApp nao encontradas na inbox. Verifique a configuracao da caixa de entrada no Chatwoot.',
        debug: {
          has_provider_config: !!data.provider_config,
          has_channel: !!data.channel,
          channel_type: data.channel_type,
          provider_config_keys: data.provider_config ? Object.keys(data.provider_config) : [],
          channel_provider_keys: data.channel?.provider_config ? Object.keys(data.channel.provider_config) : [],
        },
      });
    }

    return NextResponse.json({
      available: true,
      phone_number_id: phoneNumberId,
      api_key: apiKey,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, available: false }, { status: 500 });
  }
}
