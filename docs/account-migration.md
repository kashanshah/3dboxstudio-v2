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
MIGRATE_LEGACY_SESSIONS=false
```

Never expose either database URL to the browser.

## Preflight behavior

Run:

```bash
npm run migrate:legacy-users
```

The script first checks every legacy ID/email against V2.

If a V2 account already exists with the same email but a different ID, the migration stops **before copying users** and prints the conflicts for manual reconciliation. This prevents silent account merging.

## Idempotency

The migration can be re-run. It:

- upserts by preserved legacy user ID
- upserts OAuth identities by `(provider, provider_account_id)`
- records every migrated entity in `legacy_migrations`
- verifies that the migration ledger contains exactly the same number of users as the source database

A successful run prints source, user, OAuth, and session counts.

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
7. Keep `MIGRATE_LEGACY_SESSIONS=false` unless seamless session carry-over is explicitly required.
8. After identity migration is verified, migrate legacy designs/shared designs into V2 projects using the preserved `user_id`.

## Rollback

The source database is read-only to the migration script. The script never updates or deletes legacy users. V2 can therefore be rolled back without modifying V1 identity data.
