import { NextResponse } from 'next/server';
import { parseQuoteRequest, quoteLines } from '@/content/print-quote';
import { isFeatureOn } from '@/lib/features';
import { enforceRateLimit, getClientIp } from '@/server/rate-limit';
import { createPrintQuote } from '@/server/print-quotes';
import { sendAdminPrintQuoteEmail } from '@/server/email/mailer';
import { verifyTurnstileToken } from '@/server/turnstile';
import { captureServerEvent, captureServerException } from '@/lib/posthog-server';

// "Get this box printed": stores the request and emails it to the admin.
export async function POST(req: Request) {
  if (!isFeatureOn('printQuote')) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const limited = enforceRateLimit(req, 'print-quote:submit', { windowMs: 15 * 60 * 1000, max: 5 }); if (limited) return limited;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const parsed = parseQuoteRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const captcha = await verifyTurnstileToken(body?.turnstileToken, req); if (!captcha.ok) return NextResponse.json({ error: captcha.error }, { status: 403 });
  const { request } = parsed;
  const saved = await createPrintQuote(request, { locale: typeof body?.locale === 'string' ? body.locale.slice(0, 16) : null, pagePath: request.box.link.split('?')[0].slice(0, 200), referrer: req.headers.get('referer'), ipAddress: getClientIp(req), userAgent: req.headers.get('user-agent') });
  try { await sendAdminPrintQuoteEmail({ id: saved.id, subject: saved.subject, email: request.email, name: request.name, lines: quoteLines(request), submittedAt: saved.createdAt }); }
  catch (error) { console.error('Print quote admin email failed:', error); await captureServerException(error, `print_quote:${saved.id}`); }
  await captureServerEvent(`print_quote:${saved.id}`, 'print_quote_submitted', { box_type: request.box.style, quantity: request.quantity, country: request.country });
  return NextResponse.json({ ok: true, id: saved.id });
}
