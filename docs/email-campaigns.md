# Admin email campaigns

`/admin/campaigns` manages local campaign drafts, Resend segments, test emails,
scheduled native Resend broadcasts, and reporting. A summary is also displayed on
the main admin dashboard. Account verification/reset emails continue using their
existing transactional sender.

## Production setup

1. Use `RESEND_API_KEY` with full access. Sending-only keys cannot manage segments,
   broadcasts, domain tracking, reports, usage or webhooks.
2. Configure a verified `EMAIL_FROM` or optional `EMAIL_CAMPAIGN_FROM`. Set
   `NEXT_PUBLIC_SITE_URL` to the public production HTTPS origin. Keep the preview
   origin separate so preview webhook setup does not reconfigure production.
3. Open **Campaigns → Sending setup → Connect Resend webhooks**. This creates or
   updates the endpoint `/api/webhooks/resend/campaigns` and stores its signing
   secret encrypted with AES-256-GCM. No secret is returned to the browser.
4. Set a stable `EMAIL_CAMPAIGN_ENCRYPTION_KEY` if desired; otherwise encryption
   uses `ADMIN_PASSWORD`. After rotating either effective key, reconnect webhooks.
   An optional `RESEND_CAMPAIGN_WEBHOOK_SECRET` supports externally managed
   configuration and takes precedence over the stored secret.
5. Resend marketing contacts/billing capacity must cover the intended segment.
   Current account usage is shown during review. API plan or permission failures
   are visible in admin; the app does not upgrade a plan or commit to billing.

Tables are initialized idempotently on the first authorized campaign request,
using the existing Neon database. The service needs normal create-table/index
permissions, consistent with the rest of this app's schema initialization.

## Prepare and schedule a campaign

1. Create a segment in **Segments**. Review a user filter (**Verified**, **Migrated**,
   or **All registered**) and recipient sample. Confirm contacts are eligible to
   receive updates before importing. Verification is a filter, not consent.
2. Imports normalize and deduplicate email addresses, skip existing global
   unsubscribes, and never set `unsubscribed: false` on an existing contact.
   Existing names/subscription choices are preserved. Each contact is committed
   separately. Imports run in short resumable batches while admin is open; use
   **Resume** after a closed tab or interrupted request. An in-flight interrupted
   batch may retain its lease for up to five minutes.
3. Create a campaign. The initial template is the V2 launch announcement, with
   the official logo, Studio screenshot, first-name fallback, tracked CTA links,
   HTML and plain text. Edit the subject, preview, sender, reply-to, segment,
   postal address, and email source. Preview runs in a sandboxed iframe.
4. Save and send a test to one address. The test uses the saved content and
   substitutes sample personalization. Its unsubscribe link is deliberately
   inactive and the footer identifies it as a test. A provider acknowledgement
   means **accepted**, not necessarily delivered. Check the actual inbox.
5. Choose the date/time and IANA zone (default Toronto; next day at 9 a.m.). The
   server converts wall time to UTC, rejects skipped/repeated DST times, and
   requires a future time of at least five minutes. The review shows both local
   time and UTC.
6. Review the subscribed-contact count, exclusions, domain status, tracking and
   account usage. **Enable tracking** updates open/click tracking for the sending
   domain, including other mail sent from that domain. Connect webhooks before
   scheduling. Check the approval box and schedule.

Saving edits increments a revision; scheduling requires a test of that exact
revision. Recipient eligibility is reviewed again and its fingerprint must
match. Imports are blocked for an active segment and incomplete imports block
scheduling. Segment membership is ultimately evaluated by Resend at delivery
time: edits made outside this admin panel can still affect recipients.

The application delegates scheduling, throttling, delivery and unsubscribe
handling to Resend. No Vercel cron or open browser is needed after Resend confirms
the schedule. A scheduled/queued campaign can be canceled from admin; emails
already sent cannot be recalled. Sent/canceled campaigns are immutable locally;
duplicate one to make a new draft.

## Tracking

