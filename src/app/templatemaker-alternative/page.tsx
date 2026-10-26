import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { CompareTable, ComparisonLinks } from "@/components/compare-table";
import { SEO_PAGES, seoPageMetadata, servedSeoPage } from "@/content/seo-pages";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";
import { site } from "@/lib/site";
import { withStyleCount } from "@/lib/template-count-copy";
import { activeStyleCountNow } from "@/server/templates";

const page = SEO_PAGES.templatemaker;
export async function generateMetadata(): Promise<Metadata> {
  return withStyleCount(seoPageMetadata(page), await activeStyleCountNow());
}

// Sources for the Templatemaker column, checked 2026-10-20 (vendor pages via
// search index; the pages could not be fetched directly, so recheck in a
// browser before publishing):
// - Free to use, no account ("You can't even make an account"), sizes in mm,
//   cm or inches: https://www.templatemaker.nl/en/ , https://www.templatemaker.nl/en/help.html
// - Exports PDF, DXF, SVG and PNG, plus SignCut; tiled PDF; perforated cut
//   lines in DXF: https://www.templatemaker.nl/en/help.html
// - Template range beyond boxes (polyhedra, envelopes, bags, cones and more):
//   https://www.templatemaker.nl/en/
// - Licence: templates may be used for physical products, not redistributed
//   as digital files: https://www.templatemaker.nl/en/licence.html
// - Paid option to sponsor a new template: https://www.templatemaker.nl/en/business.html
// - No 3D preview found on the site. VERIFY before publishing.
const rows = [
  { label: "Price", ours: "Free, with every feature. Dieline downloads need no account; the Studio needs a free one", theirs: "Free, with no account at all; businesses can pay to sponsor a new template" },
  { label: "Box sizing", ours: "Inside, outside or crease-to-crease sizes in mm or inches, plus board thickness", theirs: "Any size in mm, cm or inches" },
  { label: "File formats", ours: "SVG, PDF (1:1 or tiled on A4/Letter), DXF, PNG and a Cricut SVG", theirs: "PDF (including tiled), DXF, SVG, PNG and SignCut" },
  { label: "Line types", ours: "Cut, crease, glue, bleed and safe zone on separate, colour-coded layers", theirs: "Cut and fold lines; perforated cut lines in DXF" },
  { label: "3D preview", ours: "The box folds and opens in 3D as you change the size; add artwork and export PNG or MP4", theirs: "No 3D preview found" },
  { label: "Template range", ours: "16 box structures, from tuck end cartons and mailers to cake, telescope, hexagon and rigid boxes", theirs: "A wide range of shapes beyond boxes, such as polyhedra, envelopes, bags and cones" },
  { label: "Artwork", ours: "Place artwork on the dieline in the Studio and download a print PDF with bleed", theirs: "Templates only; add artwork in your own design software" },
];

const sections = [
  {
    title: "Where Templatemaker is the better choice",
    body: "Templatemaker covers far more shapes than boxes: polyhedra, envelopes, bags, cones and other craft forms that 3D Box Studio does not draw. It needs no account for anything, and it exports for SignCut cutters and perforated DXF lines. If you need one of those shapes, use it.",
  },
  {
    title: "Where 3D Box Studio is the better choice",
    body: "For boxes you plan to print, 3D Box Studio shows the box folded in 3D while you change its size, so you see the proportions before you cut. Its dielines keep cut, crease, glue, bleed and safe zone on separate layers that printers expect, sizes allow for board thickness, and you can place artwork and download a print-ready PDF.",
  },
  {
    title: "Both are free",
    body: "Neither tool charges for its templates. 3D Box Studio asks for a free account only to design artwork in the Studio; downloading a dieline from the generator needs none.",
  },
  {
    title: "Check before you produce",
    body: "Whichever tool you use, print a test at 100%, fold a sample from the board you plan to use, and confirm the file with your printer before a production run.",
  },
];

const faqs = [
  { question: "Is 3D Box Studio related to Templatemaker?", answer: "No. They are separate, independent products. Both make free templates in a custom size; 3D Box Studio focuses on boxes and adds a 3D preview and artwork." },
  { question: "Do I need an account to download a dieline?", answer: "No. The box dieline generator downloads SVG, PDF, DXF, PNG and Cricut files without an account. A free account is needed only to design artwork in the Studio." },
  { question: "Can I see the box in 3D before I cut it?", answer: "Yes. The box folds and opens in 3D as you type its size, and you can drag the panels to resize it." },
  { question: "Does 3D Box Studio make envelopes or polyhedra?", answer: "No. It draws 16 box structures. For envelopes, polyhedra and other craft shapes, Templatemaker has a wider range." },
  { question: "Can I sell products made with the templates?", answer: "Yes. Boxes made from 3D Box Studio dielines can be used for products you sell, at no cost." },
];

export default async function Page() {
  if (!servedSeoPage(page)) notFound();
  const copy = withStyleCount({ description: page.description, rows, sections, faqs }, await activeStyleCountNow());
  const url = new URL(page.path, site.url).toString();
  const crumbs = [{ name: "Box dieline generator", path: "/box-dieline-generator" }, { name: "Templatemaker alternative", path: page.path }];
  const schema = [
    { "@type": "WebPage", name: page.title, description: copy.description, url },
    { "@type": "FAQPage", mainEntity: copy.faqs.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
  ];
  return <><MarketingProductPage
    breadcrumbs={crumbs}
    eyebrow="Templatemaker alternative"
    title="A Templatemaker alternative for boxes, with a 3D preview."
    intro="Templatemaker is a free, no-account maker for all kinds of craft templates. If you are making boxes, 3D Box Studio draws the dieline in your size too, free and without an account, and shows the box folded in 3D before you print or cut it."
    primaryCta="Start designing free"
    secondaryHref="/box-dieline-generator"
    secondaryLabel="Open the dieline generator"
    sections={copy.sections}
    faqs={copy.faqs}
    about
    afterHero={<><CompareTable competitor="Templatemaker" rows={copy.rows} checked="Templatemaker details from templatemaker.nl (home, help, licence and business pages), checked 20 October 2026; check templatemaker.nl for current features." /><ComparisonLinks current={page.path} /></>}
  /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema(crumbs), ...schema) }} /></>;
}
