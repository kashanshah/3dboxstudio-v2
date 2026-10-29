import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ensureV2Schema, getSql } from '@/server/db';
import { deleteStoredObject } from '@/server/media-assets';
import type { DeletionKind, DeletionPreview, DeletionResult } from '@/lib/admin-deletion';
import { buildDeletionPlan, legacyBlockId, record, strings, type Snapshot } from './deletion-plan';
import { storageKeyFromMediaFileId } from '@/lib/admin-media';

// The records a deletion is planned from, and a fingerprint of them that is
// checked again inside the deletion transaction. Only the rows that matter
// are read: the item and what it owns, the images those use, and any other
// record that mentions one of them (so shared images are kept, and scenes and
// shares lose their references). Reading the whole database ran out of memory
// once the site grew. No credentials, session tokens or password hashes are read.
//
// Parameters: $1 kind, $2 id, $3 legacy ids of imported designs,
// $4 strings found in the records being deleted (exact media id or key
// matches), $5 references to look for inside other records.
// Every query names all five parameters with their types, so Postgres can
// prepare it whichever of them its conditions use.
const PARAMS = '(SELECT $1::text, $2::text, $3::text[], $4::text[], $5::text[]) AS params(kind, id, source_ids, exact, mentions)';
const MENTIONS = (column: string) => `EXISTS (SELECT 1 FROM unnest($5::text[]) r WHERE strpos(${column}, r) > 0)`;
const SCOPE: Record<Exclude<keyof Snapshot, 'auth' | 'users'>, { table: string; where: string; order: string }> = {
  folders: { table: 'workspace_projects', where: `($1='user' AND t.user_id=$2) OR ($1='project' AND t.id=$2)`, order: 't.id' },
  designs: { table: 'projects', where: `($1='user' AND t.user_id=$2) OR ($1='design' AND (t.id=$2 OR t.studio_state->>'legacySourceId'=$2)) OR ($1='project' AND t.workspace_project_id=$2) OR t.id=ANY($5::text[]) OR ${MENTIONS('to_jsonb(t)::text')}`, order: 't.id' },
  scenes: { table: 'scenes', where: `($1='user' AND t.user_id=$2) OR ($1='project' AND t.workspace_project_id=$2) OR ${MENTIONS('to_jsonb(t)::text')}`, order: 't.id' },
  shares: { table: 'design_shares', where: `($1='user' AND t.user_id=$2) OR t.project_id=ANY($5::text[]) OR t.id=ANY($5::text[]) OR ${MENTIONS('to_jsonb(t)::text')}`, order: 't.id' },
  media: { table: 'media_assets', where: `($1='user' AND t.user_id=$2) OR t.id=ANY($4::text[]) OR t.storage_key=ANY($4::text[]) OR t.id=ANY($5::text[]) OR t.storage_key=ANY($5::text[])`, order: 't.id' },
  legacy: { table: 'legacy_records', where: `t.deleted_at IS NULL AND (($1='user' AND (t.payload->>'user_id'=$2 OR (t.entity_type='users' AND t.source_id=$2))) OR (t.entity_type='shared_designs' AND (t.source||':'||t.source_id=$2 OR t.source||':'||t.source_id=ANY($3::text[]))) OR ${MENTIONS('t.payload::text')})`, order: 't.source,t.entity_type,t.source_id' },
};
const USERS_SQL = `SELECT jsonb_build_object('id',t.id,'name',t.name,'email',t.email) AS row FROM ${PARAMS}, users t WHERE $1='user' AND t.id=$2`;
const AUTH_SQL = `SELECT to_jsonb(a) AS row FROM (
   SELECT 'sessions' AS label,user_id,COUNT(*)::int AS count FROM sessions WHERE user_id=$2 GROUP BY user_id
   UNION ALL SELECT 'OAuth accounts',user_id,COUNT(*)::int FROM oauth_accounts WHERE user_id=$2 GROUP BY user_id
   UNION ALL SELECT 'email verification tokens',user_id,COUNT(*)::int FROM email_verification_tokens WHERE user_id=$2 GROUP BY user_id
   UNION ALL SELECT 'password reset tokens',user_id,COUNT(*)::int FROM password_reset_tokens WHERE user_id=$2 GROUP BY user_id
 ) a, ${PARAMS} WHERE $1='user'`;
const scopedRowsSql = (part: keyof typeof SCOPE) => `SELECT to_jsonb(t) AS row FROM ${PARAMS}, ${SCOPE[part].table} t WHERE ${SCOPE[part].where} ORDER BY ${SCOPE[part].order}`;
/** One md5 over every scoped row, built from per-row hashes so no large value is ever held. */
export const FINGERPRINT_SQL = `SELECT md5(COALESCE(string_agg(h, '|' ORDER BY k), '')) AS hash FROM (
  SELECT 'users' AS k, md5(row::text) AS h FROM (${USERS_SQL}) x
  UNION ALL SELECT 'auth:'||(row->>'label'), md5(row::text) FROM (${AUTH_SQL}) x
  ${Object.entries(SCOPE).map(([part, scope]) => `UNION ALL SELECT '${part}:'||concat_ws(':',${scope.order.replace(/t\./g, 't.')}), md5(to_jsonb(t)::text) FROM ${PARAMS}, ${scope.table} t WHERE ${scope.where}`).join('\n  ')}
) rows`;
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
type Scope = [kind: DeletionKind, id: string, sourceIds: string[], exact: string[], mentions: string[]];
const sorted = (values: Iterable<string>) => [...new Set(values)].filter(Boolean).sort();