- Campaign overview and main dashboard: totals refresh every minute while visible
  for the most recent 100 broadcasts. Older campaigns retain their last refresh;
  open one and refresh its detail to update it. Overview responses omit email
  source bodies.
- Campaign details: sent, delivered, total/unique opens and clicks, bounces,
  complaints, unsubscribes, suppressions, failed and delayed messages; delivery,
  open, click and click-to-open rates; daily activity in the campaign's zone.
- Recipient reports: paginated lists by sent/delivered/opened/clicked/bounced/
  complained/unsubscribed/suppressed, email search, event counts, bounce type,
  clicked URLs, and CSV export of the current page.
- Link report: paginated URLs with total/unique clicks.
- Recent activity: the latest 50 signed webhook events, including the most
  recent test message; campaign history records saves, tests, scheduling,
  cancellation and failed operations.

Results/reports refresh every minute while the campaign page is visible, or on
explicit refresh. Resend metrics are the source for complete totals (including
unsubscribes). Webhook activity is kept separately, so installing webhooks after
a send does not falsely manufacture historical events or inflate totals.
Privacy proxies can inflate opens and security scanners can trigger clicks;
these metrics do not prove a person read or clicked the email.

Webhook verification uses Svix with the raw request body and timestamp tolerance.
Redeliveries are deduplicated by provider event ID and recipient. Events are
stored independently of campaign rows to tolerate delivery before local
persistence and out-of-order arrival. Only recipient, email/broadcast ID, event
time, link and failure detail are stored; IP addresses and user agents are not
persisted. Storage failures return non-2xx so Resend retries.

## Failure recovery and concurrency

Database compare-and-set revisions and five-minute leases serialize campaign
operations across serverless instances. Segment leases serialize scheduling and
imports. Leases outlast the API route's 60-second execution limit, preventing a
new worker from racing a timed-out request. Contact additions are safe to repeat.
Test requests use Resend's transactional idempotency header.

Broadcast creation uses a draft named with a unique local campaign UUID. The
create-attempt flag is written before the remote request. A lost response is
reconciled by listing/adopting that uniquely named draft; the application never
automatically creates another draft after an uncertain result. Schedule intent
is persisted before the send request. On any timeout, **Refresh results** retrieves
the provider's actual state before another send is allowed. Provider throttling
gets bounded retries; transport errors/5xx mutations are not blindly retried.

If no matching draft can be found after uncertain creation, inspect Resend and
confirm that nothing was created or scheduled before duplicating the local
campaign. External Resend edits should be reconciled before continuing; the
application is designed as the authoring source for broadcasts it creates.

## Verification

`scripts/email-campaigns.test.cjs` uses a real in-memory PostgreSQL-compatible
PGlite database and mocked Resend calls. It covers revisions, leases, unsubscribe
preservation, import resume, timezone/DST validation, recovery after ambiguous
create/send responses, reports, cancellation, webhook forgery/deduplication,
secret encryption, authentication, origin checks and transport pagination.
`scripts/email-campaign-ui.test.cjs` mounts the actual React components in JSDOM
and exercises editing, test acceptance, scheduling confirmation, cancellation,
recipient pagination/search, clicked links, and import progress. It does not
validate browser rendering or inbox appearance. Automated tests do not send real
emails or schedule live broadcasts.

Before the first real campaign, connect the production webhook, send a real
internal inbox test, confirm the domain's tracking and verify the marketing plan
and recipient eligibility. Scheduling requires the operator's explicit review.

Primary references:

- https://resend.com/docs/api-reference/broadcasts/create-broadcast
- https://resend.com/docs/api-reference/broadcasts/send-broadcast
- https://resend.com/docs/api-reference/broadcasts/cancel-broadcast
- https://resend.com/docs/api-reference/broadcasts/list-broadcast-recipients
- https://resend.com/docs/api-reference/broadcasts/list-broadcast-clicked-links
- https://resend.com/docs/api-reference/contacts/create-contact
- https://resend.com/docs/api-reference/segments/create-segment
- https://resend.com/docs/webhooks/verify-webhooks-requests
- https://github.com/resend/resend-openapi
