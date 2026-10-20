# Dieline generator: search pages

The pages built around the free dieline generator: their addresses, titles and descriptions, and whether each one is live. Titles are 60 characters at most and descriptions 155 at most; `scripts/seo-pages.test.cjs` checks both.

## How a page goes live

New pages start as drafts. A draft is served on Vercel previews and in development, carries `noindex`, and is left out of the sitemap. In production it is a 404. To publish one, set its `status` to `'published'` in `src/content/seo-pages.ts`; for a guide, remove `draft: true` from its entry in `src/content/blogPosts.ts`. `SHOW_DRAFTS=true` serves drafts in production too, for a review deployment.

Links to these pages appear only where the page is served. The "More free tools" block on the generator hub and on each tool page lists the ones this deployment serves.

## New pages (built, draft)

| URL | Title | Description | Structured data |
| --- | --- | --- | --- |
| `/box-size-calculator` | Box Size Calculator: Inside & Outside Dimensions | Enter your product size and padding to get the inside and outside box dimensions, the board to use and the box styles that fit, then make the dieline free. | SoftwareApplication, FAQPage, BreadcrumbList |
| `/printable-box-templates` | Printable Box Templates with Measurements (Free) | Free printable box templates in any size: type your measurements, print the dieline at 100% on A4 or Letter, cut, score and fold. 15 styles, no sign-up. | SoftwareApplication, FAQPage, BreadcrumbList |
| `/cricut-box-templates` | Cricut Box Templates: Free SVG in Any Size | Make a Cricut box template in your exact size: cut and score SVG sized in inches, for Design Space and Silhouette. 15 box styles, free, no account. | SoftwareApplication, FAQPage, BreadcrumbList |
| `/packaging-glossary` | Packaging Glossary: Dieline and Box Terms Explained | Dieline and packaging terms in plain words: cut, crease and bleed lines, caliper, points and gsm, flutes, FEFCO and ECMA codes, tuck and glue flaps. | DefinedTermSet, BreadcrumbList |

Every page also carries the sitewide Organization data.

These follow the site's existing addresses rather than the brief's `/dieline-generator/*`, `/box-template/*`, `/guides/*` and `/glossary/*` trees. The hub stays at `/box-dieline-generator`, style pages at `/box-templates/<slug>`, guides at `/blog/<slug>` and comparisons at `/<name>-alternative`. The crafter hub is `/printable-box-templates`, because `/box-template` would sit beside the existing `/box-templates`.

## Existing pages changed

| URL | Title |
| --- | --- |
| `/box-dieline-generator` | Free Box Dieline Generator: SVG, PDF, DXF \| 3D Box Studio |
| `/box-templates/reverse-tuck-end-box` | Reverse Tuck End Box Template & Dieline \| 3D Box Studio |
| `/box-templates/straight-tuck-end-box` | Straight Tuck End Box Template & Dieline \| 3D Box Studio |
| `/box-templates/auto-lock-bottom-box` | Auto Lock Bottom Box Template & Dieline \| 3D Box Studio |
| `/box-templates/snap-lock-bottom-box` | Snap Lock Bottom Box Template & Dieline \| 3D Box Studio |
| `/box-templates/mailer-box` | Mailer Box Template & Dieline (FEFCO 0427) \| 3D Box Studio |
| `/box-templates/split-top-box` | Split Top Shipping Box Template & Dieline \| 3D Box Studio |
| `/box-templates/gable-box` | Gable Box Template & Dieline with Handle \| 3D Box Studio |
| `/box-templates/drawer-box` | Drawer Box Template: Sleeve & Tray Dieline \| 3D Box Studio |
| `/box-templates/sleeve-box` | Packaging Sleeve Template & Dieline \| 3D Box Studio |
| `/box-templates/rigid-box` | Rigid Box Template, Lid & Base Dieline \| 3D Box Studio |
| `/box-templates/telescope-box` | Telescope Box Template: Lid & Base Dieline \| 3D Box Studio |
| `/box-templates/cake-box` | Cake Box Template & Dieline, with Window \| 3D Box Studio |

