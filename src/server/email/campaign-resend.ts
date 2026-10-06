import { CampaignError } from '@/lib/email-campaigns';

export class ResendCampaignError extends CampaignError {
  constructor(message: string, public providerStatus: number) { super(message, providerStatus === 429 ? 429 : 502); }
}
export type ProviderPage<T> = { data: T[]; has_more: boolean };
export type ProviderContact = { id: string; email: string; first_name?: string; last_name?: string; unsubscribed: boolean };
export type ProviderBroadcast = { id: string; name: string; status: string; scheduled_at?: string; sent_at?: string };
export type ProviderDomain = { id: string; name: string; status: string; open_tracking?: boolean; click_tracking?: boolean };

// Bounded retries only for provider throttling. Never blindly retry a send after a timeout.
export async function resendCampaignRequest<T>(path: string, method = 'GET', body?: unknown, idempotencyKey?: string): Promise<T> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new CampaignError('RESEND_API_KEY is not configured.', 503);
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 550));
    let response: Response;
    try {
      response = await fetch(`https://api.resend.com${path}`, { method, cache: 'no-store', signal: AbortSignal.timeout(12_000), headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch { throw new CampaignError('Resend did not confirm the request. Refresh status before trying again.', 502); }
    if (response.status === 429 && attempt < 2) {
      const delay = Math.max(1, Math.min(4, Number(response.headers.get('retry-after')) || attempt + 1));
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      continue;
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ResendCampaignError(typeof data?.message === 'string' ? data.message.slice(0, 700) : `Resend request failed (${response.status}).`, response.status);
    if (!data || typeof data !== 'object') throw new CampaignError('Resend returned an invalid response.', 502);
    return data as T;
  }
  throw new CampaignError('Resend is busy. Try again shortly.', 429);
}
export async function allResendRows<T extends { id: string }>(path: string): Promise<T[]> {
  const rows: T[] = [];
  let after = '';
  const startedAt = Date.now();
  for (let page = 0; page < 100; page++) {
    if (Date.now()-startedAt > 30_000) throw new CampaignError('This list took too long to review completely. Use a smaller segment.',422);
    const separator = path.includes('?') ? '&' : '?';
    const result = await resendCampaignRequest<ProviderPage<T>>(`${path}${separator}limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    if (!Array.isArray(result.data)) throw new CampaignError('Resend returned an invalid list.', 502);
    rows.push(...result.data);
    if (!result.has_more) return rows;
    const next = result.data.at(-1)?.id;
    if (!next || next === after) throw new CampaignError('Resend pagination did not advance.', 502);
    after = next;
    await new Promise(resolve => setTimeout(resolve, 550));
  }
  throw new CampaignError('This list is too large for one review. Use a smaller segment.', 422);
}
