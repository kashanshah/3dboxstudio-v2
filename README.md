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

- Fresh responsive homepage and shared visual system.
- Blue and cool-neutral interface palette with self-hosted Manrope typography; see [design system](docs/design-system.md).
- Interactive sample packaging concept (CSS 3D, not the future rendering engine).
- `/studio` explicitly labeled as a design preview.
- `/blog` journal scaffold with an honest empty state, ready for reviewed content migration.
- Accessible controls, keyboard focus, skip links, and reduced motion support.
- Development indexing disabled by default in metadata, robots.txt, and response headers.

Artwork uploads, real box dimensions, auth, database, cloud projects, sharing, and exports are **not implemented** in this milestone. No placeholder save/export controls imply otherwise.

## Environment isolation

Create a separate Neon project named `3dboxstudio-v2`. Do not reuse the V1 database. Use separate development, staging, and production branches with credentials scoped to each environment. The application does not yet connect to Neon or perform migrations.

The existing S3 bucket may be reused with V2-only prefixes and IAM permissions scoped to those prefixes. Environment variables alone do not enforce access restrictions. Existing V1 object paths must remain unchanged.

See [architecture](docs/architecture.md) and [roadmap](docs/roadmap.md). Keep `SITE_INDEXABLE=false` for all development and preview deployments. Robots directives are not access control; use hosting authentication for private previews.
