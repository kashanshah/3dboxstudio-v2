# Artwork Library and Full-Dieline Artwork — Implementation Specification

Status: implementation-ready product/engineering spec  
Scope: V2 Studio artwork system  
Primary goals:
1. Upload assets once and reuse them across projects.
2. Support one master artwork across the whole dieline and automatically map it to 3D faces.
3. Keep per-panel artwork as an override path.
4. Make storage and entitlements measurable so premium limits can be introduced later.

## 1. Product principles

- A media asset is uploaded once, then referenced from many designs.
- The dieline and 3D renderer must consume the same artwork placement state.
- Full-dieline artwork is a first-class mode, not a collection of generated independent uploads.
- Per-panel artwork remains supported and can override the master dieline artwork.
- Project state stores asset references and transforms, never raw binary data or expiring URLs.
- Basic workflows remain understandable to non-technical users. Advanced print controls are progressively disclosed.

## 2. Artwork modes

Each project supports one of two artwork modes:

```ts
type ArtworkMode = 'per_panel' | 'full_dieline';
```

### Per-panel mode
Each panel can independently reference a library asset and placement.

### Full-dieline mode
A single library asset is positioned over the complete flat dieline. Each panel derives its 3D texture region from the master transform.

Panels may optionally override the inherited full-dieline artwork.

### Switching modes

Per-panel → full-dieline:
- Existing panel bindings remain stored but inactive.
- User selects or uploads a master asset.
- No destructive conversion occurs.

Full-dieline → per-panel:
- User chooses either:
  - keep prior per-panel artwork, or
  - create editable panel overrides from the current master mapping.
- Do not silently duplicate image binaries.

## 3. User experience

## Artwork tool landing state

Header:
**Artwork**
“Add your design to individual sides or across the whole box.”

Primary choice cards:
- **Separate artwork for each side**
  “Choose a different image for each panel.”
- **One artwork for the full layout**
  “Place one finished design over the whole dieline.”

Secondary action:
- **Choose from library**

Do not present all placement controls until artwork exists.

## Per-panel workflow

1. User chooses a panel in 2D or 3D.
2. Selected panel is clearly identified.
3. Show:
   - current artwork preview, if any
   - **Choose from library**
   - **Upload new**
4. Once artwork exists, show basic placement:
   - Fit
   - Fill
   - Tile
5. Under **Fine tune placement**:
   - scale
   - rotation
   - horizontal alignment
   - vertical alignment
   - reset
6. 2D dieline, 3D face and inspector preview update from the same state.

## Full-dieline workflow

1. User chooses **One artwork for the full layout**.
2. Show one large dieline workspace.
3. Actions:
   - **Choose from library**
   - **Upload new**
4. Place the master artwork over the entire dieline.
5. Basic controls:
   - Fit
   - Fill
   - Scale
   - Move
   - Rotate
   - Reset
6. Show cut/fold/bleed/safe-area overlays above the artwork.
7. 3D preview updates automatically as the master artwork moves.
8. Each panel displays status:
   - **Using full-layout artwork**
   - **Custom artwork** if overridden

## Panel override while in full-dieline mode

When a panel inherits the master artwork:
- **Replace this side**
- **Edit full layout**

After override:
- **Custom artwork**
- **Reset to full layout**

Overrides reference a library asset or a crop/placement binding. Never create redundant binary files solely for overrides.

## 4. Artwork Library UX

The Library is available:
- inside Artwork
- later from the project dashboard / account media area

Initial layout:
- Upload button
- Search
- Recent
- All images
- thumbnail grid

Each asset card shows:
- thumbnail
- filename
- dimensions
- file type
- optional usage count

Primary actions:
- Use on current panel
- Use as full-layout artwork

Secondary menu:
- Rename
- Download original
- Delete

Later:
- folders
- tags
- shared workspace library
- brand kits

## Upload behavior

Default upload behavior:
**Upload to library and use now**

Accepted MVP formats:
- PNG
- JPG/JPEG
- WebP

Later:
- SVG
- PDF
- AI/EPS where safe and practical

Validation:
- MIME and signature validation server-side
- max file size by entitlement
- image dimensions
- decode validation
- virus/malware scanning if required by storage pipeline

## Duplicate detection

Calculate a content hash after upload.

If the same user/workspace already owns an identical asset:
- reuse the existing binary/object
- create no duplicate storage object
- return the existing media asset

Suggested:
```
sha256(binary)
```

Hash is scoped by ownership for user-facing deduplication unless global deduplication is explicitly designed with privacy/security review.

## 5. Data model

Use the V2 database when accounts/projects are implemented.

### media_assets

```ts
type MediaAsset = {
  id: string;
  workspaceId: string;
  uploadedByUserId: string;

  objectKey: string;
  thumbnailObjectKey: string | null;

  originalFilename: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;

  sha256: string;
  status: 'processing' | 'ready' | 'failed';

  createdAt: string;
  deletedAt: string | null;
};
```

Indexes:
- workspace_id, created_at
- workspace_id, sha256
- workspace_id, deleted_at

Do not store signed S3 URLs.

