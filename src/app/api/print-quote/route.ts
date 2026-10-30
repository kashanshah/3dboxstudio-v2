import { NextResponse } from 'next/server';
import { countryCode, parseQuoteRequest, parseWaitlistRequest, printsIn, quoteLines } from '@/content/print-quote';
import { isFeatureOn } from '@/lib/features';
import { enforceRateLimit, getClientIp } from '@/server/rate-limit';
import { createPrintQuote, createPrintWaitlist } from '@/server/print-quotes';
import { sendAdminPrintQuoteEmail } from '@/server/email/mailer';
import { verifyTurnstileToken } from '@/server/turnstile';
import { captureServerEvent, captureServerException } from '@/lib/posthog-server';

// The visitor's country, from the host's location header, so the form can
// start on it and say whether printing is offered there.
export function GET(req: Request) {
  if (!isFeatureOn('printQuote')) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const country = countryCode(req.headers.get('x-vercel-ip-country'));
  return NextResponse.json({ country, prints: printsIn(country) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

// "Get this box printed": stores the request and emails it to the admin. From
// a country printing isn't offered in yet, stores a waitlist email instead.
export async function POST(req: Request) {
  if (!isFeatureOn('printQuote')) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const limited = enforceRateLimit(req, 'print-quote:submit', { windowMs: 15 * 60 * 1000, max: 5 }); if (limited) return limited;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.waitlist === true) {
    const waitlist = parseWaitlistRequest(body);
    if (!waitlist.ok) return NextResponse.json({ error: waitlist.error }, { status: 400 });
    const check = await verifyTurnstileToken(body.turnstileToken, req); if (!check.ok) return NextResponse.json({ error: check.error }, { status: 403 });
    const saved = await createPrintWaitlist(waitlist.request, { pagePath: typeof body.pagePath === 'string' ? body.pagePath.slice(0, 200) : null, ipAddress: getClientIp(req), userAgent: req.headers.get('user-agent') });
    await captureServerEvent(`print_waitlist:${saved.id}`, 'print_waitlist_joined', { box_type: waitlist.request.box.style, country: waitlist.request.country, source: waitlist.request.box.source });
    return NextResponse.json({ ok: true, id: saved.id });
  }
  const parsed = parseQuoteRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const captcha = await verifyTurnstileToken(body?.turnstileToken, req); if (!captcha.ok) return NextResponse.json({ error: captcha.error }, { status: 403 });
  const { request } = parsed;
  const saved = await createPrintQuote(request, { locale: typeof body?.locale === 'string' ? body.locale.slice(0, 16) : null, pagePath: request.box.link.split('?')[0].slice(0, 200), referrer: req.headers.get('referer'), ipAddress: getClientIp(req), userAgent: req.headers.get('user-agent') });
  try { await sendAdminPrintQuoteEmail({ id: saved.id, subject: saved.subject, email: request.email, name: request.name, lines: quoteLines(request), submittedAt: saved.createdAt }); }
  catch (error) { console.error('Print quote admin email failed:', error); await captureServerException(error, `print_quote:${saved.id}`); }
  await captureServerEvent(`print_quote:${saved.id}`, 'print_quote_submitted', { box_type: request.box.style, quantity: request.quantity, country: request.country, source: request.box.source ?? 'generator' });
  return NextResponse.json({ ok: true, id: saved.id });
}
