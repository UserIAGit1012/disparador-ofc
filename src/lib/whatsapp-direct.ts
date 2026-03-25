// Direct WhatsApp Cloud API client (bypasses Chatwoot)
// Used for "invisible" dispatch mode — message reaches contact but doesn't show in Chatwoot

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface WhatsAppCredentials {
  phoneNumberId: string;
  apiKey: string;
}

interface TemplateComponent {
  type: string;
  parameters: { type: string; text?: string; image?: { link: string }; video?: { link: string }; document?: { link: string } }[];
}

interface SendTemplateParams {
  credentials: WhatsAppCredentials;
  recipientPhone: string;
  templateName: string;
  language: string;
  bodyParams?: Record<string, string>;
  headerMediaUrl?: string;
  headerMediaType?: string;
}

function normalizePhone(phone: string): string {
  // Remove everything that isn't a digit or +
  let cleaned = phone.replace(/[^0-9+]/g, '');
  // Remove leading + if present
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  // If starts with 0, assume Brazil and prepend 55
  if (cleaned.startsWith('0')) cleaned = '55' + cleaned.substring(1);
  // If doesn't start with country code (less than 12 digits), assume Brazil
  if (cleaned.length <= 11) cleaned = '55' + cleaned;
  return cleaned;
}

export async function sendWhatsAppTemplate(params: SendTemplateParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { credentials, recipientPhone, templateName, language, bodyParams, headerMediaUrl, headerMediaType } = params;

  const phone = normalizePhone(recipientPhone);

  // Build template components
  const components: TemplateComponent[] = [];

  // Header component (media)
  if (headerMediaUrl) {
    const mediaType = (headerMediaType || 'image').toLowerCase();
    const mediaParam: any = { type: mediaType };
    mediaParam[mediaType] = { link: headerMediaUrl };

    components.push({
      type: 'header',
      parameters: [mediaParam],
    });
  }

  // Body parameters
  if (bodyParams && Object.keys(bodyParams).length > 0) {
    const sortedKeys = Object.keys(bodyParams).sort((a, b) => parseInt(a) - parseInt(b));
    components.push({
      type: 'body',
      parameters: sortedKeys.map((key) => ({
        type: 'text',
        text: bodyParams[key] || '',
      })),
    });
  }

  const body: any = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
    },
  };

  if (components.length > 0) {
    body.template.components = components;
  }

  try {
    const res = await fetch(`${GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.text();
      return { success: false, error: `WhatsApp API ${res.status}: ${errorData}` };
    }

    const data = await res.json();
    const messageId = data.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}
