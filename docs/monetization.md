# Print quotes and Pro flags

Plumbing for paid extras later. Nothing here charges anyone, and nothing that is free today will ever move behind a flag: Pro flags may only add new capabilities. `src/lib/features.ts` lists what stays free (`FREE_FOREVER`), and `scripts/features.test.cjs` checks that no Pro flag claims one of those.

## Feature flags

`src/lib/features.ts` holds every flag. A flag is `'off'` (nowhere), `'draft'` (Vercel previews and development only, like draft pages) or `'on'` (everywhere). `isFeatureOn(id)` works on the server and in the browser.

To try a flag on one deployment, set `NEXT_PUBLIC_FEATURES` to a comma-separated list of ids, for example `NEXT_PUBLIC_FEATURES=printQuote,nesting`. It is read at build time, so redeploy after changing it.

| Flag | Status | Pro | What it is |
| --- | --- | --- | --- |
| `printQuote` | draft | no | "Get this box printed" on the dieline generator |
| `nesting` | off | yes | Nest several dielines on a press sheet |
| `costEstimate` | off | yes | Estimated print cost for a quantity and board |
| `savedDielines` | off | yes | A library of saved generator boxes (Studio projects stay free) |
| `bulkExport` | off | yes | Many sizes or styles in one zip (single files stay free) |
| `apiKeys` | off | yes | API keys to generate dielines from other software |

The Pro flags are names only: no feature is built behind them yet.

## Get this box printed

A button under "Copy link to this box" on every English dieline generator opens a form. The form has:
- the box, its size and board, filled in from the generator;
- quantity range, printing, finish, an optional deadline;
- name, email, country and optional notes;
- a required consent checkbox: "I agree that 3D Box Studio may share this request, including my name, email and country, with printing partners so they can quote for it."

On submit, `POST /api/print-quote` does the following:
- checks the request (`src/content/print-quote.ts`), Turnstile and a rate limit of 5 per 15 minutes;
- stores the request in `contact_submissions` with `kind = 'print_quote'`, so it shows in the admin contact inbox, with the full request in `payload`;
- emails it to the admin notification address. The email is always sent, whatever the contact-message notification setting, and replies go to the visitor.

The API returns 404 while the flag is off. There is no printing partner integration.

To launch it, set `printQuote` to `'on'`. Before that:
- update the privacy policy to say quote requests may be shared with printing partners;
- decide who replies, and how fast.
