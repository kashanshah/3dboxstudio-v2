import { randomBytes } from 'node:crypto';
import { ensureV2Schema, getSql } from './db';
import { countryName, quoteLines, type QuoteRequest, type WaitlistRequest } from '@/content/print-quote';

// "Get this box printed" requests, stored with the contact messages (kind
// 'print_quote') so they show in the admin inbox; the full request is kept in
// the payload.

export async function createPrintQuote(request: QuoteRequest, meta: { locale?: string | null; pagePath?: string | null; referrer?: string | null; ipAddress?: string | null; userAgent?: string | null }) {
  await ensureV2Schema();
  const id = randomBytes(9).toString('hex');
  const subject = `Print quote: ${request.box.styleName}, ${request.quantity}`;
  const message = quoteLines(request).map(([label, value]) => `${label}: ${value}`).join('\n');
  const rows = await getSql()`
    INSERT INTO contact_submissions (id,kind,source,email,name,topic,subject,message,locale,page_path,referrer,ip_address,user_agent,payload)
    VALUES (${id},'print_quote','dieline_generator',${request.email.toLowerCase()},${request.name},'print_quote',${subject},${message},${meta.locale ?? null},${meta.pagePath ?? null},${meta.referrer ?? null},${meta.ipAddress ?? null},${meta.userAgent ?? null},${JSON.stringify(request)}::jsonb)
    RETURNING created_at
  ` as { created_at: string }[];
  return { id, subject, createdAt: rows[0]?.created_at ?? new Date().toISOString() };
}

/** "Tell me when printing is available in my country": kept in the same inbox, kind 'print_waitlist'. */
export async function createPrintWaitlist(request: WaitlistRequest, meta: { pagePath?: string | null; ipAddress?: string | null; userAgent?: string | null }) {
  await ensureV2Schema();
  const id = randomBytes(9).toString('hex');
  const country = countryName(request.country);
  const subject = `Print waitlist: ${country}`;
  const message = `Email when printing is available in ${country} (${request.country}).\nBox: ${request.box.styleName}\nSent from: ${request.box.source === 'studio' ? 'Studio' : 'Dieline generator'}`;
  await getSql()`
    INSERT INTO contact_submissions (id,kind,source,email,name,topic,subject,message,locale,page_path,referrer,ip_address,user_agent,payload)
    VALUES (${id},'print_waitlist',${request.box.source === 'studio' ? 'studio' : 'dieline_generator'},${request.email.toLowerCase()},${null},'print_waitlist',${subject},${message},${'en'},${meta.pagePath ?? null},${null},${meta.ipAddress ?? null},${meta.userAgent ?? null},${JSON.stringify(request)}::jsonb)
  `;
  return { id };
}
