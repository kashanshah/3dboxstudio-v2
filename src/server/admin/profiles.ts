import { ensureV2Schema, getSql } from '@/server/db';
import { decodeRouteParam } from '@/lib/route-params';
import { getUser, getDesign, listUserProjects, type AdminDesignDetail, type AdminUserDetail, type AdminUserProjectItem } from './catalog';

// Everything the admin shows about one user or one design, in one load, for
// the detail panel beside a list and for the full pages.

export type AdminFeedbackItem = {
  rating: number;
  comment: string | null;
  format: string;
  templateId: string;
  createdAt: string | null;
  design: { id: string; name: string } | null;
};

export type AdminContactItem = {
  id: string;
  subject: string | null;
  message: string | null;
  status: string;
  createdAt: string | null;
};

export type AdminUserProfile = AdminUserDetail & {
  campaignDetail: { medium: string | null; term: string | null; content: string | null; referrer: string | null; conversionPage: string | null };
  providers: string[];
  activeShares: number;
  projects: AdminUserProjectItem[];
  feedback: AdminFeedbackItem[];
  contacts: AdminContactItem[];
};

export type AdminDesignProfile = AdminDesignDetail & {
  feedback: AdminFeedbackItem[];
};

function iso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type FeedbackRow = { rating: number; comment: string | null; export_format: string; template_id: string; created_at: string | Date | null; project_id: string | null; project_name: string | null };

function presentFeedback(row: FeedbackRow): AdminFeedbackItem {
  return {
    rating: Number(row.rating),
    comment: row.comment?.trim() || null,
    format: row.export_format,
    templateId: row.template_id,
    createdAt: iso(row.created_at),
    design: row.project_id ? { id: row.project_id, name: row.project_name?.trim() || 'Untitled' } : null,
  };
}

export async function getUserProfile(id: string): Promise<AdminUserProfile | null> {
  await ensureV2Schema();
  const sql = getSql();
  const [user, extra, projects, feedback, contacts] = await Promise.all([
    getUser(id),
    sql.query(`
      SELECT u.utm_medium, u.utm_term, u.utm_content, u.signup_referrer, u.signup_conversion_page,
        COALESCE((SELECT array_agg(DISTINCT o.provider) FROM oauth_accounts o WHERE o.user_id=u.id), '{}') AS providers,
        (SELECT COUNT(*)::int FROM design_shares s WHERE s.user_id=u.id AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>NOW())) AS active_shares
      FROM users u WHERE u.id=$1
    `, [id]).then((result) => result as Record<string, unknown>[]),
    listUserProjects(id, { pageSize: 50 }),
    sql.query(`
      SELECT f.rating, f.comment, f.export_format, f.template_id, f.created_at, f.project_id, p.name AS project_name
      FROM export_feedback f LEFT JOIN projects p ON p.id=f.project_id
      WHERE f.user_id=$1 ORDER BY f.created_at DESC LIMIT 20
    `, [id]).then((result) => result as FeedbackRow[]),
    sql.query(`
      SELECT c.id, c.subject, c.message, c.status, c.created_at
      FROM contact_submissions c JOIN users u ON lower(trim(c.email))=lower(trim(u.email))
      WHERE u.id=$1 ORDER BY c.created_at DESC LIMIT 20
    `, [id]).then((result) => result as { id: string; subject: string | null; message: string | null; status: string; created_at: string | Date | null }[]),
  ]);
  if (!user) return null;
  const row = extra[0] ?? {};
  const text = (key: string) => typeof row[key] === 'string' && (row[key] as string).trim() ? (row[key] as string).trim() : null;
  return {
    ...user,
    campaignDetail: { medium: text('utm_medium'), term: text('utm_term'), content: text('utm_content'), referrer: text('signup_referrer'), conversionPage: text('signup_conversion_page') },
    providers: Array.isArray(row.providers) ? (row.providers as unknown[]).filter((item): item is string => typeof item === 'string') : [],
    activeShares: Number(row.active_shares ?? 0),
    projects: projects.items,
    feedback: feedback.map(presentFeedback),
    contacts: contacts.map((item) => ({ id: item.id, subject: item.subject?.trim() || null, message: item.message?.trim() || null, status: item.status, createdAt: iso(item.created_at) })),
  };
}

/** `id` may still be URL-encoded, as it arrives in a route parameter. */
export async function getDesignProfile(id: string): Promise<AdminDesignProfile | null> {
  await ensureV2Schema();
  const designId = decodeRouteParam(id).slice(0, 200);
  const [design, feedback] = await Promise.all([
    getDesign(id),
    getSql().query(`
      SELECT f.rating, f.comment, f.export_format, f.template_id, f.created_at, f.project_id, p.name AS project_name
      FROM export_feedback f LEFT JOIN projects p ON p.id=f.project_id
      WHERE f.project_id=$1 ORDER BY f.created_at DESC LIMIT 20
    `, [designId]).then((result) => result as FeedbackRow[]),
  ]);
  if (!design) return null;
  return { ...design, feedback: feedback.map(presentFeedback) };
}