The pizza box, pillow box and four-corner tray titles were already within 60 characters. Twelve template descriptions were shortened to 155 characters or fewer.

Every template page now has:
- visible breadcrumbs, with BreadcrumbList data starting at Home;
- SoftwareApplication data (price 0);
- a last-updated date;
- a "How to use the file" section;
- 2–4 related styles.

Guides gained breadcrumbs and BreadcrumbList data. The generator hub gained breadcrumbs, the About 3D Box Studio block and links to the new tools.

## Planned for Phase 5 (not built yet)

| URL | Proposed title | Proposed description |
| --- | --- | --- |
| `/blog/what-is-a-dieline` | What Is a Dieline? Lines, Layers and Examples | A dieline is the flat drawing of a box: its cuts, folds and glue areas at full size. What each line means, with examples, and how to make one free. |
| `/blog/dieline-line-types-and-colors` | Dieline Line Types and Colours Explained | Cut, crease, perforation, bleed, safe zone and glue: what each dieline line means, the colours printers expect, and how to set up the layers. |
| `/blog/paperboard-thickness-chart` | Paperboard Thickness Chart: pt, gsm, mm and Flutes | Board thickness in points, gsm and millimetres, from 12 pt card to B-flute corrugated, with what each grade suits and how it changes a dieline. |
| `/blog/fefco-box-codes-explained` | FEFCO Box Codes Explained, with Examples | What FEFCO codes mean, the styles you will meet most (0201, 0427 and more), and how to ask a printer for the right corrugated box. |
| `/blog/how-to-send-a-dieline-to-a-printer` | How to Send a Dieline to a Printer: Checklist | What a printer needs with your dieline: file types, layers, bleed, safe zone, board and quantities, as a checklist to send with the file. |
| `/blog/how-to-make-a-box-with-cricut` | How to Make a Box with Cricut, in Any Size | Make a box on a Cricut step by step: a template in your size, scoring in Design Space, the right cardstock, and folding it up. |
| `/templatemaker-alternative` | Templatemaker Alternative: Dielines with a 3D Preview | A free alternative to Templatemaker for box dielines: 15 styles, SVG, PDF and DXF without an account, and the box folded in 3D. Compared fairly. |
| `/die-cut-templates-alternative` | Die Cut Templates Alternative: Free, Any Size | A free alternative to buying die cut box templates: draw the dieline in your exact size, download it, and fold it in 3D. Compared fairly. |

Two guides from the brief already exist and are kept:
- `/blog/how-to-measure-a-box-inside-vs-outside-dimensions` covers both "inner vs outer box dimensions" and "how to measure a box".
- `/blog/box-template-svg-cricut-laser-cutter` covers Cricut file types; the planned Cricut guide is the step-by-step make.

Comparison pages will cite a dated source for every claim about another product.

Phase 5 also fills each template page's "Best for", "Not ideal for" and "Recommended materials" sections, which render only once they have content.

## Crawling

`robots.txt` (`src/app/robots.ts`) allows every crawler on all paths except `/api/` in production, and lists the sitemap. No crawler is singled out, so Bingbot and AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) are allowed. Previews and development send `Disallow: /` and `noindex`.

Firewall and bot-protection settings on Vercel (or Cloudflare, if it sits in front) can still block crawlers outside the app; they need checking in the dashboard.

After publishing, submit the sitemap in Google Search Console and Bing Webmaster Tools.

## Checks

On a production build with `SITE_INDEXABLE=true`, mobile Lighthouse:

| Page | Performance | Accessibility | SEO |
| --- | --- | --- | --- |
| Generator hub | 94 | 100 | 100 |
| Cake box page | 93 | 100 | 100 |
| Box size calculator | 89 | 100 | 69, noindex as a draft |
| Printable templates | 91 | 100 | 69, noindex as a draft |
| Cricut templates | 94 | 100 | 69, noindex as a draft |
| Glossary | 91 | 97 before its link fix | 69, noindex as a draft |

The glossary score was taken before link underlines were added; they fix the one accessibility finding. Draft pages lose SEO points only for `noindex`.

Structured data has been checked as valid JSON with the expected types. Run each published page through Google's Rich Results Test once it is live.
