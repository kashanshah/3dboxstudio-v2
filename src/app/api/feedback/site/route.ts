import { NextResponse } from 'next/server';
import { parseFeedback } from '@/content/feedback';
import { enforceRateLimit, getClientIp } from '@/server/rate-limit';
import { getCurrentUser } from '@/server/auth/session';
import { createSiteFeedback } from '@/server/site-feedback';
import { sendAdminSiteFeedbackEmail } from '@/server/email/mailer';
import { verifyTurnstileToken } from '@/server/turnstile';
import { captureServerEvent, captureServerException } from '@/lib/posthog-server';

// Feedback from the Studio and the dieline generator: stored and emailed to
// the admin. Signed-in visitors are attached to their account.
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, 'feedback:site', { windowMs: 15 * 60 * 1000, max: 5 }); if (limited) return limited;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const parsed = parseFeedback(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const captcha = await verifyTurnstileToken(body?.turnstileToken, req); if (!captcha.ok) return NextResponse.json({ error: captcha.error }, { status: 403 });
  const user = await getCurrentUser().catch(() => null);
  const { request } = parsed;
  const saved = await createSiteFeedback(request, { account: user ? { id: user.id, email: user.email } : null, referrer: req.headers.get('referer'), ipAddress: getClientIp(req), userAgent: req.headers.get('user-agent') });
  try { await sendAdminSiteFeedbackEmail({ id: saved.id, subject: saved.subject, replyTo: saved.replyTo, lines: saved.lines, submittedAt: saved.createdAt }); }
  catch (error) { console.error('Site feedback admin email failed:', error); await captureServerException(error, `site_feedback:${saved.id}`); }
  await captureServerEvent(`site_feedback:${saved.id}`, 'site_feedback_submitted', { kind: request.kind, source: request.source, has_email: Boolean(saved.replyTo), signed_in: Boolean(user) });
  return NextResponse.json({ ok: true, id: saved.id });
}
