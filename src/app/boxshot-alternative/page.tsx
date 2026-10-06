import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { CompareTable, ComparisonLinks } from "@/components/compare-table";
import { site, defaultOgImage } from "@/lib/site";

const title = "Boxshot Alternative: Free Online 3D Box Mockups | 3D Box Studio";
const description = "Compare 3D Box Studio with Boxshot. A free, browser-based way to design boxes from real dimensions, generate the dieline, fold it in 3D and export PNG or PDF.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/boxshot-alternative" },
  openGraph: { images: [defaultOgImage], title, description, type: "website", url: "/boxshot-alternative" },
};

const rows = [
  {
    "label": "Price",
    "ours": "Free (account required)",
    "theirs": "Paid: subscription or one-time licence; demo adds watermarks"
  },
  {
    "label": "Platform",
    "ours": "Any modern browser",
    "theirs": "Desktop app for Windows and macOS"
  },
  {
    "label": "Box sizing",
    "ours": "Exact width, height and depth in mm or inches",
    "theirs": "Configurable shapes"
  },
  {
    "label": "Dieline",
    "ours": "Generated from your size, included free",
    "theirs": "Basic “Dieline Box” shape; full dielines are a separate paid product"
  },
  {
    "label": "Print output",
    "ours": "1:1 vector PDF dieline with cut, crease and bleed",
    "theirs": "Rendered images; dielines via the separate dieline maker"
  },
  {
    "label": "3D preview",
    "ours": "Real-time fold and open, orbit, PNG export",
    "theirs": "Photoreal renders, animations and 3D HTML export"
  },
  {
    "label": "Product range",
    "ours": "Boxes and cartons",
    "theirs": "Boxes plus books, bottles, cans, displays and more"
  },
  {
    "label": "Sharing",
    "ours": "View-only 3D link for clients",
    "theirs": "Export files to share"
  }
];

const sections = [
  {
    "title": "Why people look for a Boxshot alternative",
    "body": "Boxshot is aimed at studios that need high-end renders and animation, and it is priced and installed like professional desktop software. For a quick box mockup, a client approval or a print-ready dieline, that can be more tool than the job needs."
  },
  {
    "title": "What 3D Box Studio does differently",
    "body": "The box and the dieline are the same thing. You enter the finished size, the Studio draws the dieline, your artwork goes on the flat layout, and the 3D model folds from that layout, so what you approve in 3D matches what you send to print."
  },
  {
    "title": "When Boxshot is the better choice",
    "body": "Choose Boxshot for photoreal stills, turntable animations, non-box products such as bottles and books, or offline batch rendering."
  },
  {
    "title": "Getting started",
    "body": "Pick a box template, enter your size, upload artwork and fold it in 3D. Saving, sharing and exporting are included with a free account."
  }
];

const faqs = [
  {
    "question": "Is 3D Box Studio really free?",
    "answer": "Yes. It needs a free account; there is no paid tier for the current features."
  },
  {
    "question": "Do I need to install anything?",
    "answer": "No. It runs in a modern browser on Windows, macOS, Linux and ChromeOS."
  },
  {
    "question": "Can 3D Box Studio export animations or video?",
    "answer": "Not yet. It exports PNG images from the 3D view and a PDF dieline."
  },
  {
    "question": "Can I use the dieline for printing?",
    "answer": "It is a 1:1 design-ready dieline for proofs and approvals. Confirm board thickness and tolerances with your printer before production."
  }
];

export default function Page() {
  const url = new URL("/boxshot-alternative", site.url).toString();
  const schema = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", name: "A free, browser-based Boxshot alternative for boxes.", description, url },
    { "@type": "FAQPage", mainEntity: faqs.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
  ] };
  return <><MarketingProductPage eyebrow={"Boxshot alternative"} title="A free, browser-based Boxshot alternative for boxes." intro={"Boxshot is a capable desktop renderer for product shots. If you mainly need box mockups built from real dimensions, with a dieline you can hand to a printer, 3D Box Studio does that in the browser without an install or a licence."} primaryCta="Start designing free" secondaryHref="/box-templates" secondaryLabel="Browse box templates" sections={sections} faqs={faqs} afterHero={<><CompareTable competitor={"Boxshot"} rows={rows} checked={"Boxshot details checked in October 2026 from the publisher’s website; pricing and features may change."} /><ComparisonLinks current="/boxshot-alternative" /></>} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /></>;
}
