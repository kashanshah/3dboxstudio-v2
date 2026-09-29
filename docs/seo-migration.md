# SEO-preserving V2 content migration

This branch moves the established public content footprint from the current 3D Box Studio application into V2 without turning the staging hostname into a competing indexed site.

## Preserved indexable URL footprint

The generated sitemap contains the same 41 indexable URLs represented by the current production sitemap:

- English: `/`, `/studio`, `/faq`, `/contact`, `/blog`
- 29 English article URLs under `/blog/[slug]`
- French, Spanish and German landing pages
- French, Spanish and German Studio pages
- The existing translated French article at `/fr/blog/how-to-create-3d-product-box-mockup-online`

The existing `/privacy` and `/terms` routes are also preserved, while remaining outside the sitemap as on the current site.

Legacy `/en/*` URLs permanently redirect to the unprefixed English canonical. Thin non-English legal/help routes permanently redirect to their English canonical instead of producing duplicate pages.

## Staging rules

V2 should remain non-indexable while it is served at `v2.3dmodel.com`.

- Leave `SITE_INDEXABLE` unset or set it to `false`.
- Keep `NEXT_PUBLIC_SITE_URL=https://www.3dboxstudio.com` (the code also defaults to this established canonical origin).
- The app emits `X-Robots-Tag: noindex, nofollow` on staging when `SITE_INDEXABLE` is not `true`.
- `robots.txt` disallows crawling while staging is non-indexable.

This prevents the V2 host from competing with the live site or splitting canonical signals.

## Production cutover

The lowest-risk launch is a same-domain application replacement:

1. Verify every current production URL returns the expected V2 page on staging.
2. Verify titles, descriptions, canonicals, hreflang, structured data and sitemap.
3. Point `www.3dboxstudio.com` / `3dboxstudio.com` to this V2 deployment.
4. Set `NEXT_PUBLIC_SITE_URL=https://www.3dboxstudio.com`.
5. Set `SITE_INDEXABLE=true` only after the production domain is serving V2.
6. Confirm `/robots.txt` allows crawling and references `/sitemap.xml`.
7. Submit the unchanged production sitemap URL in Google Search Console.
8. Keep the old URL structure intact; do not mass-redirect established articles to new slugs.
9. Monitor Search Console indexing, clicks, impressions, canonical selection and 404s after launch.

Do **not** launch V2 as an indexed `v2.3dmodel.com` property and then later migrate it back to `3dboxstudio.com`. That would create a needless domain migration on top of a redesign.

## Content and SEO work included

- Migrated the complete 29-post article catalog and preserved slugs, publication dates, update dates, keywords and FAQ content.
- Restored article pages with canonical metadata, Article JSON-LD, FAQ JSON-LD where applicable, internal links and related crawl paths.
- Restored the blog index with category/topic context.
- Restored FAQ content and FAQPage JSON-LD.
- Restored contact, privacy and terms routes.
- Preserved localized landing/Studio routes and the existing translated French article.
- Preserved production homepage and Studio SEO titles/descriptions instead of replacing them with prototype copy.
- Added a compact, visible semantic section to the new Lovable-inspired homepage so core search intent (3D box designer, packaging mockups, custom dimensions, per-face artwork, cartons/mailers) remains represented in page content.
- Added sitemap, robots behavior, canonical safeguards and legacy locale redirects.
- Restored footer/internal links to Guides, FAQ, Contact, Privacy and Terms.

## Image continuity

The article image URL pattern is preserved at `/images/blog/[slug].webp`. V2 currently redirects these requests to the matching public assets in the source repository so no article ships with a broken hero image while code and content are separated across repositories.

For the final production cutover, copying those WebP files into V2's `public/images/blog/` directory is preferred. Once copied, the route handler at `src/app/images/blog/[filename]/route.ts` can be removed.

## Contact workflow

The SEO route and contact content are preserved. The full existing contact submission backend depends on the current application's database, mailer, rate-limit and Turnstile stack and is intentionally not duplicated blindly in this content migration. Connect that workflow to V2 before the production cutover if the existing form is required on day one.

## Validation

The repository already includes `.github/workflows/ci.yml` running `npm ci` and `npm run check` with staging indexing disabled. Vercel preview deployment can remain blocked/noindex without affecting the production site.
