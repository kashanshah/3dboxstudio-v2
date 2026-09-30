import { randomBytes } from 'node:crypto';
import { ensureV2Schema, getSql } from './db';

export type ContactSubmission = {
  id:string; name:string|null; email:string; topic:string|null; subject:string|null; message:string|null;
  status:string; createdAt:string; pagePath:string|null;
};

export async function createContactSubmission(input: {name:string;email:string;topic:string;subject:string;message:string;locale?:string|null;pagePath?:string|null;referrer?:string|null;ipAddress?:string|null;userAgent?:string|null}) {
  await ensureV2Schema();
  const id=randomBytes(9).toString('hex');
  const db=getSql();
  const rows=await db`
    INSERT INTO contact_submissions (id,email,name,topic,subject,message,locale,page_path,referrer,ip_address,user_agent)
    VALUES (${id},${input.email.trim().toLowerCase()},${input.name},${input.topic},${input.subject},${input.message},${input.locale??null},${input.pagePath??null},${input.referrer??null},${input.ipAddress??null},${input.userAgent??null})
    RETURNING created_at
  ` as {created_at:string}[];
  return { id, createdAt: rows[0]?.created_at ?? new Date().toISOString() };
}
export async function listContactSubmissions(limit=100): Promise<ContactSubmission[]> {
  await ensureV2Schema();
  const db=getSql();
  const rows=await db`SELECT id,name,email,topic,subject,message,status,created_at,page_path FROM contact_submissions ORDER BY created_at DESC LIMIT ${limit}` as {id:string;name:string|null;email:string;topic:string|null;subject:string|null;message:string|null;status:string;created_at:string;page_path:string|null}[];
  return rows.map(r=>({...r,createdAt:r.created_at,pagePath:r.page_path}));
}
