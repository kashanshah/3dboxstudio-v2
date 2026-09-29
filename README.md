# 3D Box Studio 2.0

A greenfield rebuild of the marketing website and packaging studio. This repository is independent of the V1 production app. No V1 components, styles, credentials, or database connections are included.

## Run locally

Node 22 or newer:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The initial app needs no credentials. `npm run check` runs ESLint, TypeScript, and the production build. GitHub Actions runs the same checks on pushes and pull requests.

## First milestone

- Complete original Lovable homepage variant restored from `f4c3c7d52aec7b7bc171173a94b7d497d75b2649`, including its typography, layout, opened-box illustration, dark workflow and still-life showcase.
- Original blue/cool-neutral palette and self-hosted Manrope; see [design system](docs/design-system.md).
- `/studio` is an explicitly labeled interactive design preview, separate from the original homepage's illustrative editor window.
- `/blog` is a journal scaffold, ready for reviewed content migration.
- Keyboard focus, working navigation/CTA links and reduced-motion support.
- Development indexing disabled by default in metadata, robots.txt and response headers.

Homepage status and review notes are illustrations of the planned workflow. Artwork uploads, real dimensions, auth, project saving, collaboration and exports are not implemented in this milestone.

## Environment isolation

Create a separate Neon project named `3dboxstudio-v2`. Do not reuse the V1 database. Use separate development, staging, and production branches with credentials scoped to each environment. The application does not yet connect to Neon or perform migrations.

The existing S3 bucket may be reused with V2-only prefixes and IAM permissions scoped to those prefixes. Environment variables alone do not enforce access restrictions. Existing V1 object paths must remain unchanged.

See [architecture](docs/architecture.md), [roadmap](docs/roadmap.md), and the [studio capability and imagery requirements](docs/studio-capabilities.md). Keep `SITE_INDEXABLE=false` for all development and preview deployments. Robots directives are not access control; use hosting authentication for private previews.
