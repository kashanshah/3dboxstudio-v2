import { ensureV2Schema, getSql } from '@/server/db';
import { resolveMediaSizes } from './media-sizes';
import { adminDesignHref, adminDesignViewHref, adminUserHref, isCatalogMediaKey, mediaFileId, type AdminMediaItem } from '@/lib/admin-media';
import { legacyDesignToStudioProject } from '@/lib/legacy-design-converter';
import type { LocalMediaAsset } from '@/lib/packaging/artwork';
import { decodeRouteParam } from '@/lib/route-params';
import { validProjectState, type StudioProjectState } from '@/lib/studio-project';

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  verifiedAt: string | null;
  signupMethod: string;
  createdAt: string | null;
  projectCount: number;
  designCount: number;
  mediaCount: number;
  /** Where the signup came from: UTM source, else the referrer's host. */
  source: string | null;
  campaign: string | null;
  landing: string | null;
  migrated: boolean;
  /** When an admin gave the account Pro access (beta Pro features), or null. */
  proSince: string | null;
  /** Latest design save or sign-in. */
  lastActiveAt: string | null;
  recentDesigns: { id: string; name: string; thumbnailUrl: string | null }[];
};

export type AdminDesignRow = {
  id: string;
  name: string;
  legacy: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  imageCount: number;
  views: number;
  previewHref: string;
  thumbnailUrl: string | null;
  user: { id: string; name: string; email: string | null; href: string } | null;
  /** Box template id; a legacy design is mapped to the template it opens as. */
  templateId: string | null;
  /** Width × height × depth as saved, e.g. "120 × 80 × 40 mm". */
  size: string | null;
  /** The Studio project (folder) a V2 design is in. */
  folder: string | null;
  sharedLink: boolean;
  rating: { average: number; count: number } | null;
};

export type AdminDesignDetail = AdminDesignRow & { images: AdminMediaItem[] };

export type AdminUserDetail = AdminUserRow & {
  designs: AdminDesignRow[];
};

