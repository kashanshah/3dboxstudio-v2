import { isCatalogMediaKey, mediaFileId, storageKeyFromMediaFileId } from '@/lib/admin-media';
import type { DeletionItem, DeletionKind } from '@/lib/admin-deletion';

type Entity = { id: string; name: string; user_id?: string; workspace_project_id?: string; preview_image_key?: string; revision?: number };
export type Snapshot = {
  users: { id: string; name: string; email: string }[];
  folders: Entity[];
  designs: (Entity & { studio_state: unknown })[];
  scenes: (Entity & { scene_state: unknown })[];
  shares: (Entity & { project_id?: string; legacy_source?: boolean; studio_state: unknown; legacy_assets: unknown })[];
  media: (Entity & { storage_key: string })[];
  legacy: { source: string; entity_type: string; source_id: string; payload: unknown }[];
  auth: { label: string; user_id: string; count: number }[];
};
type Legacy = Snapshot['legacy'][number];
export type DeletionPlan = {
  name: string;
  folders: Entity[];
  designs: Snapshot['designs'];
  scenes: Snapshot['scenes'];
  shares: Snapshot['shares'];
  media: Snapshot['media'];
  legacy: Legacy[];
  keys: string[];
  retainedMedia: DeletionItem[];
  groups: { label: string; items: DeletionItem[] }[];
  updates: { label: string; items: DeletionItem[] }[];
  changes: { table: 'projects' | 'scenes' | 'design_shares' | 'legacy_records'; id: string; value: unknown; extra?: unknown }[];
};
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function strings(value: unknown): Set<string> {
  if (typeof value === 'string') return new Set([value]);
  const out = new Set<string>();
  for (const child of Array.isArray(value) ? value : Object.values(record(value))) for (const s of strings(child)) out.add(s);
  return out;
}
function mediaRefs(m: Snapshot['media'][number]): Set<string> {
  return new Set([m.id, m.storage_key, `/api/media/${m.id}`]);
}
function intersects(a: Set<string>, b: Set<string>) { return [...a].some(s => b.has(s)); }
function legacyId(l: Legacy) { return `${l.source}:${l.source_id}`; }
export function legacyBlockId(l: Legacy) { return `${l.source}:${l.entity_type}:${l.source_id}`; }
function item(row: Entity): DeletionItem { return { id: row.id, name: row.name || row.id }; }
function legacyItem(row: Legacy): DeletionItem { return { id: legacyId(row), name: String(record(row.payload).name || row.source_id) }; }
function keysFrom(value: unknown) { return [...strings(value)].filter(isCatalogMediaKey); }

// Remove complete artwork/layer/library objects, preserving the surrounding state.
// Exact references avoid matching an asset ID embedded in an unrelated string.
export function stripReferences(value: unknown, refs: Set<string>): unknown {
  if (typeof value === 'string') return refs.has(value) ? null : value;
  if (Array.isArray(value)) return value.filter(v => !directReference(v, refs)).map(v => stripReferences(v, refs));
  const obj = record(value);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => !directReference(v, refs)).map(([k, v]) => [k, stripReferences(v, refs)]));
}
function directReference(value: unknown, refs: Set<string>): boolean {
  if (typeof value === 'string') return refs.has(value);
  return Object.values(record(value)).some(v => typeof v === 'string' && refs.has(v));
}

function cleanScene(value: unknown) {
  const state = record(value);
  return { ...state, background: state.background || { type: 'transparent' }, environment: state.environment || null };
}

