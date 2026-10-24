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
- ~~update the privacy policy to say quote requests may be shared with printing partners~~ (done 2026-10-24, "Print quote requests" in `src/content/privacy.ts`);
- decide who replies, and how fast;
- agree terms with at least one printing partner (below).

### Printing partners to approach

These printers advertise low minimums, so they fit hobby and small-brand orders. The minimums and terms come from the printers' own marketing as of October 2026: confirm them before agreeing anything.

| Printer | Why | Referral terms seen (unconfirmed) |
| --- | --- | --- |
| Packhelp | Mailer and product boxes, EU and US, online ordering | Affiliate programme on PartnerStack and other networks: listings say 5–8% of first orders, some recurring |
| Arka | Mailer and product boxes, US, small runs | Affiliate listings say about 4–5%, 30–45 day cookie |
| BoxUp | US, no minimum, single sample box | None found: ask for a referral deal |
| The Best Price Boxes, Dream Custom Boxes | No minimum, free design help, quote by request | None found: suited to a lead-forwarding fee |

Two models:
- **Referral link.** The form sends the visitor on to the printer with our affiliate link and the box details. No handling on our side; pays only when they order.
- **Lead forwarding.** We email the request to a partner who quotes directly and pays a fixed fee per lead or a share of orders. Needs a written agreement first.

## Affiliate links

Room for affiliate income without ads, in places where a link helps the visitor anyway. Never in the Studio canvas or the export flow, and always marked as an affiliate link.

- **Print-ready packaging**: the Packhelp and Arka programmes above, linked from "Get this box printed" and the mailer, product box and pizza box template pages.
- **Cutting machines and materials**: Cricut runs a programme on Impact (listings say 4% on machines up to 10–12% on materials and Cricut Access). Silhouette products sell through resellers on ShareASale at about 5%. Fits the Cricut and Silhouette crafter pages and the cutting-machine export note.
- **Card stock and tools**: Amazon Associates (a few percent on small orders). Only worth it on guides that already recommend a board or a scoring tool.

