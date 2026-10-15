# Browser tests

Playwright drives a real Chromium against the production build. The site's
outside services are replaced by local stand-ins (`support/services.mjs`):
Postgres (PGlite, speaking Neon's HTTP protocol), an S3 bucket and an inbox
for Resend's email API. Nothing leaves the machine and every run starts with
an empty database.

```sh
npm run build
npx playwright install chromium   # once
npm run test:e2e                  # everything
npx playwright test e2e/studio.spec.ts --project=setup --project=desktop
```

- `global.setup.ts` signs up the test user through the real sign-up form,
  verifies the email address from the inbox, and signs in to the admin area
  once (admin sign-in is rate limited). The sessions are reused by the tests.
- Every test fails if the page logs an error or throws, or a request returns
  5xx (`support/fixtures.ts`). A test that expects an error says so with
  `allowPageErrors`.
- `E2E_CHROMIUM_PATH` points at a local Chromium when Playwright's own is
  not installed.
- In CI (the `e2e` job) a failed run uploads the HTML report and traces as
  the `playwright-report` artifact: `npx playwright show-trace <trace.zip>`.
