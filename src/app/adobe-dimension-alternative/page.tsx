import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { CompareTable, ComparisonLinks } from "@/components/compare-table";
import { site, defaultOgImage } from "@/lib/site";

const title = "Adobe Dimension Alternative for Packaging Mockups | 3D Box Studio";
const description = "Adobe Dimension gets no new features. 3D Box Studio is a free, browser-based alternative for box mockups: real dimensions, dielines, 3D folding and PNG/PDF export.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/adobe-dimension-alternative" },
  openGraph: { images: [defaultOgImage], title, description, type: "website", url: "/adobe-dimension-alternative" },
};

const rows = [
  {
    "label": "Status",
    "ours": "Actively developed web app",
    "theirs": "Maintenance mode: bug and security fixes, no new features"
  },
  {
    "label": "Price",
    "ours": "Free (account required)",
    "theirs": "Included in Creative Cloud All Apps; no standalone plan"
  },
  {
    "label": "Platform",
    "ours": "Any modern browser",
    "theirs": "Desktop app for Windows and macOS"
  },
  {
    "label": "Box models",
    "ours": "Parametric templates sized to your exact dimensions",
    "theirs": "Import or model the box shape yourself"
  },
  {
    "label": "Dieline",
    "ours": "Generated from your size; artwork placed on the flat layout",
    "theirs": "No dieline generation"
  },
  {
    "label": "Print output",
    "ours": "1:1 vector PDF dieline with cut, crease and bleed",
    "theirs": "Rendered images only"
  },
  {
    "label": "Rendering",
    "ours": "Real-time 3D with fold/open preview and PNG export",
    "theirs": "Photoreal ray-traced renders and scene lighting"
  },
  {
    "label": "Sharing",
    "ours": "View-only 3D link for clients",
    "theirs": "Share renders; Creative Cloud Libraries removed in 2025"
  }
];

const sections = [
  {
    "title": "What is happening to Adobe Dimension",
    "body": "Dimension has not been switched off, but feature development has stopped. Adobe removed Creative Cloud Libraries from Dimension after February 2025, new users have to enable “Show older apps” to install it, and Adobe recommends Substance 3D Stager, which is sold in the Substance 3D Collection."
  },
  {
    "title": "Where 3D Box Studio fits",
    "body": "Most packaging work in Dimension is putting flat artwork onto a box and showing it from a few angles. 3D Box Studio starts from the box itself: choose a structure, enter its dimensions, design on the dieline and the 3D model updates as you go."
  },
  {
    "title": "Where Dimension or Stager is still better",
    "body": "If you need photoreal scenes, custom lighting, props or arbitrary 3D models, a full 3D stager is the right tool. 3D Box Studio is focused on boxes and their dielines, not general 3D staging."
  },
  {
    "title": "Moving a design across",
    "body": "Export the flat artwork from Illustrator or Photoshop as PNG, JPG or SVG, upload it in the Design step and place it on the matching panels. There is no import for Dimension project files."
  }
];

const faqs = [
  {
    "question": "Has Adobe discontinued Dimension?",
    "answer": "Not officially. It is still part of Creative Cloud All Apps, but it is in maintenance mode with no new features, and Adobe points 3D work to Substance 3D Stager."
  },
  {
    "question": "Is 3D Box Studio free?",
    "answer": "Yes. It runs in the browser and needs a free account to design, save and export."
  },
  {
    "question": "Can I open Dimension (.dn) files?",
    "answer": "No. Export your artwork as images and place them on the dieline in the Design step."
  },
  {
    "question": "Does 3D Box Studio make photoreal renders?",
    "answer": "It renders a real-time 3D preview with materials such as kraft, matte, gloss and foil, and exports PNG images. It does not do ray-traced scene rendering like Dimension or Stager."
  }
];

export default function Page() {
  const url = new URL("/adobe-dimension-alternative", site.url).toString();
  const schema = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", name: "A free Adobe Dimension alternative for box packaging.", description, url },
    { "@type": "FAQPage", mainEntity: faqs.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
  ] };
  return <><MarketingProductPage eyebrow={"Adobe Dimension alternative"} title="A free Adobe Dimension alternative for box packaging." intro={"Adobe Dimension still installs with Creative Cloud, but it is in maintenance mode and Adobe now points 3D work to Substance 3D Stager. If you used Dimension mainly to put artwork on boxes, 3D Box Studio does that job in the browser, from a real dieline, for free."} primaryCta="Start designing free" secondaryHref="/box-templates" secondaryLabel="Browse box templates" sections={sections} faqs={faqs} afterHero={<><CompareTable competitor={"Adobe Dimension"} rows={rows} checked={"Adobe details from public sources as of October 2026; Adobe may change plans and availability."} /><ComparisonLinks current="/adobe-dimension-alternative" /></>} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /></>;
}