export function buildDeletionPlan(s: Snapshot, kind: DeletionKind, id: string): DeletionPlan | null {
  const referenceCache = new Map<unknown, Set<string>>();
  const references = (value: unknown) => {
    let cached = referenceCache.get(value);
    if (!cached) { cached = strings(value); referenceCache.set(value, cached); }
    return cached;
  };
  const user = kind === 'user' ? s.users.find(u => u.id === id) : undefined;
  const folder = kind === 'project' ? s.folders.find(p => p.id === id) : undefined;
  const design = kind === 'design' ? s.designs.find(d => d.id === id) : undefined;
  const legacyDesign = kind === 'design' ? s.legacy.find(l => l.entity_type === 'shared_designs' && legacyId(l) === id) : undefined;
  const key = kind === 'media' ? storageKeyFromMediaFileId(id) : null;
  const mediaRow = key ? s.media.find(m => m.storage_key === key) : undefined;
  const legacyMedia = key ? s.legacy.find(l => references(l.payload).has(key)) : undefined;
  if (!(user || folder || design || legacyDesign || mediaRow || legacyMedia)) return null;
  const folders = user ? s.folders.filter(p => p.user_id === id) : folder ? [folder] : [];
  const folderIds = new Set(folders.map(p => p.id));
  const designs = s.designs.filter(d => user ? d.user_id === id : design ? d.id === id : legacyDesign ? record(d.studio_state).legacySourceId === id : folderIds.has(d.workspace_project_id || ''));
  const designIds = new Set(designs.map(d => d.id));
  // Removing an imported V2 design must also remove its original legacy entry,
  // otherwise it immediately reappears in the user's workspace.
  const sourceIds = new Set(designs.map(d => record(d.studio_state).legacySourceId).filter(v => typeof v === 'string'));
  const legacy = s.legacy.filter(l => user ? record(l.payload).user_id === id || (l.entity_type === 'users' && l.source_id === id) : l === legacyDesign || (l.entity_type === 'shared_designs' && sourceIds.has(legacyId(l))));
  const legacyIds = new Set(legacy.map(legacyId));
  const scenes = s.scenes.filter(sc => user ? sc.user_id === id : folderIds.has(sc.workspace_project_id || ''));
  const shares = s.shares.filter(sh => (user && sh.user_id === id) || designIds.has(sh.project_id || '') || (sh.legacy_source && legacy.some(l => l.entity_type === 'shared_designs' && l.source_id === sh.id)));
  const keys = new Set<string>(key ? [key] : []);
  // The media catalog may identify a legacy file by its source key, while
  // saved designs use the migrated copy. Treat those as one deletion target.
  if (key) {
    for (const l of s.legacy) {
      const payload = record(l.payload);
      for (const image of Object.values(record(payload.images))) {
        const aliases = keysFrom(image);
        if (aliases.includes(key)) for (const alias of aliases) keys.add(alias);
      }
      const previews = [payload.og_image_key, payload.v2_og_image_key].filter((v): v is string => typeof v === 'string' && isCatalogMediaKey(v));
      if (previews.includes(key)) for (const alias of previews) keys.add(alias);
    }
  }
  for (const row of [...designs, ...scenes, ...shares]) for (const k of keysFrom(row)) keys.add(k);
  for (const l of legacy) for (const k of keysFrom(l.payload)) keys.add(k);
  for (const m of s.media) {
    if ((user && m.user_id === id) || designs.some(d => intersects(references(d.studio_state), mediaRefs(m)))) keys.add(m.storage_key);
  }
  // Native asset IDs can occur in share snapshots and scene backgrounds too.
  for (const m of s.media) if ([...scenes, ...shares].some(row => intersects(references(row), mediaRefs(m)))) keys.add(m.storage_key);
  const remainingDesigns = s.designs.filter(d => !designIds.has(d.id));
  const remainingScenes = s.scenes.filter(sc => !scenes.includes(sc));
  const remainingShares = s.shares.filter(sh => !shares.includes(sh));
  const remainingLegacy = s.legacy.filter(l => !legacy.includes(l));
  const affectedOwners = new Set([
    ...(user ? [id] : []),
    ...[...folders, ...designs, ...scenes, ...shares].map(row => row.user_id),
    ...legacy.map(row => record(row.payload).user_id),
  ].filter((owner): owner is string => typeof owner === 'string'));
  const retainedMedia: DeletionItem[] = [];
  // Cascades preserve files used by surviving records. Direct media deletion
  // intentionally removes placements from those records, without deleting them.
  if (kind !== 'media') for (const k of [...keys]) {
    const refs = new Set([k]);
    for (const m of s.media.filter(m => m.storage_key === k)) for (const ref of mediaRefs(m)) refs.add(ref);
    if ([...remainingDesigns, ...remainingScenes, ...remainingShares, ...remainingLegacy.map(l => l.payload)].some(row => intersects(references(row), refs)) || s.media.some(m => m.storage_key === k && !affectedOwners.has(m.user_id || ''))) {
      keys.delete(k);
      retainedMedia.push({ id: mediaFileId(k), name: s.media.find(m => m.storage_key === k)?.name || k });
    }
  }
  const media = s.media.filter(m => keys.has(m.storage_key) || (user && m.user_id === id));
  const changes: DeletionPlan['changes'] = [];
  const updates: DeletionPlan['updates'] = [];
  const refs = new Set<string>(kind === 'media' ? keys : []);
  for (const m of media) if (keys.has(m.storage_key)) for (const ref of mediaRefs(m)) refs.add(ref);
  if (kind === 'media') {
    const changedDesigns: DeletionItem[] = [], changedScenes: DeletionItem[] = [], changedShares: DeletionItem[] = [], changedLegacy: DeletionItem[] = [];
    for (const d of remainingDesigns) if (intersects(references(d), refs)) { if (d.preview_image_key && isCatalogMediaKey(d.preview_image_key)) keys.add(d.preview_image_key); changes.push({ table: 'projects', id: d.id, value: stripReferences(d.studio_state, refs), extra: null }); changedDesigns.push(item(d)); }
    for (const sc of remainingScenes) if (intersects(references(sc), refs)) { if (sc.preview_image_key && isCatalogMediaKey(sc.preview_image_key)) keys.add(sc.preview_image_key); changes.push({ table: 'scenes', id: sc.id, value: cleanScene(stripReferences(sc.scene_state, refs)), extra: null }); changedScenes.push(item(sc)); }
    for (const sh of remainingShares) if (intersects(references(sh), refs)) {
      const shareRefs = new Set(refs);
      for (const [face, asset] of Object.entries(record(sh.legacy_assets))) {
        if (intersects(references(asset), refs)) {
          shareRefs.add(`legacy-share-${face}`);
          shareRefs.add(`/api/shares/${encodeURIComponent(sh.id)}/legacy-media/${encodeURIComponent(face)}`);
        }
      }
      changes.push({ table: 'design_shares', id: sh.id, value: stripReferences(sh.studio_state, shareRefs), extra: stripReferences(sh.legacy_assets, refs) });
      changedShares.push(item(sh));
    }
    for (const l of remainingLegacy) if (intersects(references(l.payload), refs)) { const payload = record(stripReferences(l.payload, refs)); for (const field of ['og_image_key', 'v2_og_image_key']) { const preview = payload[field]; if (typeof preview === 'string' && isCatalogMediaKey(preview)) keys.add(preview); delete payload[field]; } changes.push({ table: 'legacy_records', id: legacyBlockId(l), value: payload }); changedLegacy.push(legacyItem(l)); }
    updates.push({ label: 'Designs: remove media placements', items: changedDesigns }, { label: 'Scenes: remove media placements', items: changedScenes }, { label: 'Share links: remove media placements', items: changedShares }, { label: 'Legacy records: remove media placements', items: changedLegacy });
  }
  // Scenes hold live references to source designs, so remove those objects too.
  const deletedDesignRefs = new Set([...designIds, ...legacyIds]);
  for (const sc of remainingScenes) {
    const state = record(sc.scene_state);
    const objects = Array.isArray(state.objects) ? state.objects : [];
    if (objects.some(o => deletedDesignRefs.has(String(record(o).sourceDesignId)))) {
      if (sc.preview_image_key && isCatalogMediaKey(sc.preview_image_key)) keys.add(sc.preview_image_key);
      changes.push({ table: 'scenes', id: sc.id, value: { ...state, objects: objects.filter(o => !deletedDesignRefs.has(String(record(o).sourceDesignId))) }, extra: null });
      updates.push({ label: 'Scenes: remove deleted design objects', items: [item(sc)] });
    }
  }
  const groups = [
    { label: 'Users', items: user ? [{ id, name: `${user.name || user.email} (${user.email})` }] : [] },
    { label: 'Projects', items: folders.map(item) },
    { label: 'Designs', items: designs.map(item) },
    { label: 'Legacy designs', items: legacy.filter(l => l.entity_type === 'shared_designs').map(legacyItem) },
    { label: 'Scenes', items: scenes.map(item) },
    { label: 'Share links', items: shares.map(item) },
    { label: 'Media library entries', items: media.map(item) },
    { label: 'Stored files (including previews)', items: [...keys].sort().map(k => ({ id: mediaFileId(k), name: k })) },
    { label: 'Other legacy records', items: legacy.filter(l => l.entity_type !== 'shared_designs').map(l => ({ id: legacyBlockId(l), name: `${l.entity_type}: ${l.source_id}` })) },
    { label: 'Login and verification records', items: user ? s.auth.filter(a => a.user_id === id).map(a => ({ id: a.label, name: `${a.count} ${a.label}` })) : [] },
  ].filter(g => g.items.length);
  return { name: user?.email || folder?.name || design?.name || String(record(legacyDesign?.payload).name || mediaRow?.name || key || id), folders, designs, scenes, shares, media, legacy, keys: [...keys].sort(), retainedMedia, groups, updates: updates.filter(g => g.items.length), changes };
}
