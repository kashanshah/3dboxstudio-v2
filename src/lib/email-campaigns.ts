export const CAMPAIGN_EVENTS = ['sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'suppressed'] as const;
export type CampaignEvent = typeof CAMPAIGN_EVENTS[number];
export type CampaignContent = { name: string; subject: string; previewText: string; from: string; replyTo: string; segmentId: string; postalAddress: string; html: string; text: string };
export type Campaign = CampaignContent & { id: string; revision: number; status: string; broadcastId: string | null; scheduledAt: string | null; timeZone: string; testedRevision: number | null; testEmailId: string | null; testRecipient: string | null; testedAt: string | null; metrics: Record<string, number>; metricsAt: string | null; lastError: string | null; createdAt: string; updatedAt: string; busy: boolean };
export type Segment = { id: string; name: string };
export type ImportJob = { id: string; segmentId: string; filter: string; total: number; processed: number; skipped: number; status: string; error: string | null };
export type CampaignReview = { revision: number; eligible: number; unsubscribed: number; segmentName: string; fingerprint: string; domain: { id: string; name: string; status: string; open_tracking?: boolean; click_tracking?: boolean }; usage: Record<string, unknown>; webhookReady: boolean };

export class CampaignError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
export function requireId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new CampaignError('Invalid identifier.');
  return value;
}
export function senderEmail(value: string): string {
  const email = value.match(/<([^<>]+)>$/)?.[1] || value;
  if (!EMAIL.test(email) || /[\r\n]/.test(value)) throw new CampaignError('Enter a valid sender email address.');
  return email.toLowerCase();
}
export function validateContent(value: unknown): CampaignContent {
  if (!value || typeof value !== 'object') throw new CampaignError('Enter campaign details.');
  const input = value as Record<string, unknown>;
  const content = {} as CampaignContent;
  for (const [key, max] of Object.entries({ name: 150, subject: 200, previewText: 300, from: 200, replyTo: 254, segmentId: 36, postalAddress: 500, html: 200_000, text: 100_000 })) {
    const val = input[key];
    if (typeof val !== 'string' || val.length > max) throw new CampaignError(`Invalid ${key}.`);
    content[key as keyof CampaignContent] = val.trim();
  }
  if (!content.name || !content.subject || !content.html || !content.text) throw new CampaignError('Name, subject, HTML and plain text are required.');
  if (/[\r\n]/.test(content.subject)) throw new CampaignError('Subject must be a single line.');
  senderEmail(content.from);
  if (content.replyTo && !EMAIL.test(content.replyTo)) throw new CampaignError('Enter a valid reply-to address.');
  if (content.segmentId) requireId(content.segmentId);
  if (/<\s*(script|iframe|object|embed|form|base)\b|\son\w+\s*=|javascript\s*:/i.test(content.html)) throw new CampaignError('Email HTML must not contain active content.');
  const supported = /^(RESEND_UNSUBSCRIBE_URL|(?:contact\.)?(?:FIRST_NAME|LAST_NAME|EMAIL|first_name|last_name|email)(?:\|[^{}]*)?)$/;
  for (const match of `${content.html}\n${content.text}`.matchAll(/\{\{\{([^{}]+)\}\}\}/g)) {
    if (!supported.test(match[1])) throw new CampaignError(`Unsupported personalization variable: ${match[1]}`);
  }
  return content;
}
export function validateSendContent(content: CampaignContent) {
  if (!content.segmentId) throw new CampaignError('Choose a recipient segment.');
  if (!content.postalAddress) throw new CampaignError('Add the sender’s postal address for the email footer.');
  if (!/<a\b[^>]*\shref\s*=\s*["']\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}["']/i.test(content.html) || !content.text.includes('{{{RESEND_UNSUBSCRIBE_URL}}}')) throw new CampaignError('Include a clickable Resend unsubscribe link in the HTML and its URL in plain text.');
}
export function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
export function renderCampaign(content: CampaignContent, test = false) {
  const footer = `<p style="font:12px/20px Arial,sans-serif;color:#64748b;text-align:center;padding:20px">${escapeHtml(content.postalAddress)}${test ? '<br>Test email — unsubscribe link is inactive.' : ''}</p>`;
  let html = /<\/body>/i.test(content.html) ? content.html.replace(/<\/body>/i, `${footer}</body>`) : `${content.html}${footer}`;
  let text = `${content.text}\n\n${content.postalAddress}${test ? '\nTest email — unsubscribe link is inactive.' : ''}`;
  const render = (source: string, isHtml: boolean) => source.replace(/\{\{\{([^{}]+)\}\}\}/g, (_, variable: string) => {
    if (variable === 'RESEND_UNSUBSCRIBE_URL') return '#test-unsubscribe';
    const [key, fallback] = variable.split('|');
    const value = fallback ?? ({ first_name: 'Alex', last_name: 'Preview', email: 'preview@example.com' }[key.replace('contact.', '').toLowerCase()] || '');
    return isHtml ? escapeHtml(value) : value;
  });
  if (test) { html = render(html, true); text = render(text, false); }
  return { html, text };
}

/** Resolve a wall time in the selected IANA zone, rejecting nonexistent/ambiguous DST times. */
export function campaignScheduleIso(wall: string, zone: string, now = Date.now()): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall)) throw new CampaignError('Choose a date and time.');
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { throw new CampaignError('Choose a valid time zone.'); }
  const target = Date.parse(`${wall}:00Z`);
  if (!Number.isFinite(target)) throw new CampaignError('Invalid schedule date.');
  const candidates: number[] = [];
  // Real-world UTC offsets are multiples of 15 minutes within ±14 hours.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const stamp = target + offset * 60_000;
    if (formatter.format(new Date(stamp)).replace(' ', 'T') === wall) candidates.push(stamp);
  }
  if (candidates.length !== 1) throw new CampaignError('This local time is skipped or repeated by daylight saving. Choose a different time.');
  if (candidates[0] < now + 5 * 60_000) throw new CampaignError('Schedule at least five minutes in the future.');
  return new Date(candidates[0]).toISOString();
}

