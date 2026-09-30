# Email templates

All V2 email HTML and plain text live in `src/server/email/templates.ts`. Account verification and password recovery call these same renderers; the admin template library supplies sample names and nonfunctional preview tokens to them. Contact notifications retain the visitor as Reply-To and include a mailto action.

- Verification: single-use link, 24-hour expiry.
- Password reset: single-use link, 1-hour expiry; reassuring ignore-request copy and a reminder not to share the link.
- Admin contact: escaped visitor details, preserved message line breaks, UTC submission time, and reply action.
- Welcome: refreshed reference template only. No automatic welcome send is configured.

The HTML uses a fluid 600px table layout, inline styles, system fonts, a text wordmark, hidden inbox preheaders, and Outlook table/padding fallbacks. Account actions include a visible URL as well as the button. Every template supplies plain text. Actual rendering in Gmail, Outlook, and Apple Mail still needs an inbox check before release; no real emails are sent by automated tests.

Use `AUTH_APP_URL` for account destinations and the Studio link. `NEXT_PUBLIC_SITE_URL` supplies the public brand/footer URL and falls back as the account origin when configured. Mail delivery uses the existing `RESEND_API_KEY` and `EMAIL_FROM`. Invalid account URLs or delivery failures remove the newly issued token so retries are not blocked by the issuance cooldown.

The V1 email-change, admin-registration, and contact-reply templates were also reviewed. V2 currently has no sending flows for them; this refresh does not introduce those flows or send legacy notifications during sync.

Run `npm test` for renderer escaping, preview parity, link expiry copy, action delivery, token cleanup, and the existing account/migration checks.
