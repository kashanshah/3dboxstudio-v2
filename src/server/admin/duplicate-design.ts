import { createHash, randomUUID } from 'node:crypto';
import { legacyDesignToStudioProject } from '@/lib/legacy-design-converter';
import { decodeRouteParam } from '@/lib/route-params';
import { validProjectState, type StudioProjectState } from '@/lib/studio-project';
import type { LocalMediaAsset } from '@/lib/packaging/artwork';
import { getAdminDesignLegacyMedia } from '@/server/admin/catalog';
import { ensureV2Schema, getSql } from '@/server/db';
import { copyStoredObjectToUser, type MediaAssetDto } from '@/server/media-assets';
import { resolveWorkspaceProjectId } from '@/server/workspace-projects';

// Admins open any design (V2 or legacy) in the editor by copying it into the
// Studio account they are signed in to, to try what its owner could and could
// not do. The original and its owner's images are never touched: every image
// the design uses is copied into the signed-in account's own storage.

const MEDIA_URL = /^\/api\/media\/([^/?#]+)$/;
const NAME_SUFFIX = ' (admin copy)';

type AssetRef = { assetId?: string; url: string };

function assetIdOf(item: AssetRef) {
  if (item.assetId) return item.assetId;
  const match = MEDIA_URL.exec(item.url);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Points the design's artwork at the copied images; anything not copied stays as it was. */
export function remapStateMedia(state: StudioProjectState, copies: Map<string, MediaAssetDto>): StudioProjectState {
  const swap = <T extends AssetRef>(item: T): T => {
    const id = assetIdOf(item);
    const copy = id ? copies.get(id) : undefined;
    return copy ? { ...item, assetId: copy.id, url: copy.url } : item;
  };
  return {
    ...withoutLegacySource(state),
    artworkByPanel: Object.fromEntries(Object.entries(state.artworkByPanel).map(([key, item]) => [key, swap(item)])),
    outsideArtworkLayers: state.outsideArtworkLayers.map(swap),
    insideArtworkLayers: state.insideArtworkLayers.map(swap),
    // The library lists only images the copy can actually load.
    mediaAssets: state.mediaAssets.flatMap((item) => {
      const copy = copies.get(item.id);
      return copy ? [{ ...item, ...copy }] : [];
    }),
  };
}

/**
 * The copy is a normal project of the signed-in account: it must not claim to
 * be the owner's legacy design, which saving would otherwise try to adopt.
 */
function withoutLegacySource(state: StudioProjectState): StudioProjectState {
  const copy = { ...state };
  delete copy.legacySourceId;
  return copy;
}

function referencedAssetIds(state: StudioProjectState) {
  const ids = new Set<string>(state.mediaAssets.map((item) => item.id));
  for (const item of [...Object.values(state.artworkByPanel), ...state.outsideArtworkLayers, ...state.insideArtworkLayers]) {
    const id = assetIdOf(item);
    if (id) ids.add(id);
  }
  return [...ids];
}

async function copyProjectDesign(designId: string, userId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, user_id, name, studio_state, preview_image_key FROM projects WHERE id=${designId} LIMIT 1
  ` as { id: string; user_id: string; name: string | null; studio_state: unknown; preview_image_key: string | null }[];
  const project = rows[0];
  if (!project || !validProjectState(project.studio_state)) return null;
  const state = project.studio_state;
  const ids = referencedAssetIds(state);
  const assets = ids.length ? await sql`
    SELECT id, name, mime_type, byte_size, width, height, storage_key, fingerprint
    FROM media_assets WHERE user_id=${project.user_id} AND id=ANY(${ids})
  ` as { id: string; name: string; mime_type: string; byte_size: number | string; width: number | null; height: number | null; storage_key: string; fingerprint: string | null }[] : [];
  const copies = new Map<string, MediaAssetDto>();
  for (const asset of assets) {
    copies.set(asset.id, await copyStoredObjectToUser(userId, {
      storageKey: asset.storage_key, name: asset.name, mimeType: asset.mime_type,
      byteSize: Number(asset.byte_size || 0), width: asset.width, height: asset.height, fingerprint: asset.fingerprint,
    }));
  }
  const preview = project.preview_image_key?.startsWith('data:image/') ? project.preview_image_key : null;
  return { name: project.name?.trim() || 'Untitled', state: remapStateMedia(state, copies), preview };
}

async function copyLegacyDesign(designId: string, userId: string) {
  const rows = await getSql()`
    SELECT source, source_id, payload FROM legacy_records
    WHERE entity_type='shared_designs' AND deleted_at IS NULL AND source || ':' || source_id=${designId}
    LIMIT 1
  ` as { source: string; source_id: string; payload: unknown }[];
  const legacy = rows[0];
  if (!legacy) return null;
  const payload = legacy.payload && typeof legacy.payload === 'object' ? legacy.payload as Record<string, unknown> : {};
  const images = payload.images && typeof payload.images === 'object' ? payload.images as Record<string, unknown> : {};
  const mediaByFace: Record<string, LocalMediaAsset> = {};
  for (const faceId of Object.keys(images)) {
    const media = await getAdminDesignLegacyMedia(designId, faceId).catch((error) => {
      console.warn('admin copy: legacy artwork unavailable', { designId, faceId, error: error instanceof Error ? error.message : String(error) });
      return null;
    });
    if (!media) continue;
    mediaByFace[faceId] = await copyStoredObjectToUser(userId, {
      storageKey: media.storageKey, name: media.name, mimeType: media.mime, width: null, height: null,
      fingerprint: 'legacy:' + createHash('sha256').update(media.storageKey).digest('hex'),
    });
  }
  const converted = legacyDesignToStudioProject({ source: legacy.source, sourceId: legacy.source_id, payload: legacy.payload, mediaByFace });
  if (!converted || !validProjectState(converted.state)) return null;
  return { name: converted.name, state: withoutLegacySource(converted.state), preview: null };
}

/** Copies a design into the given Studio account; returns the new project's id, or null when the design is not found. */
export async function duplicateDesignForUser(id: string, userId: string): Promise<{ id: string } | null> {
  await ensureV2Schema();
  const designId = decodeRouteParam(id).slice(0, 200);
  if (!designId) return null;
  const copy = await copyProjectDesign(designId, userId) ?? await copyLegacyDesign(designId, userId);
  if (!copy) return null;
  const projectId = randomUUID();
  const name = copy.name.slice(0, 120 - NAME_SUFFIX.length) + NAME_SUFFIX;
  const workspaceProjectId = await resolveWorkspaceProjectId(userId, null);
  await getSql()`
    INSERT INTO projects(id, user_id, name, studio_state, preview_image_key, workspace_project_id)
    VALUES(${projectId}, ${userId}, ${name}, ${JSON.stringify(copy.state)}::jsonb, ${copy.preview}, ${workspaceProjectId})
  `;
  return { id: projectId };
}
