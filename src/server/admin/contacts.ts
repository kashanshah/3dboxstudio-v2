import { ensureV2Schema, getSql } from '@/server/db';

// Contact form messages for the admin: this site's and the previous site's
// (kept read-only), with the account that uses the same address.

export const CONTACT_STATUSES = ['new', 'handled'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export type AdminContact = {
  id: string;
  legacy: boolean;
  name: string | null;
  email: string;
  topic: string | null;
  subject: string | null;
  message: string | null;
  status: string;
  pagePath: string | null;
  createdAt: string | null;
  user: { id: string; name: string } | null;
};

const PAGE_SIZE = 25;

export async function listAdminContacts(input: { q?: string; status?: string; page?: number } = {}) {
  await ensureV2Schema();
  const q = (input.q ?? '').trim().slice(0, 80);
  const status = input.status === 'new' || input.status === 'handled' ? input.status : '';
  const page = input.page && input.page > 0 ? input.page : 1;
  const rows = await getSql().query(`
    WITH contacts AS (
      SELECT c.id, false AS legacy, c.name, c.email, c.topic, c.subject, c.message, c.status, c.page_path, c.created_at
      FROM contact_submissions c
      UNION ALL
      SELECT lr.source || ':' || lr.source_id, true, NULLIF(lr.payload->>'name',''), COALESCE(lr.payload->>'email',''),
        NULLIF(lr.payload->>'topic',''), NULLIF(lr.payload->>'subject',''), NULLIF(lr.payload->>'message',''),
        COALESCE(NULLIF(lr.payload->>'status',''), 'handled'), NULLIF(lr.payload->>'page_path',''), admin_ts(lr.payload->>'created_at')
      FROM legacy_records lr WHERE lr.entity_type='contact_submissions' AND lr.deleted_at IS NULL
    )
    SELECT c.*, u.id AS user_id, COALESCE(NULLIF(u.name,''), u.email) AS user_name, COUNT(*) OVER()::int AS total
    FROM contacts c
    LEFT JOIN LATERAL (SELECT id, name, email FROM users WHERE lower(trim(email))=lower(trim(c.email)) LIMIT 1) u ON true
    WHERE ($1='' OR (CASE WHEN c.status='new' THEN 'new' ELSE 'handled' END)=$1)
      AND ($2='' OR strpos(lower(concat_ws(' ', c.name, c.email, c.subject, c.message, c.topic)), lower($2))>0)
    ORDER BY c.created_at DESC NULLS LAST, c.id
    LIMIT $3 OFFSET $4
  `, [status, q, PAGE_SIZE, (page - 1) * PAGE_SIZE]) as {
    id: string; legacy: boolean; name: string | null; email: string; topic: string | null; subject: string | null; message: string | null;
    status: string; page_path: string | null; created_at: string | Date | null; user_id: string | null; user_name: string | null; total: number;
  }[];
  const items: AdminContact[] = rows.map((row) => ({
    id: row.id,
    legacy: Boolean(row.legacy),
    name: row.name?.trim() || null,
    email: row.email,
    topic: row.topic,
    subject: row.subject,
    message: row.message,
    status: row.status === 'new' ? 'new' : 'handled',
    pagePath: row.page_path,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    user: row.user_id ? { id: row.user_id, name: row.user_name || row.email } : null,
  }));
  return { items, total: Number(rows[0]?.total ?? 0), page, pageSize: PAGE_SIZE, status, q };
}

export async function setContactStatus(id: string, status: ContactStatus): Promise<boolean> {
  await ensureV2Schema();
  const rows = await getSql().query(
    'UPDATE contact_submissions SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING id',
    [id, status],
  ) as { id: string }[];
  return rows.length > 0;
}
