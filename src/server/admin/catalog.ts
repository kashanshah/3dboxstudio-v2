import { ensureV2Schema, getSql } from '@/server/db';
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
  signupMethod: string;
  createdAt: string | null;
  projectCount: number;
  designCount: number;
  mediaCount: number;
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
  user: { id: string; name: string; href: string } | null;
};

export type AdminDesignDetail = AdminDesignRow & { images: AdminMediaItem[] };

export type AdminUserDetail = AdminUserRow & {
  designs: AdminDesignRow[];
};

export type AdminPage<T> = { items: T[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 24;

const mediaUsages = `
legacy_faces AS (
  SELECT img.value->>'s3Key' AS storage_key,
    COALESCE(NULLIF(img.value->>'name',''), NULLIF(img.key,''), 'Artwork') AS name,
    NULLIF(img.value->>'mime','') AS mime_type,
    (payload->>'created_at')::timestamptz AS created_at,
    NULLIF(payload->>'user_id','') AS user_id,
    source || ':' || source_id AS design_id,
    COALESCE(NULLIF(payload->>'name',''), 'Untitled') AS design_name
  FROM legacy_records
  CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(payload->'images')='object' THEN payload->'images' ELSE '{}'::jsonb END) AS img(key, value)
  WHERE entity_type='shared_designs' AND deleted_at IS NULL AND NULLIF(img.value->>'s3Key','') IS NOT NULL
),
legacy_previews AS (
  SELECT payload->>'og_image_key' AS storage_key,
    COALESCE(NULLIF(regexp_replace(payload->>'og_image_key', '^.*/', ''), ''), 'Preview') AS name,
    'image/png' AS mime_type,
    (payload->>'created_at')::timestamptz AS created_at,
    NULLIF(payload->>'user_id','') AS user_id,
    source || ':' || source_id AS design_id,
    COALESCE(NULLIF(payload->>'name',''), 'Untitled') AS design_name
  FROM legacy_records
  WHERE entity_type='shared_designs' AND deleted_at IS NULL AND NULLIF(payload->>'og_image_key','') IS NOT NULL
),
native_uses AS (
  SELECT m.storage_key, m.name, m.mime_type, m.created_at, m.user_id, p.id AS design_id, p.name AS design_name
  FROM media_assets m
  LEFT JOIN projects p ON position(m.id in p.studio_state::text) > 0
),
usages AS (
  SELECT * FROM legacy_faces
  UNION ALL SELECT * FROM legacy_previews
  UNION ALL SELECT * FROM native_uses
)`;

type MediaQueryRow = {
  storage_key: string;
  name: string | null;
  mime_type: string | null;
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
export const DESIGN_SORTS = ['name', 'owner', 'images', 'source', 'updated'] as const;
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
  images: `image_count`,
  source: `CASE WHEN d.legacy THEN 'legacy' ELSE 'v2' END`,
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
      href: adminUserHref(row.user_id),
    } : null,
  };
}

function presentUser(row: {
  id: string;
  name: string | null;
  email: string;
  email_verified_at: string | Date | null;
  signup_method: string | null;
  created_at: string | Date | null;
  project_count: number;
  design_count: number;
  media_count: number;
}): AdminUserRow {
  return {
    id: row.id,
    name: row.name?.trim() || row.email,
    email: row.email,
    verified: Boolean(row.email_verified_at),
    signupMethod: row.signup_method?.trim() || 'Unknown',
    createdAt: iso(row.created_at),
    projectCount: Number(row.project_count || 0),
    designCount: Number(row.design_count || 0),
    mediaCount: Number(row.media_count || 0),
  };
}

export async function listUsers(input: { q?: string; page?: number; sort?: string; dir?: string } = {}): Promise<AdminPage<AdminUserRow>> {
  await ensureV2Schema();
  const q = parseAdminQuery(input.q);
  const page = input.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;
  const sort = parseAdminSort(input.sort, USER_SORTS, 'joined');
  const dir = parseAdminDir(input.dir, 'desc');
  const rows = await getSql().query(`
    WITH ${mediaUsages},
    design_rows AS (
      SELECT id, user_id FROM projects
      UNION ALL
      SELECT source || ':' || source_id, NULLIF(payload->>'user_id','')
      FROM legacy_records WHERE entity_type='shared_designs' AND deleted_at IS NULL
    )
    SELECT u.id, u.name, u.email, u.email_verified_at, u.signup_method, u.created_at,
      (SELECT COUNT(*)::int FROM workspace_projects wp WHERE wp.user_id=u.id) AS project_count,
      (SELECT COUNT(*)::int FROM design_rows d WHERE d.user_id=u.id) AS design_count,
      (SELECT COUNT(DISTINCT storage_key)::int FROM usages WHERE user_id=u.id) AS media_count,
      COUNT(*) OVER()::int AS total
    FROM users u
    WHERE $1='' OR strpos(lower(COALESCE(u.name,'')), lower($1))>0 OR strpos(lower(u.email), lower($1))>0
    ORDER BY ${orderSql(USER_SORT_SQL[sort], dir, 'u.id')}
    LIMIT $2 OFFSET $3
  `, [q, PAGE_SIZE, offset]) as Array<Parameters<typeof presentUser>[0] & { total: number }>;
  return { items: rows.map(presentUser), total: Number(rows[0]?.total ?? 0), page, pageSize: PAGE_SIZE };
}

