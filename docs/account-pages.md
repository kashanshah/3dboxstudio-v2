# Account pages and studio workspace

The account page layouts and studio home are adapted from the existing [Lovable Box Studio Design](https://lovable.dev/projects/89de62f8-df7c-4ac9-94a4-cdfccde5fdc1) project. The V2 implementation uses real Neon users, projects, and sessions; Lovable's demo account/data state is not copied.

Routes:

- `/studio`: signed-out studio gate or a signed-in design library, thumbnails, search/sort, pagination, and template gallery.
- `/studio/editor`: authenticated editor, optionally `?project=<id>`. Project ownership is checked on the server. The template gallery only enables structures whose real geometry is ready.
- `/login` and `/signup`: email/password or Google; safely return to an internal `next` path, default `/studio`.
- `/forgot-password` and `/reset-password?token=...`: generic recovery response, expiring one-use token, password update, and session revocation.
- `/verify-email?token=...`: explicit confirm action; scanning/prefetching the URL does not consume the token. Without a token, signed-in users can resend verification.
- `/accounts`: authenticated profile and password/security sections. The page structure can accept billing sections later; no billing product is exposed yet.

Email signup creates a session and attempts delivery of verification mail. Failed delivery does not report a false success; the user can resend. Unverified users can enter the editor with a reminder, matching the live site's behavior. Google sign-in requires a verified Google email. Google-only accounts use Google password management.

Account links require `AUTH_APP_URL` (or an explicitly configured `NEXT_PUBLIC_SITE_URL`) pointing to the **V2 app origin**. Keep this separate from production SEO canonicals when testing previews. Configure `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `RESEND_API_KEY`, and `EMAIL_FROM` on the server. Tokens are random 256-bit values; only SHA-256 digests are stored. Reset links expire after one hour, verification links after 24 hours. Reset/password-change operations revoke the user's sessions and outstanding reset tokens. Resend has a one-minute cooldown plus request rate limits. The in-memory rate limiter retains the existing deployment limitation: counters are per server instance, not a shared global store.

The editor uses an explicit **Save** action. It stores versioned V2 state, converts temporary blob artwork URLs into persistent inline image data, and creates a thumbnail from the live renderer. Saved projects are scoped to the signed-in owner and reopened from the library. Updates use an `updated_at` comparison so an older tab cannot overwrite a newer save. The first implementation limits each save request to 3 MB; large artwork needs the separate asset-storage workflow before that limit is raised. Imported external SVG/DXF dieline geometry is not part of this saved carton state; the production renderer currently supports the reverse-tuck template.

Legacy designs in the mirror appear only for their preserved owner ID. Thumbnails require `LEGACY_ASSET_BASE_URL`; opening the original editor requires an explicit `LEGACY_SITE_URL` pointing to a retained V1 origin. Without those settings, designs remain listed with a conversion-pending status and placeholder thumbnail. Anonymous legacy shares are not exposed as anyone's personal designs. Legacy conversion/S3 copy/share routing remain separate migration work.

Validation covers expiring/reused tokens, verification email matching, password/session revocation, email validation, internal redirects, persistent project state, owner-only saves/opening/listing, and stale-update rejection using PostgreSQL fixtures. Local HTTP checks cover all public auth pages, studio gate, and signed-out redirects for account/editor. Lovable verified its reference in a browser; browser visual QA of the Next.js port remains pending if Chromium is unavailable.
