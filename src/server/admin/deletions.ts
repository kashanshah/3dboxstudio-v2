import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ensureV2Schema, getSql } from '@/server/db';
import { deleteStoredObject } from '@/server/media-assets';
import type { DeletionKind, DeletionPreview, DeletionResult } from '@/lib/admin-deletion';
import { buildDeletionPlan, legacyBlockId, type Snapshot } from './deletion-plan';

// One ordered database snapshot is used both for confirmation and for the
// transactional guard. No credentials, session tokens, or password hashes leave DB.
export const SNAPSHOT_SQL = `SELECT jsonb_build_object(
 'users', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'email',email) ORDER BY id) FROM users),'[]'),
 'folders', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM workspace_projects t),'[]'),
 'designs', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM projects t),'[]'),
 'scenes', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM scenes t),'[]'),
 'shares', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM design_shares t),'[]'),
 'media', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM media_assets t),'[]'),
 'legacy', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY source,entity_type,source_id) FROM legacy_records t WHERE deleted_at IS NULL),'[]'),
 'auth', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY label,user_id) FROM (
   SELECT 'sessions' AS label,user_id,COUNT(*)::int AS count FROM sessions GROUP BY user_id
   UNION ALL SELECT 'OAuth accounts',user_id,COUNT(*)::int FROM oauth_accounts GROUP BY user_id
   UNION ALL SELECT 'email verification tokens',user_id,COUNT(*)::int FROM email_verification_tokens GROUP BY user_id
   UNION ALL SELECT 'password reset tokens',user_id,COUNT(*)::int FROM password_reset_tokens GROUP BY user_id
 ) t),'[]')
) AS snapshot`;
export class DeletionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
function sign(value: string) {
  const secret = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? '3dboxstudio-admin' : '');
  if (!secret) throw new Error('ADMIN_PASSWORD is not configured');
  return createHmac('sha256', `admin-delete:${secret}`).update(value).digest('base64url');
}
function makeToken(kind: DeletionKind, id: string, hash: string) {
  const body = Buffer.from(JSON.stringify({ kind, id, hash, expires: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  return `${body}.${sign(body)}`;
}
function validateToken(token: string, kind: DeletionKind, id: string, hash: string) {
  const [body, signature, extra] = token.split('.');
  const expected = sign(body || '');
  if (extra || !signature || Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new DeletionError('Load a fresh deletion confirmation.', 409);
  let data;
  try { data = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw new DeletionError('Load a fresh deletion confirmation.', 409); }
  if (data.kind !== kind || data.id !== id || data.hash !== hash || !(data.expires > Date.now())) throw new DeletionError('The records changed or confirmation expired. Review the updated deletion list.', 409);
}
async function snapshot() {
  await ensureV2Schema();
  const rows = await getSql().query(`SELECT snapshot,md5(snapshot::text) AS hash FROM (${SNAPSHOT_SQL}) s`) as { snapshot: Snapshot; hash: string }[];
  return rows[0];
}
export async function previewDeletion(kind: DeletionKind, id: string): Promise<DeletionPreview> {
  const current = await snapshot();
  const plan = buildDeletionPlan(current.snapshot, kind, id);
  if (!plan) throw new DeletionError('This item no longer exists.', 404);
  return { kind, id, name: plan.name, token: makeToken(kind, id, current.hash), groups: plan.groups, updates: plan.updates, retainedMedia: plan.retainedMedia };
}

export async function pendingDeletionJobs() {
  await ensureV2Schema();
  return await getSql().query('SELECT job_id AS "jobId",array_agg(storage_key ORDER BY storage_key) AS keys FROM admin_deletion_files GROUP BY job_id ORDER BY MIN(created_at)') as { jobId: string; keys: string[] }[];
}

export async function retryDeletionFiles(jobId: string): Promise<DeletionResult> {
  await ensureV2Schema();
  const sql = getSql();
  // Bound work per request; the admin can continue retrying a large cleanup.
  const rows = await sql.query('SELECT storage_key FROM admin_deletion_files WHERE job_id=$1 ORDER BY storage_key LIMIT 100', [jobId]) as { storage_key: string }[];
  for (let offset = 0; offset < rows.length; offset += 5) await Promise.all(rows.slice(offset, offset + 5).map(async row => {
    try {
      await deleteStoredObject(row.storage_key);
      await sql.query('DELETE FROM admin_deletion_files WHERE job_id=$1 AND storage_key=$2', [jobId, row.storage_key]);
    } catch (error) { console.error('admin deletion storage cleanup failed', { jobId, key: row.storage_key, error }); }
  }));
  const counts = await sql.query('SELECT COUNT(*)::int AS count FROM admin_deletion_files WHERE job_id=$1', [jobId]) as { count: number }[];
  return { jobId, pendingFiles: counts[0].count };
}

export async function executeDeletion(kind: DeletionKind, id: string, token: string): Promise<DeletionResult> {
  const current = await snapshot();
  validateToken(token, kind, id, current.hash);
  const plan = buildDeletionPlan(current.snapshot, kind, id);
  if (!plan) throw new DeletionError('This item no longer exists.', 404);
  const sql = getSql(), jobId = randomUUID();
  const queries = [
    // Lock writers before checking the snapshot again. This also covers project
    // moves, newly linked media, shares, and concurrent migration runs.
    sql.query('LOCK TABLE users, workspace_projects, projects, scenes, design_shares, media_assets, legacy_records, sessions, oauth_accounts, email_verification_tokens, password_reset_tokens, admin_deleted_entities IN SHARE ROW EXCLUSIVE MODE'),
    sql.query(`SELECT 1 / CASE WHEN md5(snapshot::text)=$1 THEN 1 ELSE 0 END AS confirmed FROM (${SNAPSHOT_SQL}) s`, [current.hash]),
  ];
  for (const c of plan.changes) {
    if (c.table === 'projects' || c.table === 'scenes') {
      const column = c.table === 'projects' ? 'studio_state' : 'scene_state';
      queries.push(sql.query(`UPDATE ${c.table} SET ${column}=$2::jsonb,preview_image_key=$3,revision=revision+1,updated_at=NOW() WHERE id=$1`, [c.id, JSON.stringify(c.value), c.extra ?? null]));
    } else if (c.table === 'design_shares') queries.push(sql.query('UPDATE design_shares SET studio_state=$2::jsonb,legacy_assets=$3::jsonb,updated_at=NOW() WHERE id=$1', [c.id, JSON.stringify(c.value), JSON.stringify(c.extra)]));
    else {
      queries.push(sql.query("UPDATE legacy_records SET payload=$2::jsonb WHERE source||':'||entity_type||':'||source_id=$1", [c.id, JSON.stringify(c.value)]));
      queries.push(sql.query("INSERT INTO admin_deleted_entities(kind,id) VALUES('legacy',$1) ON CONFLICT DO NOTHING", [c.id]));
    }
  }
  for (const l of plan.legacy) {
    queries.push(sql.query("UPDATE legacy_records SET deleted_at=NOW(),payload='{}'::jsonb WHERE source=$1 AND entity_type=$2 AND source_id=$3", [l.source, l.entity_type, l.source_id]));
    queries.push(sql.query("INSERT INTO admin_deleted_entities(kind,id) VALUES('legacy',$1) ON CONFLICT DO NOTHING", [legacyBlockId(l)]));
  }
  // Explicit order: workspace_projects uses SET NULL for designs, so relying on
  // its FK alone would orphan the very designs the administrator confirmed.
  for (const [table, rows] of [['design_shares', plan.shares], ['scenes', plan.scenes], ['projects', plan.designs], ['workspace_projects', plan.folders], ['media_assets', plan.media]] as const) {
    queries.push(sql.query(`DELETE FROM ${table} WHERE id=ANY($1::text[])`, [rows.map(r => r.id)]));
  }
  if (kind === 'user') {
    queries.push(sql.query("INSERT INTO admin_deleted_entities(kind,id) VALUES('user',$1) ON CONFLICT DO NOTHING", [id]));
    queries.push(sql.query('DELETE FROM users WHERE id=$1', [id]));
    queries.push(sql.query('DELETE FROM legacy_migrations WHERE target_id=$1', [id]));
  }
  queries.push(sql.query('INSERT INTO admin_deletion_files(job_id,storage_key) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING', [jobId, plan.keys]));
  try { await sql.transaction(queries); } catch (error) {
    if (['22012', '40001', '40P01'].includes(String((error as { code?: string }).code))) throw new DeletionError('The records changed. Review the updated deletion list.', 409);
    throw error;
  }
  return retryDeletionFiles(jobId);
}
