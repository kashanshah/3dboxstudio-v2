import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Webhook } from 'svix';
import { site } from '@/lib/site';
import { CampaignError, UUID, EMAIL } from '@/lib/email-campaigns';
import { ensureCampaignSchema, campaignSql } from './campaign-schema';
import { allResendRows, resendCampaignRequest } from './campaign-resend';

export const CAMPAIGN_WEBHOOK_EVENTS = ['email.sent','email.delivered','email.delivery_delayed','email.opened','email.clicked','email.bounced','email.complained','email.failed','email.suppressed'];
function encryptionKey() {
  const secret = process.env.EMAIL_CAMPAIGN_ENCRYPTION_KEY?.trim() || process.env.ADMIN_PASSWORD?.trim();
  if (!secret) throw new CampaignError('Configure EMAIL_CAMPAIGN_ENCRYPTION_KEY or ADMIN_PASSWORD before setting up webhooks.',503);
  return createHash('sha256').update(`3dboxstudio-campaign-webhook:${secret}`).digest();
}
export function encryptWebhookSecret(secret: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const encrypted = Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64url')).join('.');
}
export function decryptWebhookSecret(value: string) {
  const [iv,tag,data] = value.split('.').map(s=>Buffer.from(s,'base64url'));
  const cipher = createDecipheriv('aes-256-gcm',encryptionKey(),iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');
}
async function storedWebhookSecret() {
  if (process.env.RESEND_CAMPAIGN_WEBHOOK_SECRET?.trim()) return process.env.RESEND_CAMPAIGN_WEBHOOK_SECRET.trim();
  const rows = await campaignSql()`SELECT encrypted_secret FROM email_campaign_webhook WHERE id=1`;
  return rows.length ? decryptWebhookSecret(String(rows[0].encrypted_secret)) : null;
}
export async function webhookConfiguration() {
  await ensureCampaignSchema();
  const rows = await campaignSql()`SELECT provider_id,endpoint,last_received_at,configured_at FROM email_campaign_webhook WHERE id=1`;
  let ready = false;
  try { ready = Boolean(await storedWebhookSecret()); } catch { /* Show setup required after encryption-key rotation. */ }
  return { ready, endpoint: new URL('/api/webhooks/resend/campaigns',site.url).toString(), providerId: rows[0]?.provider_id as string | undefined, lastReceivedAt: rows[0]?.last_received_at ? new Date(String(rows[0].last_received_at)).toISOString() : null };
}
export async function configureCampaignWebhook() {
  await ensureCampaignSchema(); encryptionKey();
  const endpoint = new URL('/api/webhooks/resend/campaigns',site.url).toString();
  if (!endpoint.startsWith('https://') || new URL(endpoint).hostname === 'localhost') throw new CampaignError('Configure a public HTTPS NEXT_PUBLIC_SITE_URL first.');
  const hooks = await allResendRows<{id:string;endpoint:string}>('/webhooks');
  const existing = hooks.find(h=>h.endpoint === endpoint);
  let result: {id:string;signing_secret:string};
  if (existing) {
    await resendCampaignRequest(`/webhooks/${existing.id}`,'PATCH',{ events:CAMPAIGN_WEBHOOK_EVENTS,status:'enabled' });
    result = await resendCampaignRequest(`/webhooks/${existing.id}`);
  } else result = await resendCampaignRequest('/webhooks','POST',{ endpoint,events:CAMPAIGN_WEBHOOK_EVENTS });
  if (!UUID.test(result.id) || !result.signing_secret?.startsWith('whsec_')) throw new CampaignError('Resend did not return a webhook signing secret.',502);
  const encrypted = encryptWebhookSecret(result.signing_secret);
  await campaignSql()`INSERT INTO email_campaign_webhook(id,provider_id,encrypted_secret,endpoint) VALUES (1,${result.id},${encrypted},${endpoint}) ON CONFLICT(id) DO UPDATE SET provider_id=EXCLUDED.provider_id,encrypted_secret=EXCLUDED.encrypted_secret,endpoint=EXCLUDED.endpoint,configured_at=NOW()`;
  return webhookConfiguration();
}
export type CampaignWebhookEvent = { type: string; created_at: string; data: { broadcast_id?: string; email_id?: string; to?: string[]; click?: {link?: string}; bounce?: {type?:string;message?:string}; failed?: {reason?:string}; suppressed?: {reason?:string} } };
export async function verifyCampaignWebhook(payload: string, headers: Record<string,string>) {
  await ensureCampaignSchema();
  const secret = await storedWebhookSecret();
  if (!secret) throw new CampaignError('Campaign webhook is not configured.',503);
  try { new Webhook(secret).verify(payload,headers); return JSON.parse(payload) as CampaignWebhookEvent; }
  catch { throw new CampaignError('Invalid webhook signature.',401); }
}
export async function storeCampaignWebhook(eventId: string, event: CampaignWebhookEvent) {
  if (!CAMPAIGN_WEBHOOK_EVENTS.includes(event.type)) return;
  if (!event.data || !UUID.test(event.data.email_id || '') || !Number.isFinite(Date.parse(event.created_at))) throw new CampaignError('Invalid webhook event.');
  const broadcastId = UUID.test(event.data.broadcast_id || '') ? event.data.broadcast_id! : null;
  const link = event.type === 'email.clicked' && typeof event.data.click?.link === 'string' ? event.data.click.link.slice(0,4000) : null;
  const detail = { reason: event.data.failed?.reason || event.data.suppressed?.reason || event.data.bounce?.message || '', bounceType: event.data.bounce?.type || '', test: !broadcastId };
  for (const recipient of (Array.isArray(event.data.to) ? event.data.to : []).filter(r=>typeof r==='string' && EMAIL.test(r) && r.length<=254)) {
    const key = `${eventId}:${createHash('sha256').update(recipient.toLowerCase()).digest('hex').slice(0,24)}`;
    await campaignSql()`INSERT INTO email_campaign_events(event_id,broadcast_id,email_id,event_type,recipient,link,occurred_at,detail) VALUES (${key},${broadcastId},${event.data.email_id!},${event.type},${recipient.toLowerCase()},${link},${event.created_at}::timestamptz,${JSON.stringify(detail)}::jsonb) ON CONFLICT(event_id) DO NOTHING`;
  }
  await campaignSql()`UPDATE email_campaign_webhook SET last_received_at=NOW() WHERE id=1`;
}