export function launchCampaignDefaults(from: string): CampaignContent {
  const url = 'https://www.3dboxstudio.com/whats-new/v2?utm_source=resend&utm_medium=email&utm_campaign=v2_launch&utm_content=announcement';
  const studio = 'https://www.3dboxstudio.com/studio?utm_source=resend&utm_medium=email&utm_campaign=v2_launch&utm_content=studio_cta';
  return { name: 'V2 launch announcement', subject: '3DBoxStudio V2 is here — see what’s new', previewText: 'A new workflow for designing, previewing and sharing your packaging.', from, replyTo: '', segmentId: '', postalAddress: '',
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#101720"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px"><table role="presentation" width="100%" style="max-width:600px" cellpadding="0" cellspacing="0"><tr><td style="padding:20px"><img src="https://www.3dboxstudio.com/brand/logo-horizontal-light.png" width="170" alt="3D Box Studio" style="display:block;max-width:100%;height:auto"></td></tr><tr><td style="padding:28px;background:#101720;color:#fff"><h1 style="font-size:30px;line-height:38px;margin:0">Meet your new Studio.</h1></td></tr><tr><td style="padding:28px;background:#fff;font-size:16px;line-height:26px"><p>Hi {{{contact.first_name|there}}},</p><p>3DBoxStudio V2 is live. Choose your box and size, design on the flat dieline, then preview the same artwork in 3D.</p><img src="https://www.3dboxstudio.com/images/v2-launch/studio-design-artwork.png" width="544" alt="Artwork editor with a live 3D packaging preview" style="width:100%;height:auto;border:0"><ul><li>A clearer Box → Design → Preview &amp; Download workflow</li><li>Projects to organize related box designs</li><li>Materials, finishes, sharing and exports in one place</li></ul><p>Your existing account still works. Sign in to explore the new Studio.</p><p><a href="${escapeHtml(studio)}" style="display:inline-block;padding:14px 24px;background:#0075c4;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Open the new Studio</a></p><p><a href="${escapeHtml(url)}">See what’s new in V2</a></p><p style="font-size:12px;color:#64748b">You’re receiving this product update from 3D Box Studio. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe from updates</a></p></td></tr></table></td></tr></table></body></html>`,
    text: `Hi {{{contact.first_name|there}}},\n\n3DBoxStudio V2 is live. Choose your box and size, design on the flat dieline, then preview the same artwork in 3D.\n\n• A clearer Box → Design → Preview & Download workflow\n• Projects to organize related box designs\n• Materials, finishes, sharing and exports in one place\n\nYour existing account still works.\n\nOpen the new Studio: ${studio}\nSee what’s new: ${url}\n\nUnsubscribe from updates: {{{RESEND_UNSUBSCRIBE_URL}}}` };
}