export type AdminPage<T> = { items: T[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 24;

// A legacy design's id is `source:source_id`; looking it up by those two
// columns uses the primary key instead of scanning every legacy design.
function legacyKey(id: string): { source: string; sourceId: string } {
  const at = id.indexOf(':');
  return at > 0 ? { source: id.slice(0, at), sourceId: id.slice(at + 1) } : { source: '', sourceId: '' };
}

const LEGACY_DESIGN = `lr.entity_type='shared_designs' AND lr.deleted_at IS NULL`;
const LEGACY_IMAGES = `jsonb_each(CASE WHEN jsonb_typeof(lr.payload->'images')='object' THEN lr.payload->'images' ELSE '{}'::jsonb END)`;

/**
 * Every design, V2 and legacy, as one row shape. `nativeWhere` and
 * `legacyWhere` filter each side before the union (aliases p and lr), so a
 * filter by owner or id uses that side's indexes.
 */
function designsSql(nativeWhere: string, legacyWhere: string) {
  return `
    SELECT p.id, p.name, false AS legacy, p.created_at, p.updated_at, p.user_id, 0::bigint AS views,
      NULL::text AS public_id, NULL::text AS preview_token,
      (NULLIF(p.preview_image_key, '') IS NOT NULL) AS has_preview,
      NULL::text AS legacy_source, NULL::text AS legacy_source_id
    FROM projects p WHERE ${nativeWhere}
    UNION ALL
    SELECT lr.source || ':' || lr.source_id,
      COALESCE(NULLIF(lr.payload->>'name',''), 'Untitled'),
      true,
      admin_ts(lr.payload->>'created_at'),
      COALESCE(admin_ts(lr.payload->>'updated_at'), admin_ts(lr.payload->>'created_at')),
      NULLIF(lr.payload->>'user_id',''),
      COALESCE(admin_bigint(lr.payload->>'view_count'), 0),
      lr.source_id, NULLIF(lr.payload->>'preview_token',''),
      (NULLIF(COALESCE(lr.payload->>'v2_og_image_key', lr.payload->>'og_image_key'), '') IS NOT NULL),
      lr.source, lr.source_id
    FROM legacy_records lr WHERE ${LEGACY_DESIGN} AND ${legacyWhere}`;
}

/**
 * For one design row `d` of designsSql: its distinct images and the newest
 * one, from the media its saved state points at, or a legacy design's faces
 * and preview.
 */
const IMAGE_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT k.storage_key)::int AS image_count,
      (array_agg(k.storage_key ORDER BY k.created_at DESC NULLS LAST, k.storage_key))[1] AS thumb_storage_key
    FROM (
      SELECT m.storage_key, m.created_at
      FROM projects p
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.media_refs, '[]'::jsonb)) r(ref)
      JOIN media_assets m ON m.id = regexp_replace(r.ref, '^/api/media/', '')
      WHERE NOT d.legacy AND p.id = d.id
      UNION ALL
      SELECT img.value->>'s3Key', admin_ts(lr.payload->>'created_at')
      FROM legacy_records lr CROSS JOIN LATERAL ${LEGACY_IMAGES} img
      WHERE d.legacy AND lr.source = d.legacy_source AND lr.entity_type = 'shared_designs' AND lr.source_id = d.legacy_source_id
        AND NULLIF(img.value->>'s3Key','') IS NOT NULL
      UNION ALL
      SELECT lr.payload->>'og_image_key', admin_ts(lr.payload->>'created_at')
      FROM legacy_records lr
      WHERE d.legacy AND lr.source = d.legacy_source AND lr.entity_type = 'shared_designs' AND lr.source_id = d.legacy_source_id
        AND NULLIF(lr.payload->>'og_image_key','') IS NOT NULL
    ) k
  ) img ON true`;

const DESIGN_IMAGES = `${IMAGE_LATERAL}
  LEFT JOIN design_shares s ON NOT d.legacy AND s.project_id = d.id AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > NOW())
  LEFT JOIN LATERAL (
    SELECT p.studio_state->>'templateId' AS template_id, p.studio_state->'dimensions' AS dims, 'mm' AS unit, wp.name AS folder
    FROM projects p LEFT JOIN workspace_projects wp ON wp.id = p.workspace_project_id
    WHERE NOT d.legacy AND p.id = d.id
    UNION ALL
    SELECT CASE WHEN lr.payload->'config'->>'opening' ILIKE '%split%' THEN 'split-top-box' ELSE 'base-box' END,
      lr.payload->'config'->'dims', COALESCE(NULLIF(lr.payload->'config'->>'unit', ''), 'cm'), NULL
    FROM legacy_records lr
    WHERE d.legacy AND lr.source = d.legacy_source AND lr.entity_type = 'shared_designs' AND lr.source_id = d.legacy_source_id
  ) dm ON true
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(f.rating)::numeric, 1) AS rating_avg, COUNT(*)::int AS rating_count
    FROM export_feedback f WHERE NOT d.legacy AND f.project_id = d.id
  ) fb ON true`;

const DESIGN_COLUMNS = `d.id, d.name, d.legacy, d.created_at, d.updated_at, d.has_preview, d.public_id, d.preview_token,
  CASE WHEN d.legacy THEN d.views ELSE COALESCE(s.view_count, 0) END AS views,
  s.id AS share_id, s.preview_token AS share_preview_token,
  COALESCE(img.image_count, 0) AS image_count, img.thumb_storage_key,
  dm.template_id, dm.dims, dm.unit, dm.folder, fb.rating_avg, fb.rating_count,
  d.user_id, d.user_name, d.user_email`;

/** One user's latest activity and three newest designs (`id` is the user id expression). */
function userActivitySql(id: string) {
  return `
    SELECT GREATEST(
        (SELECT MAX(p.updated_at) FROM projects p WHERE p.user_id = ${id}),
        (SELECT MAX(se.created_at) FROM sessions se WHERE se.user_id = ${id})
      ) AS last_active_at,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'preview', r.has_preview) ORDER BY r.updated_at DESC NULLS LAST), '[]'::jsonb)
       FROM (SELECT * FROM (${designsSql(`p.user_id = ${id}`, `lr.payload->>'user_id' = ${id}`)}) x ORDER BY x.updated_at DESC NULLS LAST LIMIT 3) r
      ) AS recent_designs`;
}

const USER_FIELDS = `u.id, u.name, u.email, u.email_verified_at, u.signup_method, u.created_at,
  u.utm_source, u.utm_campaign, u.signup_landing_page, u.signup_landing_type, u.signup_referrer, u.migrated_from, u.pro_access_at`;

/** One user's projects, designs and distinct images (`id` is the user id expression). */
function userCountsSql(id: string) {
  return `
    SELECT
      (SELECT COUNT(*)::int FROM workspace_projects wp WHERE wp.user_id = ${id}) AS project_count,
      (SELECT COUNT(*)::int FROM projects p WHERE p.user_id = ${id})
        + (SELECT COUNT(*)::int FROM legacy_records lr WHERE ${LEGACY_DESIGN} AND lr.payload->>'user_id' = ${id}) AS design_count,
      (SELECT COUNT(DISTINCT k)::int FROM (
        SELECT m.storage_key AS k FROM media_assets m WHERE m.user_id = ${id}
        UNION ALL
        SELECT img.value->>'s3Key' FROM legacy_records lr CROSS JOIN LATERAL ${LEGACY_IMAGES} img
        WHERE ${LEGACY_DESIGN} AND lr.payload->>'user_id' = ${id} AND NULLIF(img.value->>'s3Key','') IS NOT NULL
        UNION ALL
        SELECT lr.payload->>'og_image_key' FROM legacy_records lr
        WHERE ${LEGACY_DESIGN} AND lr.payload->>'user_id' = ${id} AND NULLIF(lr.payload->>'og_image_key','') IS NOT NULL
      ) keys) AS media_count`;
}

type MediaQueryRow = {
  storage_key: string;
  name: string | null;
  mime_type: string | null;
  byte_size: number | string | null;
  created_at: string | Date | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  designs: unknown;
  total: number;
};

type DesignQueryRow = {
  id: string;
  name: string | null;
  legacy: boolean;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  image_count: number;
  views: number;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  public_id?: string | null;
  preview_token?: string | null;
  share_id?: string | null;
  share_preview_token?: string | null;
  has_preview?: boolean;
  thumb_storage_key?: string | null;
  template_id?: string | null;
  dims?: unknown;
  unit?: string | null;
  folder?: string | null;
  rating_avg?: number | string | null;
  rating_count?: number | null;
  total?: number;
};

const PUBLIC_TOKEN = /^[0-9A-Za-z]{10,24}$/;
const ASSET_ID = /^[A-Za-z0-9-]+$/;
const FACE_ID = /^[A-Za-z][A-Za-z0-9]*$/;

function publicPreviewHref(row: DesignQueryRow): string | null {
  const token = (row.legacy ? row.preview_token : row.share_preview_token)?.trim();
  if (token && PUBLIC_TOKEN.test(token)) return `/preview/${encodeURIComponent(token)}`;
  const studioId = (row.legacy ? row.public_id : row.share_id)?.trim();
  if (studioId && PUBLIC_TOKEN.test(studioId)) return `/studio/${encodeURIComponent(studioId)}`;
  return null;
}

function designPreviewHref(row: DesignQueryRow): string {
  return publicPreviewHref(row) ?? adminDesignViewHref(row.id);
}

function designThumbnailUrl(row: DesignQueryRow): string | null {
  if (row.has_preview) return `/api/admin/designs/${encodeURIComponent(row.id)}/preview`;
  const key = row.thumb_storage_key?.trim();
  if (key && isCatalogMediaKey(key)) return `/api/admin/media/file?id=${encodeURIComponent(mediaFileId(key))}`;
  return null;
}

function rewriteAdminMediaUrls(state: StudioProjectState, designId: string): StudioProjectState {
  const encoded = encodeURIComponent(designId);
  const rewrite = (url: string, assetId?: string) => (
    assetId && url.startsWith('/api/media/')
      ? `/api/admin/designs/${encoded}/media/${encodeURIComponent(assetId)}`
      : url
  );
  return {
    ...state,
    artworkByPanel: Object.fromEntries(Object.entries(state.artworkByPanel).map(([key, item]) => [key, { ...item, url: rewrite(item.url, item.assetId) }])),
    outsideArtworkLayers: state.outsideArtworkLayers.map((item) => ({ ...item, url: rewrite(item.url, item.assetId) })),
    insideArtworkLayers: state.insideArtworkLayers.map((item) => ({ ...item, url: rewrite(item.url, item.assetId) })),
    mediaAssets: state.mediaAssets.map((item) => ({ ...item, url: rewrite(item.url, item.id) })),
  };
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function adminLegacyMediaByFace(designId: string, payloadValue: unknown): Record<string, LocalMediaAsset> {
  const payload = jsonRecord(payloadValue);
  const images = jsonRecord(payload.images);
  const encoded = encodeURIComponent(designId);
  return Object.fromEntries(Object.entries(images).flatMap(([faceId, value]) => {
    if (!FACE_ID.test(faceId)) return [];
    const entry = jsonRecord(value);
    const storageKey = typeof entry.v2StorageKey === 'string' ? entry.v2StorageKey : '';
    const sourceKey = typeof entry.s3Key === 'string' ? entry.s3Key : typeof entry.s3_key === 'string' ? entry.s3_key : '';
    if (!storageKey && !sourceKey) return [];
    const name = typeof entry.name === 'string' && entry.name ? entry.name : `${faceId}-artwork`;
    const mime = typeof entry.mime === 'string' && entry.mime ? entry.mime : 'image/png';
    return [[faceId, {
      id: `legacy-share-${faceId}`,
      name,
      url: `/api/admin/designs/${encoded}/legacy-media/${encodeURIComponent(faceId)}`,
      mimeType: mime,
      byteSize: 0,
      width: null,
      height: null,
      fingerprint: storageKey || sourceKey,
      createdAt: 0,
    }]];
  }));
}

export function parseAdminPage(value?: string): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 && page < 100000 ? page : 1;
}

export function parseAdminQuery(value?: string): string {
  return (value ?? '').trim().slice(0, 80);
}

export type AdminSortDir = 'asc' | 'desc';
export const USER_SORTS = ['name', 'email', 'verified', 'projects', 'designs', 'media', 'joined'] as const;
export const DESIGN_SORTS = ['name', 'owner', 'images', 'source', 'created', 'updated'] as const;
export const MEDIA_SORTS = ['name', 'owner', 'designs', 'added'] as const;
const USER_SORT_SQL: Record<(typeof USER_SORTS)[number], string> = {
  name: `lower(COALESCE(NULLIF(u.name,''), u.email))`,
  email: `lower(u.email)`,
  verified: `(u.email_verified_at IS NOT NULL)`,
  projects: `project_count`,
  designs: `design_count`,
  media: `media_count`,
  joined: `u.created_at`,
};
const DESIGN_SORT_SQL: Record<(typeof DESIGN_SORTS)[number], string> = {
  name: `lower(COALESCE(NULLIF(d.name,''), 'Untitled'))`,
  owner: `lower(COALESCE(NULLIF(u.name,''), u.email, ''))`,
  images: `img.image_count`,
  source: `CASE WHEN d.legacy THEN 'legacy' ELSE 'v2' END`,
  created: `d.created_at`,
  updated: `d.updated_at`,
};
const MEDIA_SORT_SQL: Record<(typeof MEDIA_SORTS)[number], string> = {
  name: `lower(COALESCE(g.name,''))`,
  owner: `lower(COALESCE(NULLIF(u.name,''), u.email, ''))`,
  designs: `jsonb_array_length(g.designs)`,
  added: `g.created_at`,
};

export function parseAdminSort<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

export function parseAdminDir(value: string | undefined, fallback: AdminSortDir): AdminSortDir {
  return value === 'asc' || value === 'desc' ? value : fallback;
}

function orderSql(column: string, dir: AdminSortDir, tie: string): string {
  return `${column} ${dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, ${tie}`;
}

function iso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fileName(key: string): string {
  const name = key.split('/').pop() || 'Image';
  try { return decodeURIComponent(name); } catch { return name; }
}

function asDesigns(value: unknown): { id: string; name: string }[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { id?: unknown; name?: unknown };
    if (typeof row.id !== 'string' || !row.id) return [];
    return [{ id: row.id, name: typeof row.name === 'string' && row.name ? row.name : 'Untitled' }];
  });
}

function presentMedia(row: MediaQueryRow): AdminMediaItem {
  const designs = asDesigns(row.designs);
  const unique = new Map(designs.map((design) => [design.id, design]));
  return {
    id: mediaFileId(row.storage_key),
    name: row.name?.trim() || fileName(row.storage_key),
    mimeType: row.mime_type || 'application/octet-stream',
    byteSize: row.byte_size == null ? null : Number(row.byte_size),
    createdAt: iso(row.created_at),
    previewUrl: `/api/admin/media/file?id=${encodeURIComponent(mediaFileId(row.storage_key))}`,
    user: row.user_id ? {
      id: row.user_id,
      name: row.user_name?.trim() || row.user_email || 'Unknown user',
      href: adminUserHref(row.user_id),
    } : null,
    designs: [...unique.values()].map((design) => ({ ...design, href: adminDesignHref(design.id) })),
  };
}

function sizeLabel(dims: unknown, unit: string | null | undefined): string | null {
  const value = jsonRecord(typeof dims === 'string' ? (() => { try { return JSON.parse(dims) as unknown; } catch { return null; } })() : dims);
  const read = (key: string) => { const n = Number(value[key]); return Number.isFinite(n) && n > 0 ? n : null; };
  const width = read('width'), height = read('height'), depth = read('depth') ?? read('length');
  if (width == null || height == null || depth == null) return null;
  const round = (n: number) => Number(n.toFixed(1)).toString();
  return `${round(width)} × ${round(height)} × ${round(depth)} ${unit || 'mm'}`;
}

function presentDesign(row: DesignQueryRow): AdminDesignRow {
  return {
    id: row.id,
    name: row.name?.trim() || 'Untitled',
    legacy: Boolean(row.legacy),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    imageCount: Number(row.image_count || 0),
    views: Number(row.views || 0),
    previewHref: designPreviewHref(row),
    thumbnailUrl: designThumbnailUrl(row),
    user: row.user_id ? {
      id: row.user_id,
      name: row.user_name?.trim() || row.user_email || 'Unknown user',
      email: row.user_email ?? null,
      href: adminUserHref(row.user_id),
    } : null,
    templateId: row.template_id?.trim() || null,
    size: sizeLabel(row.dims, row.unit),
    folder: row.folder?.trim() || null,
    sharedLink: Boolean(row.legacy ? (row.preview_token || row.public_id) : row.share_id),
    rating: Number(row.rating_count) > 0 ? { average: Number(row.rating_avg), count: Number(row.rating_count) } : null,
  };
}

type UserQueryRow = {
  id: string;
  name: string | null;
  email: string;
  email_verified_at: string | Date | null;
  signup_method: string | null;
  created_at: string | Date | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  signup_landing_page?: string | null;
  signup_landing_type?: string | null;
  signup_referrer?: string | null;
  migrated_from?: string | null;
  pro_access_at?: string | Date | null;
  last_active_at?: string | Date | null;
  recent_designs?: unknown;
  project_count: number;
  design_count: number;
  media_count: number;
};

function referrerHost(value: string | null | undefined): string | null {
  if (!value) return null;
  try { return new URL(value).hostname.replace(/^www\./, '') || null; } catch { return null; }
}

function presentUser(row: UserQueryRow): AdminUserRow {
  const recent = Array.isArray(row.recent_designs) ? row.recent_designs as { id?: unknown; name?: unknown; preview?: unknown }[] : [];
  return {
    id: row.id,
    name: row.name?.trim() || row.email,
    email: row.email,
    verified: Boolean(row.email_verified_at),
    verifiedAt: iso(row.email_verified_at),
    signupMethod: row.signup_method?.trim() || 'Unknown',
    createdAt: iso(row.created_at),
    projectCount: Number(row.project_count || 0),
    designCount: Number(row.design_count || 0),
    mediaCount: Number(row.media_count || 0),
    source: row.utm_source?.trim() || referrerHost(row.signup_referrer),
    campaign: row.utm_campaign?.trim() || null,
    landing: row.signup_landing_page?.trim() || row.signup_landing_type?.trim() || null,
    migrated: Boolean(row.migrated_from),
    proSince: iso(row.pro_access_at ?? null),
    lastActiveAt: iso(row.last_active_at),
    recentDesigns: recent.flatMap((item) => typeof item.id === 'string' ? [{
      id: item.id,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Untitled',
      thumbnailUrl: item.preview === true ? `/api/admin/designs/${encodeURIComponent(item.id)}/preview` : null,
    }] : []),
  };
}

export async function listUsers(input: { q?: string; page?: number; sort?: string; dir?: string } = {}): Promise<AdminPage<AdminUserRow>> {
  await ensureV2Schema();
  const q = parseAdminQuery(input.q);
  const page = input.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;
  const sort = parseAdminSort(input.sort, USER_SORTS, 'joined');
  const dir = parseAdminDir(input.dir, 'desc');
  // Counts are worked out for the page's users only, unless the list is
  // sorted by one of them.
  const countSort = sort === 'projects' || sort === 'designs' || sort === 'media';
  const order = orderSql(USER_SORT_SQL[sort], dir, 'u.id');
  const rows = await getSql().query(`
    WITH page AS (
      SELECT ${USER_FIELDS},
        ${countSort ? 'c.project_count, c.design_count, c.media_count,' : ''}
        COUNT(*) OVER()::int AS total, ROW_NUMBER() OVER (ORDER BY ${order}) AS ord
      FROM users u
      ${countSort ? `CROSS JOIN LATERAL (${userCountsSql('u.id')}) c` : ''}
      WHERE $1='' OR strpos(lower(COALESCE(u.name,'')), lower($1))>0 OR strpos(lower(u.email), lower($1))>0
      ORDER BY ${order}
      LIMIT $2 OFFSET $3
    )
    SELECT page.*${countSort ? '' : ', c.project_count, c.design_count, c.media_count'}, a.last_active_at, a.recent_designs
    FROM page ${countSort ? '' : `CROSS JOIN LATERAL (${userCountsSql('page.id')}) c`}
    CROSS JOIN LATERAL (${userActivitySql('page.id')}) a
    ORDER BY page.ord
  `, [q, PAGE_SIZE, offset]) as Array<UserQueryRow & { total: number }>;
  return { items: rows.map(presentUser), total: Number(rows[0]?.total ?? 0), page, pageSize: PAGE_SIZE };
}

export async function getUser(id: string, list?: { sort?: string; dir?: string }): Promise<AdminUserDetail | null> {
  await ensureV2Schema();
  const [rows, designs] = await Promise.all([
    getSql().query(`
      SELECT ${USER_FIELDS}, c.*, a.*
      FROM users u CROSS JOIN LATERAL (${userCountsSql('u.id')}) c CROSS JOIN LATERAL (${userActivitySql('u.id')}) a
      WHERE u.id=$1 LIMIT 1
    `, [id]).then((result) => result as UserQueryRow[]),
    listDesigns({ userId: id, page: 1, pageSize: 100, sort: list?.sort, dir: list?.dir }),
  ]);
  const user = rows[0];
  if (!user) return null;
  return { ...presentUser(user), designs: designs.items };
}

export type AdminUserDesignItem = {
  id: string;
  name: string;
  legacy: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  imageCount: number;
  views: number;
  thumbnailUrl: string | null;
  previewHref: string;
  href: string;
};

export async function listUserDesigns(userId: string, input: { page?: number; pageSize?: number } = {}): Promise<AdminPage<AdminUserDesignItem>> {
  const page = input.page && Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
  const pageSize = input.pageSize && Number.isInteger(input.pageSize) ? Math.min(100, Math.max(1, input.pageSize)) : 100;
  const designs = await listDesigns({ userId, page, pageSize, sort: 'updated', dir: 'desc' });
  return { ...designs, items: designs.items.map((item) => ({ ...item, href: adminDesignHref(item.id) })) };
}

export type AdminUserProjectItem = {
  id: string;
  name: string;
  isDefault: boolean;
  designCount: number;
  sceneCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  href: string;
};

export async function listUserProjects(userId: string, input: { page?: number; pageSize?: number } = {}): Promise<AdminPage<AdminUserProjectItem>> {
  await ensureV2Schema();
  const page = input.page && Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
  const pageSize = input.pageSize && Number.isInteger(input.pageSize) ? Math.min(100, Math.max(1, input.pageSize)) : 100;
  const offset = (page - 1) * pageSize;
  const rows = await getSql().query(`
    SELECT wp.id, wp.name, wp.is_default, wp.created_at,
      GREATEST(wp.updated_at, COALESCE(d.updated_at, wp.updated_at), COALESCE(sc.updated_at, wp.updated_at)) AS updated_at,
      COALESCE(d.count, 0) AS design_count, COALESCE(sc.count, 0) AS scene_count,
      COUNT(*) OVER()::int AS total
    FROM workspace_projects wp
    LEFT JOIN LATERAL (SELECT COUNT(*)::int AS count, MAX(p.updated_at) AS updated_at FROM projects p WHERE p.user_id=wp.user_id AND p.workspace_project_id=wp.id) d ON true
    LEFT JOIN LATERAL (SELECT COUNT(*)::int AS count, MAX(x.updated_at) AS updated_at FROM scenes x WHERE x.user_id=wp.user_id AND x.workspace_project_id=wp.id) sc ON true
    WHERE wp.user_id=$1
    ORDER BY wp.is_default DESC, updated_at DESC NULLS LAST, wp.id
    LIMIT $2 OFFSET $3
  `, [userId, pageSize, offset]) as {
    id: string;
    name: string | null;
    is_default: boolean;
    created_at: string | Date | null;
    updated_at: string | Date | null;
    design_count: number;
    scene_count: number;
    total: number;
  }[];
  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name?.trim() || 'Untitled project',
      isDefault: Boolean(row.is_default),
      designCount: Number(row.design_count || 0),
      sceneCount: Number(row.scene_count || 0),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      href: `/admin/designs?user=${encodeURIComponent(userId)}`,
    })),
    total: Number(rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getDesignPreviewSource(id: string): Promise<{ dataUrl: string } | { storageKey: string } | null> {
  await ensureV2Schema();
  const designId = decodeRouteParam(id).slice(0, 200);
  if (!designId) return null;
  const legacy = legacyKey(designId);
  const rows = await getSql().query(`
    SELECT preview FROM (
      SELECT preview_image_key AS preview, 0 AS ord FROM projects WHERE id=$1
      UNION ALL
      SELECT COALESCE(NULLIF(payload->>'v2_og_image_key',''), NULLIF(payload->>'og_image_key','')), 1
      FROM legacy_records
      WHERE source=$2 AND entity_type='shared_designs' AND source_id=$3 AND deleted_at IS NULL
    ) sources
    WHERE NULLIF(preview, '') IS NOT NULL
    ORDER BY ord
    LIMIT 1
  `, [designId, legacy.source, legacy.sourceId]) as { preview: string }[];
  const preview = rows[0]?.preview?.trim();
  if (!preview) return null;
  if (preview.startsWith('data:image/')) return { dataUrl: preview };
  if (preview.includes('..') || preview.includes('\\') || preview.includes('\0')) return null;
  return { storageKey: preview };
}

export async function listDesigns(input: { q?: string; page?: number; pageSize?: number; userId?: string; sort?: string; dir?: string } = {}): Promise<AdminPage<AdminDesignRow>> {
  await ensureV2Schema();
  const q = parseAdminQuery(input.q);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const userId = input.userId ?? '';
  const sort = parseAdminSort(input.sort, DESIGN_SORTS, 'updated');
  const dir = parseAdminDir(input.dir, 'desc');
  const order = orderSql(DESIGN_SORT_SQL[sort], dir, 'd.id');
  // The page is chosen first; images, thumbnails and shares are then looked
  // up for its rows only (images for every row only when sorting by them).
  const rows = await getSql().query(`
    WITH designs AS (${designsSql(`($1='' OR p.user_id=$1)`, `($1='' OR lr.payload->>'user_id'=$1)`)}),
    d AS (
      SELECT d.*, u.name AS user_name, u.email AS user_email,
        COUNT(*) OVER()::int AS total, ROW_NUMBER() OVER (ORDER BY ${order}) AS ord
      FROM designs d
      LEFT JOIN users u ON u.id=d.user_id
      ${sort === 'images' ? IMAGE_LATERAL : ''}
      WHERE $2='' OR strpos(lower(COALESCE(d.name,'')), lower($2))>0 OR strpos(lower(COALESCE(u.name,'')), lower($2))>0 OR strpos(lower(COALESCE(u.email,'')), lower($2))>0
      ORDER BY ${order}
      LIMIT $3 OFFSET $4
    )
    SELECT ${DESIGN_COLUMNS}, d.total
    FROM d ${DESIGN_IMAGES}
    ORDER BY d.ord
  `, [userId, q, pageSize, offset]) as DesignQueryRow[];
  return { items: rows.map(presentDesign), total: Number(rows[0]?.total ?? 0), page, pageSize };
}

export async function getDesign(id: string): Promise<AdminDesignDetail | null> {
  await ensureV2Schema();
  const designId = decodeRouteParam(id);
  const legacy = legacyKey(designId);
  const [rows, media] = await Promise.all([
    getSql().query(`
      WITH d AS (
        SELECT d.*, u.name AS user_name, u.email AS user_email
        FROM (${designsSql('p.id=$1', 'lr.source=$2 AND lr.source_id=$3')}) d
        LEFT JOIN users u ON u.id=d.user_id
        LIMIT 1
      )
      SELECT ${DESIGN_COLUMNS} FROM d ${DESIGN_IMAGES}
    `, [designId, legacy.source, legacy.sourceId]).then((result) => result as DesignQueryRow[]),
    listMedia({ designId, page: 1, pageSize: 100 }),
  ]);
  const design = rows[0];
  if (!design) return null;
  return { ...presentDesign(design), images: media.items };
}

export type AdminDesignView = {
  id: string;
  name: string;
  legacy: boolean;
  state: StudioProjectState;
};

export async function getAdminDesignView(id: string): Promise<AdminDesignView | null> {
  await ensureV2Schema();
  const designId = decodeRouteParam(id).slice(0, 200);
  if (!designId) return null;
  const sql = getSql();
  const projectRows = await sql.query(`
    SELECT id, name, studio_state FROM projects WHERE id=$1 LIMIT 1
  `, [designId]) as { id: string; name: string | null; studio_state: unknown }[];
  const project = projectRows[0];
  if (project && validProjectState(project.studio_state)) {
    return {
      id: project.id,
      name: project.name?.trim() || 'Untitled',
      legacy: Boolean(project.studio_state.legacySourceId),
      state: rewriteAdminMediaUrls(project.studio_state, project.id),
    };
  }
  const key = legacyKey(designId);
  const legacyRows = await sql.query(`
    SELECT source, source_id, payload
    FROM legacy_records
    WHERE source=$1 AND entity_type='shared_designs' AND source_id=$2 AND deleted_at IS NULL
    LIMIT 1
  `, [key.source, key.sourceId]) as { source: string; source_id: string; payload: unknown }[];
  const legacy = legacyRows[0];
  if (!legacy) return null;
  const converted = legacyDesignToStudioProject({
    source: legacy.source,
    sourceId: legacy.source_id,
    payload: legacy.payload,
    mediaByFace: adminLegacyMediaByFace(designId, legacy.payload),
  });
  if (!converted || !validProjectState(converted.state)) return null;
  return {
    id: designId,
    name: converted.name,
    legacy: true,
    state: converted.state,
  };
}

export async function getAdminDesignMedia(id: string, assetId: string): Promise<{ storage_key: string; mime_type: string; name: string } | null> {
  const designId = decodeRouteParam(id).slice(0, 200);
  if (!designId || !ASSET_ID.test(assetId)) return null;
  await ensureV2Schema();
  const rows = await getSql().query(`
    SELECT p.studio_state, ma.storage_key, ma.mime_type, ma.name
    FROM projects p
    JOIN media_assets ma ON ma.user_id=p.user_id AND ma.id=$2
    WHERE p.id=$1
    LIMIT 1
  `, [designId, assetId]) as { studio_state: unknown; storage_key: string; mime_type: string; name: string }[];
  const row = rows[0];
  if (!row || !validProjectState(row.studio_state)) return null;
  const ids = new Set([
    ...row.studio_state.mediaAssets.map((item) => item.id),
    ...Object.values(row.studio_state.artworkByPanel).map((item) => item.assetId).filter(Boolean),
    ...row.studio_state.outsideArtworkLayers.map((item) => item.assetId).filter(Boolean),
    ...row.studio_state.insideArtworkLayers.map((item) => item.assetId).filter(Boolean),
  ]);
  return ids.has(assetId) ? row : null;
}

export async function getAdminDesignLegacyMedia(id: string, faceId: string): Promise<{ storageKey: string; mime: string; name: string } | null> {
  const designId = decodeRouteParam(id).slice(0, 200);
  if (!designId || !FACE_ID.test(faceId)) return null;
  await ensureV2Schema();
  const sql = getSql();
  const key = legacyKey(designId);
  const legacyRows = await sql.query(`
    SELECT source, source_id, payload
    FROM legacy_records
    WHERE source=$1 AND entity_type='shared_designs' AND source_id=$2 AND deleted_at IS NULL
    LIMIT 1
  `, [key.source, key.sourceId]) as { source: string; source_id: string; payload: unknown }[];
  const legacy = legacyRows[0];
  if (!legacy) return null;
  const payload = jsonRecord(legacy.payload);
  const images = jsonRecord(payload.images);
  const entry = jsonRecord(images[faceId]);
  let storageKey = typeof entry.v2StorageKey === 'string' ? entry.v2StorageKey : '';
  if (!storageKey) {
    const sourceKey = typeof entry.s3Key === 'string' ? entry.s3Key : typeof entry.s3_key === 'string' ? entry.s3_key : '';
    if (!sourceKey) return null;
    const { ensureLegacyStoredObject } = await import('@/server/media-assets');
    storageKey = await ensureLegacyStoredObject(sourceKey);
    const nextEntry = { ...entry, v2StorageKey: storageKey };
    const nextPayload = { ...payload, images: { ...images, [faceId]: nextEntry } };
    await sql.query(`
      UPDATE legacy_records
      SET payload=$1::jsonb
      WHERE source=$2 AND entity_type='shared_designs' AND source_id=$3
    `, [JSON.stringify(nextPayload), legacy.source, legacy.source_id]);
  }
  return {
    storageKey,
    mime: typeof entry.mime === 'string' && entry.mime ? entry.mime : 'image/png',
    name: typeof entry.name === 'string' && entry.name ? entry.name : `${faceId}-artwork`,
  };
}

export async function listMedia(input: { q?: string; page?: number; pageSize?: number; userId?: string; designId?: string; sort?: string; dir?: string } = {}): Promise<AdminPage<AdminMediaItem>> {
  await ensureV2Schema();
  const q = parseAdminQuery(input.q);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const userId = input.userId ?? '';
  const designId = input.designId ?? '';
  const legacy = legacyKey(designId);
  const sort = parseAdminSort(input.sort, MEDIA_SORTS, 'added');
  const dir = parseAdminDir(input.dir, 'desc');
  // Which designs use each image is looked up for the page only, unless the
  // list is sorted or searched by them.
  const designsFirst = sort === 'designs' || q !== '';
  const order = orderSql(MEDIA_SORT_SQL[sort], dir, 'g.storage_key');
  const designsOf = (g: string) => `
    SELECT ${g}.legacy_designs || COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('id', p.id, 'name', p.name))
      FROM projects p
      WHERE cardinality(${g}.asset_ids) > 0
        AND p.media_refs ?| (${g}.asset_ids || ARRAY(SELECT '/api/media/' || a FROM unnest(${g}.asset_ids) a))
    ), '[]'::jsonb) AS designs`;
  const rows = await getSql().query(`
    WITH legacy_keys AS (
      SELECT img.value->>'s3Key' AS storage_key,
        COALESCE(NULLIF(img.value->>'name',''), NULLIF(img.key,''), 'Artwork') AS name,
        NULLIF(img.value->>'mime','') AS mime_type,
        admin_ts(lr.payload->>'created_at') AS created_at,
        NULLIF(lr.payload->>'user_id','') AS user_id,
        lr.source || ':' || lr.source_id AS design_id,
        COALESCE(NULLIF(lr.payload->>'name',''), 'Untitled') AS design_name
      FROM legacy_records lr CROSS JOIN LATERAL ${LEGACY_IMAGES} img(key, value)
      WHERE ${LEGACY_DESIGN} AND NULLIF(img.value->>'s3Key','') IS NOT NULL
        AND ($1='' OR lr.payload->>'user_id'=$1) AND ($2='' OR (lr.source=$6 AND lr.source_id=$7))
      UNION ALL
      SELECT lr.payload->>'og_image_key',
        COALESCE(NULLIF(regexp_replace(lr.payload->>'og_image_key', '^.*/', ''), ''), 'Preview'),
        'image/png', admin_ts(lr.payload->>'created_at'), NULLIF(lr.payload->>'user_id',''),
        lr.source || ':' || lr.source_id, COALESCE(NULLIF(lr.payload->>'name',''), 'Untitled')
      FROM legacy_records lr
      WHERE ${LEGACY_DESIGN} AND NULLIF(lr.payload->>'og_image_key','') IS NOT NULL
        AND ($1='' OR lr.payload->>'user_id'=$1) AND ($2='' OR (lr.source=$6 AND lr.source_id=$7))
    ),
    items AS (
      SELECT m.storage_key, m.name, m.mime_type, NULLIF(m.byte_size, 0) AS byte_size, m.created_at, m.user_id,
        m.id AS asset_id, NULL::text AS design_id, NULL::text AS design_name
      FROM media_assets m
      WHERE ($1='' OR m.user_id=$1)
        AND ($2='' OR m.id IN (
          SELECT regexp_replace(r.ref, '^/api/media/', '')
          FROM projects p CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.media_refs, '[]'::jsonb)) r(ref)
          WHERE p.id=$2
        ))
      UNION ALL
      SELECT storage_key, name, mime_type, NULL::bigint, created_at, user_id, NULL, design_id, design_name FROM legacy_keys
    ),
    grouped AS (
      SELECT storage_key,
        (array_agg(name ORDER BY created_at DESC NULLS LAST))[1] AS name,
        (array_agg(mime_type ORDER BY created_at DESC NULLS LAST) FILTER (WHERE mime_type IS NOT NULL))[1] AS mime_type,
        MAX(byte_size) AS byte_size,
        MAX(created_at) AS created_at,
        (array_agg(user_id ORDER BY created_at DESC NULLS LAST) FILTER (WHERE user_id IS NOT NULL))[1] AS user_id,
        COALESCE(array_agg(DISTINCT asset_id) FILTER (WHERE asset_id IS NOT NULL), '{}') AS asset_ids,
        COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', design_id, 'name', design_name)) FILTER (WHERE design_id IS NOT NULL), '[]'::jsonb) AS legacy_designs
      FROM items
      WHERE storage_key IS NOT NULL
      GROUP BY storage_key
    ),
    g AS (
      SELECT g.*${designsFirst ? ', ud.designs' : ''}
      FROM grouped g ${designsFirst ? `CROSS JOIN LATERAL (${designsOf('g')}) ud` : ''}
    ),
    page AS (
      SELECT g.*, u.name AS user_name, u.email AS user_email,
        COUNT(*) OVER()::int AS total, ROW_NUMBER() OVER (ORDER BY ${order}) AS ord
      FROM g
      LEFT JOIN users u ON u.id=g.user_id
      WHERE $3='' OR strpos(lower(COALESCE(g.name,'')), lower($3))>0 OR strpos(lower(COALESCE(u.name,'')), lower($3))>0 OR strpos(lower(COALESCE(u.email,'')), lower($3))>0
        ${designsFirst ? `OR EXISTS (SELECT 1 FROM jsonb_array_elements(g.designs) x WHERE strpos(lower(COALESCE(x->>'name','')), lower($3))>0)` : ''}
      ORDER BY ${order}
      LIMIT $4 OFFSET $5
    )
    SELECT page.storage_key, page.name, page.mime_type, page.byte_size, page.created_at, page.user_id,
      page.user_name, page.user_email, page.total, ${designsFirst ? 'page.designs' : 'ud.designs'}
    FROM page ${designsFirst ? '' : `CROSS JOIN LATERAL (${designsOf('page')}) ud`}
    ORDER BY page.ord
  `, [userId, designId, q, pageSize, offset, legacy.source, legacy.sourceId]) as MediaQueryRow[];
  const missing = rows.filter((row) => row.byte_size == null);
  const sizes = await resolveMediaSizes(missing.map((row) => row.storage_key));
  for (const row of missing) row.byte_size = sizes.get(row.storage_key) ?? null;
  return { items: rows.map(presentMedia), total: Number(rows[0]?.total ?? 0), page, pageSize };
}

export async function findListedMedia(storageKey: string): Promise<{ name: string; mimeType: string | null } | null> {
  if (!isCatalogMediaKey(storageKey)) return null;
  await ensureV2Schema();
  const sql = getSql();
  // Uploaded images are found by their indexed key; only a key no upload has
  // is looked for among legacy designs' faces and previews.
  const native = await sql.query(`
    SELECT name, mime_type FROM media_assets WHERE storage_key=$1 ORDER BY created_at DESC NULLS LAST LIMIT 1
  `, [storageKey]) as { name: string | null; mime_type: string | null }[];
  const row = native[0] ?? (await sql.query(`
    SELECT name, mime_type FROM (
      SELECT COALESCE(NULLIF(img.value->>'name',''), NULLIF(img.key,''), 'Artwork') AS name, NULLIF(img.value->>'mime','') AS mime_type,
        admin_ts(lr.payload->>'created_at') AS created_at
      FROM legacy_records lr CROSS JOIN LATERAL ${LEGACY_IMAGES} img(key, value)
      WHERE ${LEGACY_DESIGN} AND img.value->>'s3Key'=$1
      UNION ALL
      SELECT COALESCE(NULLIF(regexp_replace(lr.payload->>'og_image_key', '^.*/', ''), ''), 'Preview'), 'image/png', admin_ts(lr.payload->>'created_at')
      FROM legacy_records lr
      WHERE ${LEGACY_DESIGN} AND lr.payload->>'og_image_key'=$1
    ) legacy
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
  `, [storageKey]) as { name: string | null; mime_type: string | null }[])[0];
  if (!row) return null;
  return { name: row.name?.trim() || fileName(storageKey), mimeType: row.mime_type };
}
