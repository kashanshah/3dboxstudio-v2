import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { CompareTable, ComparisonLinks } from "@/components/compare-table";
import { SEO_PAGES, seoPageMetadata, servedSeoPage } from "@/content/seo-pages";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";
import { site } from "@/lib/site";

const page = SEO_PAGES.dieCutTemplates;
export const metadata: Metadata = seoPageMetadata(page);

// Sources for the Die Cut Templates column (diecuttemplates.com), checked
// 2026-10-20 (vendor pages via search index; the pages could not be fetched
// directly, so recheck in a browser before publishing):
// - Library of about 35,000+ parametric templates, exports DXF, SVG and PDF,
//   board thickness taken into account: https://www.diecuttemplates.com/ ,
//   https://www.diecuttemplates.com/faqs/en
// - Subscriptions and single-template credits: https://www.diecuttemplates.com/pricing
//   VERIFY: copies found disagree. One shows Starter 29.90 USD/month or 299/year,
//   Business 59.90 or 599, Business Plus 99.90 or 999, and a single credit at
//   9.90 USD that expires in 48 hours; an older copy shows credit packs. The
//   page text below avoids figures for that reason.
// - A limited set of free dielines in fixed sizes: https://www.diecuttemplates.com/free-dielines
// - 3D mockups: https://www.diecuttemplates.com/3d-mockups
// - Nesting/imposition: https://www.diecuttemplates.com/nesting-imposition
// - Manufacturing cost calculator: https://www.diecuttemplates.com/manufacturing-cost-calculator
// - Illustrator plug-in and API: https://www.diecuttemplates.com/faqs/en  VERIFY.
const rows = [
  { label: "Price", ours: "Free, with every feature. Dieline downloads need no account; the Studio needs a free one", theirs: "Paid subscriptions or single-template credits; a small set of free dielines in fixed sizes" },
  { label: "Box sizing", ours: "Any size: inside, outside or crease-to-crease, in mm or inches, plus board thickness", theirs: "Any size on paid templates, with board thickness" },
  { label: "File formats", ours: "SVG, PDF (1:1 or tiled on A4/Letter), DXF, PNG and a Cricut SVG", theirs: "DXF, SVG and PDF" },
  { label: "3D preview", ours: "The box folds and opens in 3D as you change the size; add artwork and export PNG or MP4", theirs: "3D mockups" },
  { label: "Template range", ours: "15 box structures, from tuck end cartons and mailers to cake, telescope and rigid boxes", theirs: "A library of tens of thousands of templates, including many FEFCO and ECMA styles" },
  { label: "Production tools", ours: "Not offered: send the dieline to your printer, who nests and prices it", theirs: "Nesting and imposition, a manufacturing cost calculator, an Illustrator plug-in and an API" },
];

const sections = [
  {
    title: "Where Die Cut Templates is the better choice",
    body: "Die Cut Templates has a far larger library: tens of thousands of structures, including unusual FEFCO and ECMA styles, inserts and displays. It adds production tools such as nesting several dielines on a sheet, a cost calculator and an Illustrator plug-in. For packaging companies and converters who need that range every week, a subscription can pay for itself.",
  },
  {
    title: "Where 3D Box Studio is the better choice",
    body: "If the box you need is one of the common styles (tuck end, auto lock or snap lock bottom, mailer, split top shipping, gable, pillow, drawer, sleeve, tray, telescope, cake or rigid), 3D Box Studio draws it in your exact size for free, with no account and no credits. You see the box fold in 3D as you change it, and can add artwork and export mockups.",
  },
  {
    title: "Paying for one box",
    body: "Buying a single template makes sense for an unusual structure. For a standard carton or mailer, the free generator gives you the same kind of file: cut and crease lines on separate layers, sized from the inside, allowing for board thickness.",
  },
  {
    title: "Check before you produce",
    body: "Whichever tool you use, fold a sample from the board you plan to use and confirm the dieline with your printer before a production run.",
  },
];

const faqs = [
  { question: "Is 3D Box Studio related to Die Cut Templates?", answer: "No. They are separate, independent products." },
  { question: "Is 3D Box Studio really free?", answer: "Yes. Every box style downloads as SVG, PDF, DXF, PNG or a Cricut file in any size, without an account, credits or a watermark. A free account is needed only to design artwork in the Studio." },
  { question: "Which box styles can I make?", answer: "15 structures: reverse and straight tuck end, auto lock and snap lock bottom cartons, mailer (FEFCO 0427), split top shipping box (FEFCO 0201), pillow, gable, drawer, pizza, sleeve, four-corner tray, telescope, cake and rigid lid and base boxes." },
  { question: "Does 3D Box Studio nest dielines on a sheet?", answer: "No. Printers and converters usually nest and impose the dieline themselves. Send them the DXF or PDF." },
  { question: "Do the dielines allow for board thickness?", answer: "Yes. Set the thickness and the panels and flaps adjust so the inside size stays as you typed it." },
];

export default function Page() {
  if (!servedSeoPage(page)) notFound();
  const url = new URL(page.path, site.url).toString();
  const crumbs = [{ name: "Box dieline generator", path: "/box-dieline-generator" }, { name: "Die Cut Templates alternative", path: page.path }];
  const schema = [
    { "@type": "WebPage", name: page.title, description: page.description, url },
    { "@type": "FAQPage", mainEntity: faqs.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
  ];
  return <><MarketingProductPage
    breadcrumbs={crumbs}
    eyebrow="Die Cut Templates alternative"
    title="Free box dielines in any size, instead of buying a template."
    intro="Die Cut Templates sells a large library of parametric dielines. If the box you need is a common style, 3D Box Studio draws it in your exact size for free, with no account, and folds it in 3D so you can check it before you order."
    primaryCta="Start designing free"
    secondaryHref="/box-dieline-generator"
    secondaryLabel="Open the dieline generator"
    sections={sections}
    faqs={faqs}
    about
    afterHero={<><CompareTable competitor="Die Cut Templates" rows={rows} checked="Die Cut Templates details from diecuttemplates.com (pricing, free dielines, 3D mockups, nesting, cost calculator and FAQ pages), checked 20 October 2026; check diecuttemplates.com for current plans and prices." /><ComparisonLinks current={page.path} /></>}
  /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema(crumbs), ...schema) }} /></>;
}
