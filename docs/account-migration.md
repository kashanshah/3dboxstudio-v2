# V2 Accounts & Legacy User Migration

## Compatibility guarantee

V2 intentionally preserves the legacy 3D Box Studio identity model so existing users do not need new accounts.

The migration preserves:

- `users.id` exactly
- normalized email address
- display name
- legacy `scrypt` `salt:hash` password hash
- email verification timestamp
- original account creation timestamp
- signup method and attribution fields
- Google `oauth_accounts` provider account IDs

Because the password format is unchanged, migrated email/password users can sign in with their existing password. Google-only users keep the same Google identity mapping.

V2 uses the same session cookie name (`sb_session`) but the migration does **not** copy active sessions by default. Users receive a fresh V2 session after signing in. This is the safer cutover behavior.

## New V2 ownership model

V2 `projects.user_id` and `media_assets.user_id` reference the preserved legacy user ID. This allows later migration of legacy designs/assets without an identity remap.

## Environment variables

Set these only in a secure server/CLI environment:

```bash
DATABASE_URL=postgresql://...v2...
LEGACY_DATABASE_URL=postgresql://...v1...
LEGACY_SOURCE_NAME=3dboxstudio-v1
```

Never expose either database URL to the browser.

## Preflight behavior

Run:

```bash
npm run migrate:legacy-users
```

The default command runs a read-only preflight dry run; it creates no tables and imports no records. It checks every source ID, normalized email, and OAuth identity against V2, including duplicate source emails, orphaned OAuth accounts, and target collisions. Database endpoint checks reject direct/pooler variants of the same source database. Use a read-only source database role.

If a V2 account already exists with the same email but a different ID, the migration stops **before copying users** and reports the conflict type for manual reconciliation without logging personal data. This prevents silent account merging.

## Apply and idempotency

After the dry run and staging checks pass, import with:

```bash
npm run migrate:legacy-users -- --apply
```

All user, OAuth, ledger writes and identity assertions run in one target transaction. A conflict rolls the complete import back. The transaction locks identity tables for its duration, so schedule the production import in a maintenance window and pause V1 identity changes during the final cutover sync. Regular interim syncs use a consistent read-only snapshot while V1 stays live.

Re-runs insert missing users and merge changes using the previous source snapshot. They preserve password, display name, verification state, and signup attribution changed independently in V2. An existing ID must have the matching source ledger record and email; changed-email accounts need manual reconciliation. OAuth identities are never reassigned. Verification checks actual user and OAuth ownership rows inside the transaction rather than relying on ledger counts alone.

Active sessions, email verification tokens, and password reset tokens are never copied. Users sign in afresh in V2. Setting `MIGRATE_LEGACY_SESSIONS=true` fails explicitly.

## Recommended production cutover

1. Deploy V2 schema/auth code with V2 still non-indexed.
2. Configure V2 `DATABASE_URL`.
3. Configure Google OAuth credentials/callback for V2.
4. Run the migration against a staging clone first.
5. Verify:
   - total user count
   - password login for a legacy password account
   - Google login for a legacy Google account
   - verified/unverified state
   - original creation timestamps
6. Run the production migration.
7. Require fresh V2 sign-in; do not copy tokens or active sessions.
8. After identity migration is verified, migrate legacy designs/shared designs into V2 projects using the preserved `user_id`.

## Rollback

The source database is read-only to the migration script. The script never updates or deletes legacy users. V2 can therefore be rolled back without modifying V1 identity data.

## Validation and remaining rollout work

`npm run test` covers fresh imports, recorded re-runs, email/ID collisions, duplicate normalized emails, orphaned OAuth identities, OAuth ownership conflicts, and source/target endpoint equivalence. CI runs these checks with lint, TypeScript, and the production build.

The repository contains the account foundation and ownership schema. Production migration requires separately configured V2 database credentials and Google OAuth callback. A real staging import and legacy password/Google login checks are still required before cutover. Persistent project/media APIs and legacy design/share import remain separate milestones; this command imports identities only.

## Repeatable sync (operator command)

`npm run sync:legacy` is an alias for the migration command. Run without flags for a **read-only dry run**, then use `npm run sync:legacy -- --apply` to commit. There is no browser-triggered sync and the normal V2 application never reads the V1 database. Keep the same `LEGACY_SOURCE_NAME` across runs; it is a stable identity namespace, not a date.

Each run takes a consistent read-only, repeatable-read V1 snapshot and scans every identity and supported record table with a paginated cursor. A date watermark alone would miss user verification, password changes, design views, and older rows edited without an updated timestamp. A run today imports everything visible in that snapshot; a run next week catches all newly created records and changed content since the previous run, regardless of creation date. Writes are incremental even though reads are a full scan.

Users keep their IDs and initial passwords. On subsequent runs, each mutable user field uses a three-way merge against the previous source snapshot: a V1 change is applied only when V2 still matches the old value. Newer V2 passwords/profile changes survive; field conflicts are counted in the report. Changed identity emails and OAuth ownership conflicts stop the whole run for reconciliation. Older migration ledger records without snapshots establish a baseline on their first rerun without modifying the existing account. V1 user deletions never delete V2 accounts; missing source users are reported.

`shared_designs`, `contact_submissions`, and `contact_submission_replies` are copied verbatim into `legacy_records` using stable source/table/ID keys and content hashes. Repeated runs add new rows, update changed rows, and skip identical rows. Source-deleted records receive a tombstone; payloads remain preserved for recovery. An absent source table is skipped and explicitly reported; it does not tombstone existing records. Sessions, reset/verification tokens, and admin settings are excluded.

All changes and the successful `legacy_sync_runs` receipt commit in one transaction. Concurrent apply runs serialize with a transaction advisory lock; identity and mirror tables are locked during the apply to prevent signup/update races. Failures roll back all target changes and leave no successful receipt. Rerun safely after fixing the cause. Production applies should run during low traffic because these table locks briefly block V2 account writes. The source continues operating normally; changes committed after the source snapshot appear on the next sync. Final cutover still requires a V1 write freeze followed by a final sync.

The dashboard reports legacy designs from this mirror, plus native V2 projects, using original creation times. This is **record preservation**, not editor conversion: the old design config must be mapped into V2 studio state before old designs are editable. S3 keys are preserved, but files are not copied to V2 storage and old public share URLs are not yet routed by V2. Do not retire the V1 bucket or redirect share links until these separate steps are finished. Synced contacts/replies remain in the mirror; V2 contacts UI continues operating on its native records.

The CLI prints aggregate counts only. User snapshots in the migration ledger contain password hashes and must be protected like the `users` table. Never expose ledger metadata or raw legacy payloads through a public API.

## Dashboard widgets

The V2 admin dashboard includes user/verification totals, design ownership/views, 7/30-day counts, daily averages, activity charts (daily through yearly), source/method/landing/signup-page breakdowns, image counts, V2 media totals, S3 inventory, and completed sync snapshots. All design metrics default to designs with uploaded artwork; the include-blank toggle applies to totals and charts consistently. Charts use `ADMIN_DISPLAY_TIMEZONE` (default America/Toronto). Image activity uses original design creation dates, matching the legacy convention, rather than claiming per-upload timestamps.

S3 inventory only lists the configured `AWS_S3_PREFIX`, which must start with `v2/`; it never scans the V1 bucket/prefix implicitly. It caches for five minutes, caps at 50,000 objects, and marks partial results. Unconfigured or denied inventory is shown as unavailable rather than zero usage. Billing/cost estimates are not invented from object counts.