### project_artwork

Stores project-level artwork bindings.

```ts
type ProjectArtwork = {
  id: string;
  projectId: string;
  projectVersionId: string;

  mode: 'full_dieline' | 'panel_override' | 'panel';

  panelId: string | null;
  mediaAssetId: string;

  placement: ArtworkPlacement;
  createdAt: string;
};
```

### ArtworkPlacement

```ts
type ArtworkPlacement = {
  fitMode: 'fit' | 'fill' | 'tile';

  scale: number;
  rotationDeg: number;

  offsetX: number;
  offsetY: number;

  alignX: 'left' | 'center' | 'right';
  alignY: 'top' | 'center' | 'bottom';
};
```

For full-dieline placement, offsets and scale operate in normalized dieline coordinates.

### project artwork mode

Store in project-version scene state:

```ts
artwork: {
  mode: 'per_panel' | 'full_dieline';
  masterBindingId?: string;
  panelBindings: Record<string, string>;
}
```

Bindings reference project_artwork IDs.

## 6. Structural mapping

Full-dieline slicing must not create raster files per panel.

Instead, each packaging template exposes panel regions in shared structural coordinates:

```ts
type ArtworkRegion = {
  id: string;
  panelId: string;

  x: number;
  y: number;
  width: number;
  height: number;

  rotationDeg?: number;
  uvOrientation?: 'normal' | 'flip_x' | 'flip_y' | 'rotate_90';
};
```

The reverse-tuck structure already owns panel bounds. Extend the structure definition so its 2D panel coordinates and its 3D face UV orientation are explicitly linked.

Renderer pipeline:
1. Master image texture is loaded once.
2. Master placement produces one dieline-space transform.
3. Each panel converts its dieline rectangle into texture UV coordinates.
4. 3D shader samples only that panel’s region.
5. No additional image binary is generated.

Benefits:
- one source texture
- no duplicated storage
- instant updates
- exact 2D/3D consistency

## 7. Renderer requirements

### Full-layout texture

Add a master artwork texture slot.

For each 3D face:
- derive UV crop from structure panel region
- combine:
  - master dieline transform
  - panel crop
  - panel orientation
- sample the master texture

### Per-panel override

Texture priority:
1. panel override
2. full-dieline master
3. panel artwork in per-panel mode
4. base material

### Interior artwork

Not part of the first MVP but model as separate artwork regions so the same system can support:
- outside
- inside
- labels
- wrap regions

## 8. API surface

Suggested authenticated API routes.

### GET /api/media
Query:
- cursor
- search
- sort
- type

Returns paginated media metadata.

### POST /api/media/upload-intent
Input:
```json
{
  "filename": "box-artwork.png",
  "mimeType": "image/png",
  "byteSize": 2183821,
  "sha256": "..."
}
```

Response:
- existing asset if duplicate
- otherwise restricted signed upload information

### POST /api/media/:id/complete
Server validates object existence and final metadata, then marks ready.

### DELETE /api/media/:id
Soft delete.

Reject destructive deletion if the asset is actively referenced unless deletion semantics explicitly preserve the asset behind existing project references.

Preferred UX:
- “Used in 4 designs”
- allow removal from Library listing only when binary must remain for project integrity

### POST /api/projects/:projectId/artwork
Create/update a binding.

### PATCH /api/projects/:projectId/artwork/:bindingId
Update placement only.

### DELETE /api/projects/:projectId/artwork/:bindingId
Remove binding or panel override.

## 9. Storage

Recommended S3 key pattern:

```
v2/{environment}/workspaces/{workspaceId}/media/{assetId}/original
v2/{environment}/workspaces/{workspaceId}/media/{assetId}/thumb.webp
```

Do not key files directly by user-provided filenames.

Upload:
- direct browser → signed S3 upload
- application server creates upload intent and verifies completion
- access checks occur before signed URLs are returned

Thumbnails:
- generated server-side or asynchronously
- use WebP/AVIF where supported

## 10. Entitlements and premium limits

Do not hard-code plan names into editor components.

Expose entitlements:

```ts
type MediaEntitlements = {
  maxAssets: number | null;
  maxStorageBytes: number | null;
  maxSingleUploadBytes: number;

  supportsSvg: boolean;
  supportsPdf: boolean;
  supportsFolders: boolean;
  supportsSharedLibrary: boolean;
};
```

Potential plan structure, subject to later pricing validation:

Free:
- small media count/storage allowance
- PNG/JPG/WebP
- personal library

Paid:
- larger storage/library
- larger files
- SVG/PDF
- folders/collections
- shared workspace assets
- brand kits

The UI should show usage:
- “12 of 25 images”
- storage meter when relevant

When limit is reached:
- preserve existing projects
- block only new upload
- allow deletion/replacement
- present upgrade path without preventing access to existing work

## 11. Usage counting

Track both:
- active library asset count
- storage bytes

Do not count the same referenced asset multiple times because it is used across multiple designs.

Useful derived metrics:
- media_asset_count
- storage_bytes
- number_of_project_references

## 12. Frontend state model

