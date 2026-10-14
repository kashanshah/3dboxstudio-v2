import { ensureV2Schema, getSql } from '@/server/db';

// Export ratings for the admin, a page at a time, with the design and the
// person they are about.

export type AdminFeedbackRow = {
  id: string;
  rating: number;
  comment: string | null;
  format: string;
  templateId: string;
  createdAt: string | null;
  user: { id: string; name: string; email: string } | null;
  design: { id: string; name: string; thumbnailUrl: string | null } | null;
};

const PAGE_SIZE = 25;

export async function listAdminFeedback(input: { rating?: string; comments?: string; page?: number } = {}) {
  await ensureV2Schema();
  const rating = /^[1-5]$/.test(input.rating ?? '') ? Number(input.rating) : 0;
  const comments = input.comments === '1';
  const page = input.page && input.page > 0 ? input.page : 1;
  const rows = await getSql().query(`
    SELECT f.id, f.rating, f.comment, f.export_format, f.template_id, f.created_at,
      u.id AS user_id, COALESCE(NULLIF(u.name,''), u.email) AS user_name, u.email,
      p.id AS project_id, p.name AS project_name, (NULLIF(p.preview_image_key,'') IS NOT NULL) AS has_preview,
      COUNT(*) OVER()::int AS total
    FROM export_feedback f
    LEFT JOIN users u ON u.id=f.user_id
    LEFT JOIN projects p ON p.id=f.project_id
    WHERE ($1=0 OR f.rating=$1) AND (NOT $2 OR NULLIF(trim(f.comment),'') IS NOT NULL)
    ORDER BY f.created_at DESC, f.id
    LIMIT $3 OFFSET $4
  `, [rating, comments, PAGE_SIZE, (page - 1) * PAGE_SIZE]) as {
    id: string; rating: number; comment: string | null; export_format: string; template_id: string; created_at: string | Date | null;
    user_id: string | null; user_name: string | null; email: string | null; project_id: string | null; project_name: string | null; has_preview: boolean | null; total: number;
  }[];
  const items: AdminFeedbackRow[] = rows.map((row) => ({
    id: String(row.id),
    rating: Number(row.rating),
    comment: row.comment?.trim() || null,
    format: row.export_format,
    templateId: row.template_id,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    user: row.user_id ? { id: row.user_id, name: row.user_name || row.email || 'Unknown', email: row.email || '' } : null,
    design: row.project_id ? {
      id: row.project_id,
      name: row.project_name?.trim() || 'Untitled',
      thumbnailUrl: row.has_preview ? `/api/admin/designs/${encodeURIComponent(row.project_id)}/preview` : null,
    } : null,
  }));
  return { items, total: Number(rows[0]?.total ?? 0), page, pageSize: PAGE_SIZE, rating, comments };
}
