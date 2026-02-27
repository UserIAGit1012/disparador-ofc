// Meta WhatsApp Business API pricing (Brazil)
// Reference: https://developers.facebook.com/docs/whatsapp/pricing

export const META_PRICES_USD: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0100,
  AUTHENTICATION: 0.0315,
  SERVICE: 0.0000, // free within 24h window
};

export const BRL_RATE = 5.5; // USD to BRL approximate rate

export function getMessageCostUsd(category: string): number {
  const upper = (category || 'MARKETING').toUpperCase();
  return META_PRICES_USD[upper] ?? META_PRICES_USD.MARKETING;
}

export function estimateCostUsd(messageCount: number, category: string): number {
  return messageCount * getMessageCostUsd(category);
}

export function usdToBrl(usd: number): number {
  return usd * BRL_RATE;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function formatBrl(value: number): string {
  return `R$${value.toFixed(2)}`;
}

export function estimateTimeSeconds(messageCount: number, delayMin: number, delayMax: number): number {
  if (messageCount <= 1) return 0;
  const avgDelay = (delayMin + delayMax) / 2;
  return (messageCount - 1) * avgDelay;
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.ceil((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}
