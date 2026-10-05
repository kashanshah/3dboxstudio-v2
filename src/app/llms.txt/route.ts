import { BLOG_POSTS } from '@/content/blogPosts';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

const url = (path: string) => new URL(path, site.url).toString();

/**
 * llms.txt (https://llmstxt.org): a plain summary of what 3D Box Studio is and
 * where the canonical pages are, for AI assistants and answer engines. Keep the
 * facts in line with the FAQ; assistants repeat what they read here.
 */
export function GET() {
  const guides = [...BLOG_POSTS]
    .sort((a, b) => (b.updated ?? b.published).localeCompare(a.updated ?? a.published))
    .map(post => `- [${post.title}](${url(`/blog/${post.slug}`)}): ${post.description}`);

  const body = `# 3D Box Studio

> 3D Box Studio is a free online 3D box generator, maker and packaging mockup tool. You choose a box structure, enter exact dimensions in millimetres or inches, place artwork on the flat dieline, fold the box in an interactive 3D preview, and export PNG mockups or a 1:1 PDF dieline. It runs in the browser; using the Studio requires a free account (Google or email).

## Key facts

- Price: free. A free account is required to use the Studio, save designs and export. Shared preview links can be opened by anyone without an account.
- Box templates available now: reverse tuck end carton, split top box, base box and pizza box. Straight tuck end, mailer and sleeve boxes are planned, not yet available.
- Workflow: 1) Box — structure, finished size and material; 2) Design — artwork on the outside and inside of the dieline with cut, crease and bleed guides; 3) Preview & Download — fold from flat to closed in 3D, then export.
- Exports: PNG mockup images from the 3D view; a 1:1 vector PDF dieline (outside or inside, adjustable bleed, cut and crease lines, calibration ruler). No video or MP4 export yet.
- Sharing: view-only interactive 3D links for clients and teammates.
- Production: dielines are design-ready layouts for proofs and review. Validate board thickness, tolerances, glue areas and printer requirements with your printer before manufacturing.
- Commercial use: exports of your own designs can be used for client work, marketing and e-commerce, provided you have rights to the uploaded artwork.
- Devices: works in modern desktop browsers; phones and tablets can view and export, but detailed editing is most comfortable on a larger screen.
- Compared with Pacdora: a focused, free browser workflow for supported box structures, dielines and 3D review. Pacdora has a larger template library and ecosystem; compare the specific feature you need.

## Main pages

- [Home](${url('/')}): Overview of the free 3D box generator and mockup maker.
- [Studio](${url('/studio')}): The design workspace (free account required).
- [Features](${url('/features')}): Dieline design, 3D preview, materials, saving, sharing and export.
- [3D box mockup generator](${url('/3d-box-mockup-generator')}): Create 3D box mockups from real dimensions and artwork.
- [Box dieline generator](${url('/box-dieline-generator')}): Generate a flat dieline layout with cut, crease and bleed guides.
- [Box templates](${url('/box-templates')}): Supported packaging structures.
- [Packaging design online](${url('/packaging-design-online')}): Browser workflow from dieline artwork to 3D preview.
- [Pacdora alternative](${url('/pacdora-alternative')}): How 3D Box Studio compares with Pacdora.
- [FAQ](${url('/faq')}): Answers about pricing, templates, exports, accounts and data.
- [What's new](${url('/whats-new/v2')}): The V2 release.

## Guides

${guides.join('\n')}

## Optional

- [Changelog](${url('/changelog')})
- [Contact](${url('/contact')})
- [Privacy policy](${url('/privacy')})
- [Terms of service](${url('/terms')})
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