export async function getUser(id: string, list?: { sort?: string; dir?: string }): Promise<AdminUserDetail | null> {
  await ensureV2Schema();
  const rows = await getSql().query(`
    WITH ${mediaUsages},
    design_rows AS (
      SELECT id, user_id FROM projects
      UNION ALL
      SELECT source || ':' || source_id, NULLIF(payload->>'user_id','')
      FROM legacy_records WHERE entity_type='shared_designs' AND deleted_at IS NULL
    )
    SELECT u.id, u.name, u.email, u.email_verified_at, u.signup_method, u.created_at,
      (SELECT COUNT(*)::int FROM workspace_projects wp WHERE wp.user_id=u.id) AS project_count,
      (SELECT COUNT(*)::int FROM design_rows d WHERE d.user_id=u.id) AS design_count,
      (SELECT COUNT(DISTINCT storage_key)::int FROM usages WHERE user_id=u.id) AS media_count
    FROM users u WHERE u.id=$1 LIMIT 1
  `, [id]) as Parameters<typeof presentUser>[0][];
  const user = rows[0];
  if (!user) return null;
  const designs = await listDesigns({ userId: id, page: 1, pageSize: 100, sort: list?.sort, dir: list?.dir });
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
  await ensureV2Schema();
  const page = input.page && Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
  const pageSize = input.pageSize && Number.isInteger(input.pageSize) ? Math.min(100, Math.max(1, input.pageSize)) : 100;
  const offset = (page - 1) * pageSize;
  const rows = await getSql().query(`
    WITH ${mediaUsages},
    designs AS (
      SELECT id, name, false AS legacy, created_at, updated_at, user_id, 0::bigint AS views,
        (NULLIF(preview_image_key, '') IS NOT NULL) AS has_preview,
        NULL::text AS public_id, NULL::text AS preview_token
      FROM projects
      UNION ALL
      SELECT source || ':' || source_id,
        COALESCE(NULLIF(payload->>'name',''), 'Untitled'),
        true,
        (payload->>'created_at')::timestamptz,
        COALESCE((payload->>'updated_at')::timestamptz, (payload->>'created_at')::timestamptz),
        NULLIF(payload->>'user_id',''),
        COALESCE((payload->>'view_count')::bigint, 0),
        (NULLIF(COALESCE(payload->>'v2_og_image_key', payload->>'og_image_key'), '') IS NOT NULL),
        source_id, NULLIF(payload->>'preview_token','')
      FROM legacy_records WHERE entity_type='shared_designs' AND deleted_at IS NULL
    )
    SELECT d.id, d.name, d.legacy, d.created_at, d.updated_at, d.views, d.has_preview,
      d.public_id, d.preview_token, s.id AS share_id, s.preview_token AS share_preview_token,
      (SELECT COUNT(DISTINCT storage_key)::int FROM usages WHERE design_id=d.id) AS image_count,
      (SELECT storage_key FROM usages WHERE design_id=d.id ORDER BY created_at DESC NULLS LAST, storage_key LIMIT 1) AS thumb_storage_key,
      COUNT(*) OVER()::int AS total
    FROM designs d
    LEFT JOIN design_shares s ON NOT d.legacy AND s.project_id=d.id AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>NOW())
    WHERE d.user_id=$1
    ORDER BY d.updated_at DESC NULLS LAST, d.id
    LIMIT $2 OFFSET $3
  `, [userId, pageSize, offset]) as DesignQueryRow[];
  return {
    items: rows.map((row) => ({
      ...presentDesign(row),
      href: adminDesignHref(row.id),
    })),
    total: Number(rows[0]?.total ?? 0),
    page,
    pageSize,
  };
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
    SELECT
      wp.id, wp.name, wp.is_default, wp.created_at,
      GREATEST(
        wp.updated_at,
        COALESCE(MAX(d.updated_at), wp.updated_at),
        COALESCE(MAX(s.updated_at), wp.updated_at)
      ) AS updated_at,
      COUNT(DISTINCT d.id)::int AS design_count,
      COUNT(DISTINCT s.id)::int AS scene_count,
      COUNT(*) OVER()::int AS total
    FROM workspace_projects wp
    LEFT JOIN projects d ON d.workspace_project_id=wp.id
    LEFT JOIN scenes s ON s.workspace_project_id=wp.id
    WHERE wp.user_id=$1
    GROUP BY wp.id
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
  const rows = await getSql().query(`
    SELECT preview, legacy FROM (
      SELECT preview_image_key AS preview, false AS legacy, 0 AS ord FROM projects WHERE id=$1
      UNION ALL
      SELECT COALESCE(NULLIF(payload->>'v2_og_image_key',''), NULLIF(payload->>'og_image_key','')), true, 1
      FROM legacy_records
      WHERE entity_type='shared_designs' AND deleted_at IS NULL AND source || ':' || source_id=$1
    ) sources
    WHERE NULLIF(preview, '') IS NOT NULL
    ORDER BY ord
    LIMIT 1
  `, [designId]) as { preview: string; legacy: boolean }[];
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
  const rows = await getSql().query(`
    WITH ${mediaUsages},
    designs AS (
      SELECT id, name, false AS legacy, created_at, updated_at, user_id, 0::bigint AS views,
        NULL::text AS public_id, NULL::text AS preview_token,
        (NULLIF(preview_image_key, '') IS NOT NULL) AS has_preview
      FROM projects
      UNION ALL
      SELECT source || ':' || source_id,
        COALESCE(NULLIF(payload->>'name',''), 'Untitled'),
        true,
        (payload->>'created_at')::timestamptz,
        COALESCE((payload->>'updated_at')::timestamptz, (payload->>'created_at')::timestamptz),
        NULLIF(payload->>'user_id',''),
        COALESCE((payload->>'view_count')::bigint, 0),
        source_id, NULLIF(payload->>'preview_token',''),
        (NULLIF(COALESCE(payload->>'v2_og_image_key', payload->>'og_image_key'), '') IS NOT NULL)
      FROM legacy_records WHERE entity_type='shared_designs' AND deleted_at IS NULL
    )
    SELECT d.id, d.name, d.legacy, d.created_at, d.updated_at, d.views, d.has_preview,
      d.public_id, d.preview_token, s.id AS share_id, s.preview_token AS share_preview_token,
      (SELECT COUNT(DISTINCT storage_key)::int FROM usages WHERE design_id=d.id) AS image_count,
      (SELECT storage_key FROM usages WHERE design_id=d.id ORDER BY created_at DESC NULLS LAST, storage_key LIMIT 1) AS thumb_storage_key,
      d.user_id, u.name AS user_name, u.email AS user_email,
      COUNT(*) OVER()::int AS total
    FROM designs d
    LEFT JOIN users u ON u.id=d.user_id
    LEFT JOIN design_shares s ON NOT d.legacy AND s.project_id=d.id AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>NOW())
    WHERE ($1='' OR d.user_id=$1)
      AND ($2='' OR strpos(lower(COALESCE(d.name,'')), lower($2))>0 OR strpos(lower(COALESCE(u.name,'')), lower($2))>0 OR strpos(lower(COALESCE(u.email,'')), lower($2))>0)
    ORDER BY ${orderSql(DESIGN_SORT_SQL[sort], dir, 'd.id')}
    LIMIT $3 OFFSET $4
  `, [userId, q, pageSize, offset]) as DesignQueryRow[];
  return { items: rows.map(presentDesign), total: Number(rows[0]?.total ?? 0), page, pageSize };
}

