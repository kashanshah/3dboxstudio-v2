# V2 delivery sequence

## 1. Foundation — this commit

Fresh brand direction, homepage, interactive concept preview, journal scaffold, CI, and environment documentation. This is a visual starting point, not a production-ready editor.

## 2. Website and content migration

Finish shared website pages and review existing copy and blogs while preserving useful content and URLs. Use the original Lovable typography and side-by-side hero as the design foundation. Marketing claims and imagery follow shipped studio capabilities; see [studio capability roadmap](studio-capabilities.md).

## 3. Studio vertical slice

Build a canvas-first editor with real 3D geometry, dimensions, one artwork upload, visual face selection, and a working PNG export. Verify keyboard/mobile workflows and rendering on actual devices. Establish versioned scene data and meaningful analytics events.

## 4. Accounts and projects

Provision V2 Neon environments. Add Drizzle migrations, auth, ownership, S3 uploads restricted to V2 prefixes, project saving, autosave states, and error recovery. Test access control and migration compatibility.

## 5. Full packaging workflow

Deliver the packaging families, closures, folding, immersive navigation, artwork, materials, scene building, and exports in [studio capabilities](studio-capabilities.md). Per-face artwork/cropping, materials, lighting, opening controls, camera presets, history, project duplication, and share previews. Add client review after versioning and access controls work.

## 6. Product pages and pricing

Refine brand/visuals using design tools where useful. Port reviewed existing blogs while preserving URLs; build feature and use-case pages grounded in shipped capabilities. Pricing follows a validated product and entitlements model.

## 7. Launch readiness

Accessibility, browser/device QA, performance budgets, monitoring, security, backups, controlled user/project migration, SEO redirect map, and rollback rehearsal. Only then move the production domain and enable indexing.
