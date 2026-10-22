import { randomBytes } from 'node:crypto';
import { ensureV2Schema, getSql } from './db';
import { feedbackKindLabel, feedbackLines, type FeedbackRequest } from '@/content/feedback';

// Site feedback from the Studio and the dieline generator, stored with the
// contact messages (kind 'site_feedback') so it shows in the admin inbox; the
// full message, where it came from and its context are kept in the payload.

export async function createSiteFeedback(request: FeedbackRequest, meta: { account: { id: string; email: string } | null; referrer?: string | null; ipAddress?: string | null; userAgent?: string | null }) {
  await ensureV2Schema();
  const id = randomBytes(9).toString('hex');
  const email = (request.email ?? meta.account?.email ?? '').toLowerCase();
  const subject = `${feedbackKindLabel(request.kind)}: ${request.message.replace(/\s+/g, ' ').slice(0, 80)}`;
  const lines = feedbackLines(request, meta.account?.email ?? null);
  const message = lines.map(([label, value]) => `${label}: ${value}`).join('\n');
  const rows = await getSql()`
    INSERT INTO contact_submissions (id,kind,source,email,topic,subject,message,page_path,referrer,ip_address,user_agent,payload)
    VALUES (${id},'site_feedback',${request.source},${email},${request.kind},${subject},${message},${request.pagePath},${meta.referrer ?? null},${meta.ipAddress ?? null},${meta.userAgent ?? null},${JSON.stringify({ ...request, userId: meta.account?.id ?? null })}::jsonb)
    RETURNING created_at
  ` as { created_at: string }[];
  return { id, subject, lines, replyTo: email || null, createdAt: rows[0]?.created_at ?? new Date().toISOString() };
}
