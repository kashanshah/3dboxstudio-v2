import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { CompareTable, ComparisonLinks } from "@/components/compare-table";
import { site, defaultOgImage } from "@/lib/site";

const title = "Placeit Box Mockup Alternative with Real Dimensions | 3D Box Studio";
const description = "Placeit box mockups are fixed photo templates. 3D Box Studio builds the box from your dimensions and dieline, folds it in 3D and exports PNG mockups free.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/placeit-box-mockup-alternative" },
  openGraph: { images: [defaultOgImage], title, description, type: "website", url: "/placeit-box-mockup-alternative" },
};

const rows = [
  {
    "label": "Price",
    "ours": "Free (account required)",
    "theirs": "Subscription; free tier with watermarks and limited templates"
  },
  {
    "label": "How mockups work",
    "ours": "A 3D box built from your dimensions",
    "theirs": "Artwork placed into fixed photo templates"
  },
  {
    "label": "Custom size",
    "ours": "Any width, height and depth",
    "theirs": "Set by the template"
  },
  {
    "label": "Dieline",
    "ours": "Generated, with artwork placed panel by panel",
    "theirs": "Not offered"
  },
  {
    "label": "Angles",
    "ours": "Any angle; orbit, open and fold in 3D",
    "theirs": "Fixed camera angle per template"
  },
  {
    "label": "Print output",
    "ours": "1:1 vector PDF dieline",
    "theirs": "Mockup images only"
  },
  {
    "label": "Best for",
    "ours": "Packaging design, approvals and print prep",
    "theirs": "Fast lifestyle and marketing images"
  }
];

const sections = [
  {
    "title": "Photo templates vs a real 3D box",
    "body": "A photo template looks great when your box matches its proportions. If your carton is taller, slimmer or deeper, the artwork stretches. 3D Box Studio builds the box to your size, so the proportions are always right."
  },
  {
    "title": "Design once, use it for print too",
    "body": "Because artwork is placed on the dieline, the same project gives you the PNG mockup for your store and the PDF dieline for your printer."
  },
  {
    "title": "When Placeit is the better choice",
    "body": "For styled lifestyle scenes with hands, tables and props, or for apparel and device mockups, a photo template library is faster."
  },
  {
    "title": "Getting started",
    "body": "Choose a template, enter your size, upload your artwork and export a PNG from any angle."
  }
];

const faqs = [
  {
    "question": "Is 3D Box Studio free?",
    "answer": "Yes, with a free account. There are no watermarks on exports."
  },
  {
    "question": "Can I make lifestyle scenes?",
    "answer": "No. 3D Box Studio exports the box itself on a clean background. Use the PNG in your own scenes or layouts."
  },
  {
    "question": "Which boxes are supported?",
    "answer": "Reverse tuck end and straight tuck end cartons, pizza boxes and split top boxes. Mailer and sleeve boxes are planned."
  },
  {
    "question": "Can I use mockups commercially?",
    "answer": "Yes, as long as you have the rights to the artwork you upload."
  }
];

export default function Page() {
  const url = new URL("/placeit-box-mockup-alternative", site.url).toString();
  const schema = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", name: "Box mockups from your real dimensions, not a fixed photo.", description, url },
    { "@type": "FAQPage", mainEntity: faqs.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
  ] };
  return <><MarketingProductPage eyebrow={"Placeit alternative"} title="Box mockups from your real dimensions, not a fixed photo." intro={"Placeit is quick for lifestyle images: drop your artwork into a ready-made scene. When the box has to match a real size and a real dieline, 3D Box Studio builds it from your measurements so the mockup and the print file agree."} primaryCta="Start designing free" secondaryHref="/3d-box-mockup-generator" secondaryLabel="See the 3D mockup generator" sections={sections} faqs={faqs} afterHero={<><CompareTable competitor={"Placeit"} rows={rows} checked={"Placeit details from public sources as of October 2026; check placeit.net for current plans and pricing."} /><ComparisonLinks current="/placeit-box-mockup-alternative" /></>} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /></>;
}