Studio should keep one source of truth:

```ts
type ArtworkState = {
  mode: 'per_panel' | 'full_dieline';

  master?: ArtworkBindingState;

  panels: Record<string, {
    inherited: boolean;
    override?: ArtworkBindingState;
  }>;
};

type ArtworkBindingState = {
  assetId: string;
  previewUrl: string;
  placement: ArtworkPlacement;
};
```

Do not separately store:
- one transform for inspector
- another transform for dieline
- another transform for WebGL

The renderer and 2D view derive from this state.

## 13. Local prototype before accounts

Until Neon/S3/accounts exist:
- keep the existing object-URL upload path
- create an in-memory/local prototype asset library
- use stable generated local IDs
- model the frontend API as though assets were persistent

Example:

```ts
type LocalMediaAsset = {
  id: string;
  name: string;
  objectUrl: string;
  width: number;
  height: number;
};
```

This lets us build the UX and mapping before backend provisioning without creating throwaway architecture.

## 14. Error and empty states

Library empty:
**Your artwork library is empty**
“Upload artwork once and reuse it in any design.”

Asset processing:
- thumbnail skeleton
- “Preparing artwork…”

Decode failure:
**We couldn’t read this image**
“Try PNG, JPG or WebP.”

Unsupported format:
explain supported formats and file-size limit.

Missing asset reference:
project remains loadable, with affected panel showing:
**Artwork unavailable**
and a Replace action.

Full-dieline without master:
show dieline plus centered:
**Add one artwork for the full box layout**

## 15. Print-quality guidance

MVP:
- warn when effective artwork resolution is low for the selected physical panel size
- do not claim printer-ready output solely from browser rendering

Later:
- configurable DPI target
- bleed
- safe area
- CMYK-aware workflows
- vector source preservation
- PDF production export

## 16. Analytics

Track meaningful workflow events:
- media_library_opened
- media_upload_started
- media_upload_completed
- media_asset_reused
- artwork_mode_changed
- full_dieline_artwork_applied
- panel_artwork_applied
- panel_override_created
- panel_override_removed
- artwork_fit_changed
- artwork_transform_changed
- media_limit_reached

Do not emit high-frequency events on every slider frame. Debounce or emit on interaction end.

## 17. Accessibility

- Library must be fully keyboard navigable.
- Selected media asset exposes aria-selected.
- Dieline panels are real buttons.
- Placement controls have readable labels and current values.
- Do not rely solely on color for inherited vs overridden state.
- Full-layout artwork and panel mapping remain usable without drag-only interaction.

## 18. Rollout sequence

### Milestone A — Local Artwork Library
- local in-memory media library
- upload once
- reuse across multiple panels in one project
- library chooser
- no persistence claim

Acceptance:
one uploaded object URL is referenced by two panels without duplicate File reads.

### Milestone B — Full-dieline artwork
- mode switch
- master artwork placement in dieline coordinates
- 2D display
- auto mapping to all 3D exterior faces
- live scale/move/rotate
- Fit/Fill

Acceptance:
moving the master artwork in 2D changes all mapped 3D panels deterministically.

### Milestone C — Panel overrides
- override an inherited panel
- reset to master
- explicit inherited/custom UI

Acceptance:
override affects only that panel and resetting restores master mapping.

### Milestone D — Persistent media library
Requires accounts/projects milestone:
- Neon media metadata
- S3 uploads
- thumbnails
- deduplication
- search/recent
- usage-safe deletion

### Milestone E — Entitlements
- count/storage limits
- max upload size
- plan-aware formats
- upgrade states
- usage UI

### Milestone F — Production artwork workflows
- SVG/PDF
- bleed/safe areas
- resolution warnings
- interior artwork
- wrap regions
- production export integration

## 19. MVP acceptance checklist

The artwork-library/full-dieline MVP is complete when all are true:

- Upload one image once and see it in Library.
- Reuse the same library asset on at least two panels without duplicate storage.
- Switch between per-panel and full-dieline modes without losing bindings.
- Apply one master artwork over the full dieline.
- See the master artwork clipped correctly by every supported dieline panel.
- See matching crops on corresponding 3D faces.
- Move/scale/rotate master artwork and see 2D + 3D update from the same state.
- Override one panel with another library asset.
- Reset that panel to inherited master artwork.
- Save/reload serialized artwork state reproducibly once projects persist.
- Existing projects remain accessible when upload quota is reached.
- Library deletion cannot silently break a project.

## 20. Implementation order for current branch

Immediate engineering sequence on `feature/real-carton-engine`:

1. Add local media-library state and Library chooser UI.
2. Refactor existing per-panel `artworkByPanel` state to reference local media IDs rather than raw object URLs.
3. Add `ArtworkState.mode`.
4. Add master full-dieline placement state.
5. Render master artwork across the dieline.
6. Extend reverse-tuck panel definitions with explicit UV orientation.
7. Update WebGL shader/UV mapping to sample the master image by panel region.
8. Add panel override precedence.
9. Add serialization fixture/tests.
10. Only then connect persistence/S3 in the accounts/projects milestone.