async function readScope(scope: Scope): Promise<Snapshot> {
  const sql = getSql();
  const parts = Object.keys(SCOPE) as (keyof typeof SCOPE)[];
  const results = await sql.transaction([USERS_SQL, AUTH_SQL, ...parts.map(scopedRowsSql)].map(text => sql.query(text, scope))) as { row: unknown }[][];
  const rows = (index: number) => results[index].map(r => r.row);
  return { users: rows(0), auth: rows(1), ...Object.fromEntries(parts.map((part, index) => [part, rows(index + 2)])) } as Snapshot;
}

/** What to look for next, from what a plan on the rows read so far would delete. */
function nextScope(kind: DeletionKind, id: string, key: string | null, plan: ReturnType<typeof buildDeletionPlan>): Scope {
  if (!plan) return [kind, id, [], sorted(key ? [key] : []), sorted(key ? [key] : [])];
  const deleted = [...plan.designs, ...plan.scenes, ...plan.shares];
  const exact = new Set<string>(key ? [key] : []);
  for (const value of [...deleted, ...plan.legacy.map(l => l.payload)]) for (const text of strings(value)) {
    if (text.length > 300) continue;
    exact.add(text);
    const media = /^\/api\/media\/([^/?#]+)/.exec(text);
    if (media) exact.add(decodeURIComponent(media[1]));
  }
  const keys = [...plan.keys, ...plan.retainedMedia.map(m => storageKeyFromMediaFileId(m.id) ?? '')];
  const mentions = new Set<string>([...keys, ...plan.designs.map(d => d.id), ...plan.shares.map(sh => sh.id)]);
  for (const m of plan.media) { mentions.add(m.id); mentions.add(m.storage_key); }
  for (const l of plan.legacy) { mentions.add(`${l.source}:${l.source_id}`); mentions.add(l.source_id); }
  const sourceIds = plan.designs.map(d => record(d.studio_state).legacySourceId).filter((v): v is string => typeof v === 'string');
  return [kind, id, sorted(sourceIds), sorted(exact), sorted(mentions)];
}

/** Reads the records the deletion depends on, widening until nothing new turns up. */
async function snapshot(kind: DeletionKind, id: string) {
  await ensureV2Schema();
  const key = kind === 'media' ? storageKeyFromMediaFileId(id) : null;
  let scope = nextScope(kind, id, key, null);
  for (let round = 0; round < 6; round++) {
    const rows = await readScope(scope);
    // Only ever widen: a reference found once stays looked for, so an image
    // kept because another design uses it cannot drop out and come back.
    const found = nextScope(kind, id, key, buildDeletionPlan(rows, kind, id));
    const next: Scope = [kind, id, sorted([...scope[2], ...found[2]]), sorted([...scope[3], ...found[3]]), sorted([...scope[4], ...found[4]])];
    if (JSON.stringify(next) === JSON.stringify(scope)) {
      const [{ hash }] = await getSql().query(FINGERPRINT_SQL, scope) as { hash: string }[];
      return { snapshot: rows, hash, scope };
    }
    scope = next;
  }
  throw new DeletionError('This item is linked to too many other records to delete safely. Try again or contact support.', 409);
}
export async function previewDeletion(kind: DeletionKind, id: string): Promise<DeletionPreview> {
  const current = await snapshot(kind, id);
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
  const current = await snapshot(kind, id);
  validateToken(token, kind, id, current.hash);
  const plan = buildDeletionPlan(current.snapshot, kind, id);
  if (!plan) throw new DeletionError('This item no longer exists.', 404);
  const sql = getSql(), jobId = randomUUID();
  const queries = [
    // Lock writers before checking the snapshot again. This also covers project
    // moves, newly linked media, shares, and concurrent migration runs.
    sql.query('LOCK TABLE users, workspace_projects, projects, scenes, design_shares, media_assets, legacy_records, sessions, oauth_accounts, email_verification_tokens, password_reset_tokens, admin_deleted_entities IN SHARE ROW EXCLUSIVE MODE'),
    sql.query(`SELECT 1 / CASE WHEN hash=$6 THEN 1 ELSE 0 END AS confirmed FROM (${FINGERPRINT_SQL}) f`, [...current.scope, current.hash]),
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
    queries.push(sql.query('UPDATE error_samples SET user_id=NULL WHERE user_id=$1', [id]));
    queries.push(sql.query('DELETE FROM legacy_migrations WHERE target_id=$1', [id]));
  }
  queries.push(sql.query('INSERT INTO admin_deletion_files(job_id,storage_key) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING', [jobId, plan.keys]));
  try { await sql.transaction(queries); } catch (error) {
    if (['22012', '40001', '40P01'].includes(String((error as { code?: string }).code))) throw new DeletionError('The records changed. Review the updated deletion list.', 409);
    throw error;
  }
  return retryDeletionFiles(jobId);
}
