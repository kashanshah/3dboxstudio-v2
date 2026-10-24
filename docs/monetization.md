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

Partner with printers that print from the customer's own dieline and artwork, not with packaging sites that have their own online box designer (Packhelp, Arka, Pacdora's printing): sending visitors there teaches them to design there next time.

Keep the visitor on 3D Box Studio: the quote form takes the request here and we pass it on, so the printer quotes for the box designed here. The partner pays a fixed fee per lead or a share of orders, under a written agreement. Offer printing only once the dieline is finished or exported, never mid-design.

These printers advertise low minimums and quote from customer files. The terms come from their own marketing as of October 2026: confirm them before agreeing anything, and check none of them pushes visitors into an online designer of its own.

| Printer | Why | To check |
| --- | --- | --- |
| The Best Price Boxes | No minimum, free design help, quotes from customer files, matches written competitor quotes | Lead fee or share of orders |
| Dream Custom Boxes | No minimum, mailer boxes from about $0.50 each | Lead fee or share of orders |
| BoxUp | US, no minimum, single sample box | Whether it prints from a customer dieline or only from its own designer |

## Affiliate links

Only for products that do not compete with the Studio: what people buy to make the box they designed here. No links to packaging sites with their own box designer. Never in the Studio canvas or the export flow, and always marked as an affiliate link.

- **Cutting machines and materials**: Cricut runs a programme on Impact (listings say 4% on machines up to 10–12% on materials and Cricut Access). Silhouette products sell through resellers on ShareASale at about 5%. Fits the Cricut and Silhouette crafter pages and the cutting-machine export note.
- **Card stock and tools**: Amazon Associates (a few percent on small orders). Only worth it on guides that already recommend a board or a scoring tool.
