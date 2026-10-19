import { BLOG_POSTS } from '@/content/blogPosts';
import { site } from '@/lib/site';
import { BOX_TEMPLATE_PAGES } from '@/content/box-template-pages';

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

  const templates = BOX_TEMPLATE_PAGES.map(page => `- [${page.name} template](${url(`/box-templates/${page.slug}`)}): ${page.description}`);

  const body = `# 3D Box Studio

> 3D Box Studio is a free online 3D box generator, maker and packaging mockup tool. You choose a box structure, enter exact dimensions in millimetres or inches, place artwork on the flat dieline, fold the box in an interactive 3D preview, and export PNG mockups, an MP4 fold-and-turn video, or the dieline as a 1:1 PDF, SVG or DXF. It runs in the browser; using the Studio requires a free account (Google or email).

## Key facts

- Price: free. The box dieline generator (/box-dieline-generator and each /box-templates page) needs no account: dielines for 15 box styles download as SVG, PDF (one page or tiled on A4/Letter), DXF, PNG and a Cricut/Silhouette SVG, sized by inside, outside or crease-to-crease dimensions, with no watermark or limit. A free account is required to use the Studio (artwork, 3D folding, saving, mockup and video export). Shared preview links can be opened by anyone without an account.
- Box templates available now: reverse tuck end carton, straight tuck end box, auto lock bottom (crash lock) box with a pre-glued self-locking bottom, snap lock (1-2-3) bottom box that closes by hand without glue, pillow box with curved ends that close when pushed in, gable box with a pitched roof, carry handle and auto-lock bottom, drawer box (a tray that slides out of a sleeve, with thumb notches), four-corner tray (glued corners), telescope box (a four-corner tray with a lift-off lid tray, adjustable lid height), cake box (one piece, corners locked without glue, optional lid window), split top box, pizza box, mailer box (FEFCO 0427), sleeve box and rigid lid and base box (two-piece set-up box with corner ears, turn-ins, adjustable lid height and turn-in depth). Flap and panel sizes can be adjusted per side on most templates.
- Workflow: 1) Box — structure, finished size and material; 2) Design — images and text (9 bundled fonts) on the outside and inside of the dieline with cut, crease and bleed guides, and an artboard (the dieline plus bleed) that full-sheet artwork can be made to fit; 3) Preview & Download — fold from flat to closed in 3D, then export.
- Exports: PNG mockup images from the 3D view; a 1:1 vector PDF dieline (outside or inside, adjustable bleed, cut and crease lines, calibration ruler); the cutting template on its own as SVG or DXF (R12) at 1:1 in millimetres, with cut and crease lines on separate CUT and CREASE layers, for die makers, CAD programs, cutting tables, Cricut and laser cutters. An MP4 video of 6, 10 or 15 seconds (1080p, 720p on phones): fold and turn (flat to closed, then one turn), turntable, or open and close (the lid opens as the box turns); turntable and open and close loop seamlessly; studio, white or any colour background.
- Sharing: view-only interactive 3D links for clients and teammates.
- Languages: the Studio is in English. The home page is translated (/es, /es-mx, /fr, /pt-br, /de, /zh), and the dieline generator and the reverse tuck, mailer, pizza, split top (caja americana) and pillow box templates have Spanish pages at /es/box-dieline-generator and /es/box-templates.
- Production: dielines are design-ready layouts for proofs and review. Validate board thickness, tolerances, glue areas and printer requirements with your printer before manufacturing.
- Commercial use: exports of your own designs can be used for client work, marketing and e-commerce, provided you have rights to the uploaded artwork.
- Devices: works in modern desktop browsers; phones and tablets can view and export, but detailed editing is most comfortable on a larger screen.
- Compared with Pacdora: a focused, free browser workflow for supported box structures, dielines and 3D review. Pacdora has a larger template library and ecosystem; compare the specific feature you need.
- Compared with Adobe Dimension, Boxshot and Placeit: no install or subscription, boxes built from exact dimensions, and a dieline in the same project. Those tools are stronger for photoreal scenes (Dimension, Boxshot) or lifestyle photo templates (Placeit).

## Main pages

- [Home](${url('/')}): Overview of the free 3D box generator and mockup maker.
- [Studio](${url('/studio')}): The design workspace (free account required).
- [Features](${url('/features')}): Dieline design, 3D preview, materials, saving, sharing and export.
- [3D box mockup generator](${url('/3d-box-mockup-generator')}): Create 3D box mockups from real dimensions and artwork.
- [Box dieline generator](${url('/box-dieline-generator')}): Generate a flat dieline layout with cut, crease and bleed guides.
- [Box templates](${url('/box-templates')}): Supported packaging structures.
${templates.join('\n')}
- [Packaging design online](${url('/packaging-design-online')}): Browser workflow from dieline artwork to 3D preview.
- [Pacdora alternative](${url('/pacdora-alternative')}): How 3D Box Studio compares with Pacdora.
- [Adobe Dimension alternative](${url('/adobe-dimension-alternative')}): For Dimension users now that it is in maintenance mode.
- [Boxshot alternative](${url('/boxshot-alternative')}): Browser-based box mockups and dielines compared with Boxshot.
- [Placeit box mockup alternative](${url('/placeit-box-mockup-alternative')}): Real-dimension 3D boxes compared with photo templates.
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
