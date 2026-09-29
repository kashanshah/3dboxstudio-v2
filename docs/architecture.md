# Architecture and isolation

## Agreed direction

- Next.js App Router, React, TypeScript: marketing, product UI, server APIs.
- React Three Fiber/Three.js: future packaging engine. Port proven geometry and texture logic only after reviewing it; UI is greenfield.
- Neon Postgres in a new V2 project with Drizzle migrations committed to Git.
- Better Auth: evaluate and integrate with Neon when implementing accounts, including V1 identity migration compatibility.
- AWS S3: existing bucket, new V2 prefixes, environment-specific roles.
- Billing and entitlements follow the validated product workflows.

Only the frontend foundation is installed in this commit. Avoid adding unused database/auth dependencies until the first real account/project vertical slice.

## Environment matrix

| Environment | Database | S3 prefix | Search indexing |
| --- | --- | --- | --- |
| Local | V2 development branch | `v2/dev/` | Off |
| Preview | V2 preview branch | `v2/preview/` | Off |
| Staging | V2 staging branch | `v2/staging/` | Off |
| Production | V2 production branch | `v2/prod/` | Off until launch review |

Provisioning is a separate step; no database or storage resources have been created by this commit. Keep credentials out of Git and browser bundles. Never expose `DATABASE_URL`, auth secrets, or AWS credentials with a `NEXT_PUBLIC_` prefix. Preview databases must contain synthetic data initially. Set canonical origin with `NEXT_PUBLIC_SITE_URL` for each deployment; production canonicals and sitemap belong to the migration milestone.

## Initial domain model proposal

Implement only what the milestone needs, with explicit foreign keys and ownership checks:

1. Identity: users, accounts, sessions, verification records according to the selected auth adapter.
2. Ownership: workspaces, workspace_members, projects.
3. Design state: project_versions with a versioned scene JSONB schema; project_assets storing object keys and metadata.
4. Review: project_shares, comments, approvals pinned to a specific version.
5. Commercial: subscriptions, entitlements, export and usage records.

Never store uploaded binary data or expiring signed S3 URLs in scene JSON. Reference asset IDs. Share tokens must be unpredictable and revocable. Asset permissions follow project/workspace ownership.

## Launch migration

Inventory V1 routes and indexed content before migrating. Preserve working URLs and search intent; maintain a reviewed redirect map for any changes. Do not replace the existing blogs with this empty scaffold at launch. Audit metadata, canonicals, structured data, internal links, and sitemap before enabling indexing.

V1 imports must be an explicit migration job with read-only source credentials, dry-run reports, idempotent mappings, backups, and rollback verification. Preserve users/projects/artwork and share URLs where feasible. Auth migration requires verification of password hashing/OAuth compatibility; do not assume IDs alone are sufficient. Sessions and reset tokens should not migrate. The normal V2 runtime must never connect to V1.