export async function getDesign(id: string): Promise<AdminDesignDetail | null> {
  await ensureV2Schema();
  const designId = decodeRouteParam(id);
  const rows = await getSql().query(`
    WITH ${mediaUsages},
    designs AS (
      SELECT id, name, false AS legacy, created_at, updated_at, user_id, 0::bigint AS views,
        (NULLIF(preview_image_key, '') IS NOT NULL) AS has_preview,
        NULL::text AS public_id, NULL::text AS preview_token
      FROM projects WHERE id=$1
      UNION ALL
      SELECT source || ':' || source_id,
        COALESCE(NULLIF(payload->>'name',''), 'Untitled'),
        true,
        (payload->>'created_at')::timestamptz,
        COALESCE((payload->>'updated_at')::timestamptz, (payload->>'created_at')::timestamptz),
        NULLIF(payload->>'user_id',''),
        COALESCE((payload->>'view_count')::bigint, 0),
        (NULLIF(COALESCE(payload->>'v2_og_image_key', payload->>'og_image_key'), '') IS NOT NULL),
        source_id, NULLIF(payload->>'preview_token','')
      FROM legacy_records
      WHERE entity_type='shared_designs' AND deleted_at IS NULL AND source || ':' || source_id=$1
    )
    SELECT d.id, d.name, d.legacy, d.created_at, d.updated_at, d.views, d.has_preview,
      d.public_id, d.preview_token, s.id AS share_id, s.preview_token AS share_preview_token,
      (SELECT COUNT(DISTINCT storage_key)::int FROM usages WHERE design_id=d.id) AS image_count,
      (SELECT storage_key FROM usages WHERE design_id=d.id ORDER BY created_at DESC NULLS LAST, storage_key LIMIT 1) AS thumb_storage_key,
      d.user_id, u.name AS user_name, u.email AS user_email
    FROM designs d
    LEFT JOIN users u ON u.id=d.user_id
    LEFT JOIN design_shares s ON NOT d.legacy AND s.project_id=d.id AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>NOW())
    LIMIT 1
  `, [designId]) as DesignQueryRow[];
  const design = rows[0];
  if (!design) return null;
  const media = await listMedia({ designId, page: 1, pageSize: 100 });
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
  const legacyRows = await sql.query(`
    SELECT source, source_id, payload
    FROM legacy_records
    WHERE entity_type='shared_designs' AND deleted_at IS NULL AND source || ':' || source_id=$1
    LIMIT 1
  `, [designId]) as { source: string; source_id: string; payload: unknown }[];
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
  const legacyRows = await sql.query(`
    SELECT source, source_id, payload
    FROM legacy_records
    WHERE entity_type='shared_designs' AND deleted_at IS NULL AND source || ':' || source_id=$1
    LIMIT 1
  `, [designId]) as { source: string; source_id: string; payload: unknown }[];
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
  const sort = parseAdminSort(input.sort, MEDIA_SORTS, 'added');
  const dir = parseAdminDir(input.dir, 'desc');
  const rows = await getSql().query(`
    WITH ${mediaUsages},
    grouped AS (
      SELECT storage_key,
        (array_agg(name ORDER BY created_at DESC NULLS LAST))[1] AS name,
        (array_agg(mime_type ORDER BY created_at DESC NULLS LAST) FILTER (WHERE mime_type IS NOT NULL))[1] AS mime_type,
        MAX(created_at) AS created_at,
        (array_agg(user_id ORDER BY created_at DESC NULLS LAST) FILTER (WHERE user_id IS NOT NULL))[1] AS user_id,
        COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', design_id, 'name', design_name)) FILTER (WHERE design_id IS NOT NULL), '[]'::jsonb) AS designs
      FROM usages
      WHERE storage_key IS NOT NULL
      GROUP BY storage_key
    )
    SELECT g.storage_key, g.name, g.mime_type, g.created_at, g.user_id, g.designs,
      u.name AS user_name, u.email AS user_email, COUNT(*) OVER()::int AS total
    FROM grouped g
    LEFT JOIN users u ON u.id=g.user_id
    WHERE ($1='' OR g.user_id=$1)
      AND ($2='' OR EXISTS (SELECT 1 FROM jsonb_array_elements(g.designs) d WHERE d->>'id'=$2))
      AND ($3='' OR strpos(lower(COALESCE(g.name,'')), lower($3))>0 OR strpos(lower(COALESCE(u.name,'')), lower($3))>0 OR strpos(lower(COALESCE(u.email,'')), lower($3))>0
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(g.designs) d WHERE strpos(lower(COALESCE(d->>'name','')), lower($3))>0))
    ORDER BY ${orderSql(MEDIA_SORT_SQL[sort], dir, 'g.storage_key')}
    LIMIT $4 OFFSET $5
  `, [userId, designId, q, pageSize, offset]) as MediaQueryRow[];
  return { items: rows.map(presentMedia), total: Number(rows[0]?.total ?? 0), page, pageSize };
}

export async function findListedMedia(storageKey: string): Promise<{ name: string; mimeType: string | null } | null> {
  if (!isCatalogMediaKey(storageKey)) return null;
  await ensureV2Schema();
  const rows = await getSql().query(`
    WITH ${mediaUsages}
    SELECT name, mime_type FROM (
      SELECT (array_agg(name ORDER BY created_at DESC NULLS LAST))[1] AS name,
        (array_agg(mime_type ORDER BY created_at DESC NULLS LAST) FILTER (WHERE mime_type IS NOT NULL))[1] AS mime_type,
        COUNT(*)::int AS found
      FROM usages WHERE storage_key=$1
    ) listed WHERE found > 0
  `, [storageKey]) as { name: string | null; mime_type: string | null }[];
  const row = rows[0];
  if (!row) return null;
  return { name: row.name?.trim() || fileName(storageKey), mimeType: row.mime_type };
}
