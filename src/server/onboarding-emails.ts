import { randomBytes } from 'node:crypto';
import { site } from '@/lib/site';
import { isFeatureOn } from '@/lib/features';
import { getSql } from '@/server/db';
import { adminAlertEmail, sendEmail } from '@/server/email/mailer';
import { renderOnboardingFollowUpTemplate, renderWelcomeTemplate } from '@/server/email/templates';
import { alertAdmin } from '@/server/ops-alerts';

// Onboarding emails, behind the welcomeEmails feature: a welcome once an
// account is verified (email sign-up) or created with Google, and one
// follow-up 3 days later from the daily job (/api/cron/onboarding-emails).
// Only people who got the welcome get the follow-up, so turning this on never
// emails the accounts made before it. Each send is claimed in the database
// first, so a retry or a second instance never sends twice; a failed send
// releases the claim for the next run.

export const FOLLOW_UP_AFTER_DAYS = 3;
/** Past this, a follow-up that could not go out is dropped rather than sent late. */
export const FOLLOW_UP_WITHIN_DAYS = 10;
/** Resend allows about two requests a second; this keeps a run inside its time limit. */
export const FOLLOW_UPS_PER_RUN = 40;

type Recipient = { id: string; email: string; name: string | null; email_unsubscribe_token: string };

export function unsubscribeUrl(token: string) {
  const url = new URL('/unsubscribe', process.env.AUTH_APP_URL?.trim() || site.url);
  url.searchParams.set('token', token);
  return url.toString();
}
/** One-click unsubscribe for mail clients (RFC 8058), next to the link in the email. */
function unsubscribeHeaders(token: string) {
  const url = new URL('/api/email/unsubscribe', process.env.AUTH_APP_URL?.trim() || site.url);
  url.searchParams.set('t', token);
  return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}
const newToken = () => randomBytes(24).toString('base64url');
const replyTo = () => adminAlertEmail().catch(() => undefined);

export const CLAIM_WELCOME_SQL = `UPDATE users SET welcome_email_sent_at=NOW(), email_unsubscribe_token=COALESCE(email_unsubscribe_token,$2)
 WHERE id=$1 AND welcome_email_sent_at IS NULL AND email_verified_at IS NOT NULL AND email_unsubscribed_at IS NULL
 AND created_at>NOW()-INTERVAL '30 days'
 RETURNING id,email,name,email_unsubscribe_token`;

/** Sends the welcome email once; returns whether it was sent. */
export async function sendWelcomeEmail(userId: string): Promise<boolean> {
  if (!isFeatureOn('welcomeEmails')) return false;
  const sql = getSql();
  const [user] = await sql.query(CLAIM_WELCOME_SQL, [userId, newToken()]) as Recipient[];
  if (!user) return false;
  try {
    const reply = await replyTo();
    await sendEmail({ to: user.email, ...renderWelcomeTemplate({ name: user.name, unsubscribeUrl: unsubscribeUrl(user.email_unsubscribe_token) }), ...(reply ? { replyTo: reply } : {}), headers: unsubscribeHeaders(user.email_unsubscribe_token) });
    return true;
  } catch (error) {
    await sql`UPDATE users SET welcome_email_sent_at=NULL WHERE id=${user.id}`;
    throw error;
  }
}
/** For sign-up routes: a welcome that fails must never fail the sign-up. */
export async function sendWelcomeEmailSafely(userId: string) {
  await sendWelcomeEmail(userId).catch(error => alertAdmin('email_delivery', 'Welcome email failed', { userId }, error));
}

export const CLAIM_FOLLOW_UPS_SQL = `WITH due AS (
 SELECT id FROM users
 WHERE follow_up_email_sent_at IS NULL AND email_unsubscribed_at IS NULL AND email_unsubscribe_token IS NOT NULL
 AND welcome_email_sent_at<=NOW()-make_interval(days=>$2) AND welcome_email_sent_at>NOW()-make_interval(days=>$3)
 ORDER BY welcome_email_sent_at LIMIT $1 FOR UPDATE SKIP LOCKED
) UPDATE users u SET follow_up_email_sent_at=NOW() FROM due WHERE u.id=due.id
 RETURNING u.id,u.email,u.name,u.email_unsubscribe_token,EXISTS(SELECT 1 FROM projects p WHERE p.user_id=u.id) AS has_design`;

/** The daily job: sends the follow-ups that are due. */
export async function sendDueFollowUps(limit = FOLLOW_UPS_PER_RUN): Promise<{ sent: number; failed: number }> {
  if (!isFeatureOn('welcomeEmails')) return { sent: 0, failed: 0 };
  const sql = getSql();
  const due = await sql.query(CLAIM_FOLLOW_UPS_SQL, [limit, FOLLOW_UP_AFTER_DAYS, FOLLOW_UP_WITHIN_DAYS]) as (Recipient & { has_design: boolean })[];
  const reply = due.length ? await replyTo() : undefined;
  let sent = 0, failed = 0;
  for (const user of due) {
    try {
      await sendEmail({ to: user.email, ...renderOnboardingFollowUpTemplate({ name: user.name, hasDesign: user.has_design, unsubscribeUrl: unsubscribeUrl(user.email_unsubscribe_token) }), ...(reply ? { replyTo: reply } : {}), headers: unsubscribeHeaders(user.email_unsubscribe_token) });
      sent++;
    } catch (error) {
      failed++;
      await sql`UPDATE users SET follow_up_email_sent_at=NULL WHERE id=${user.id}`;
      if (failed === 1) await alertAdmin('email_delivery', 'Welcome follow-up email failed', { userId: user.id }, error);
    }
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  return { sent, failed };
}

/** Stops onboarding emails for the account the token belongs to. Unknown tokens are ignored. */
export async function unsubscribe(token: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return;
  await getSql()`UPDATE users SET email_unsubscribed_at=COALESCE(email_unsubscribed_at,NOW()) WHERE email_unsubscribe_token=${token}`;
}
