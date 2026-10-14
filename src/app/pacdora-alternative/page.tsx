import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { CompareTable, ComparisonLinks } from "@/components/compare-table";
import { site, defaultOgImage } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Pacdora Alternative for Free 3D Box Mockups | 3D Box Studio" },
  description: "Looking for a Pacdora alternative? Compare a focused browser workflow for custom box dimensions, dieline artwork, 3D packaging previews, PNG and MP4 export, free SVG/DXF dielines, saving and sharing.",
  alternates: { canonical: "/pacdora-alternative" },
  openGraph: { images:[defaultOgImage], title: "Pacdora Alternative for Free 3D Box Mockups | 3D Box Studio", description: "Looking for a Pacdora alternative? Compare a focused browser workflow for custom box dimensions, dieline artwork, 3D packaging previews, PNG and MP4 export, free SVG/DXF dielines, saving and sharing.", type: "website" }
};

const rows = [
  { label: "Price", ours: "Free, with every feature (account required)", theirs: "Free plan with limits; paid plans for more exports, HD output and commercial use" },
  { label: "Box sizing", ours: "Exact width, height and depth in mm or inches, plus board thickness", theirs: "Custom dimensions on its templates" },
  { label: "Flap and panel sizes", ours: "Adjust each flap and panel on the dieline or the 3D box, with drag handles", theirs: "Depends on the template" },
  { label: "Dieline export", ours: "1:1 PDF with artwork and bleed, plus SVG and DXF with cut and crease layers, free", theirs: "Dieline downloads in several formats; limits depend on plan" },
  { label: "3D preview", ours: "Real-time fold and open, orbit, transparent PNG up to 4K and a 10-second MP4", theirs: "Photoreal mockups, animations and video" },
  { label: "Template range", ours: "9 box structures: tuck end, auto lock and snap lock bottom cartons, mailer, pizza, shipping, sleeve and rigid boxes", theirs: "Large library of boxes plus bags, bottles, cans and other packaging" },
  { label: "Sharing", ours: "View-only interactive 3D link", theirs: "Share links and exported files" },
];

const sections = [
  {
    "title": "What 3D Box Studio focuses on",
    "body": "The Studio is centered on box structures, finished dimensions, 2D artwork placement, live 3D review, opening behavior, PNG and MP4 export, project saving, and share links. Templates cover folding cartons, mailer, pizza and shipping boxes, and a rigid lid and base box, and every dieline downloads free as a 1:1 PDF, SVG or DXF."
  },
  {
    "title": "Where the products may differ",
    "body": "Pacdora offers a broader packaging ecosystem and feature set. 3D Box Studio is being built as a leaner box-design workspace rather than claiming one-to-one feature parity."
  },
  {
    "title": "Why teams may prefer a focused tool",
    "body": "For quick box mockups and visual approvals, fewer steps can matter more than having every adjacent packaging feature in one product."
  },
  {
    "title": "Use the right tool for production",
    "body": "Neither a visual mockup alone nor a comparison page should replace structural validation, printer specifications, or production proofing."
  }
];
const faqs = [
  {
    "question": "Is 3D Box Studio the same as Pacdora?",
    "answer": "No. It is a separate product with a narrower focus on browser-based box design, dieline artwork, and 3D preview."
  },
  {
    "question": "Is 3D Box Studio free?",
    "answer": "Yes. It runs in your browser and only needs a free account."
  },
  {
    "question": "Does it support custom dimensions?",
    "answer": "Yes, for supported structures."
  },
  {
    "question": "Does it replace production packaging CAD?",
    "answer": "No. Use it for design and visualization, then validate production requirements in the appropriate structural and print workflow."
  },
  {
    "question": "Can 3D Box Studio import an existing dieline?",
    "answer": "No. The current product intentionally works from its own supported packaging templates and dimensions rather than importing arbitrary external dielines."
  },
  {
    "question": "Can I download dielines as SVG or DXF?",
    "answer": "Yes, free for every template. The SVG and DXF hold the cutting template at 1:1 in millimetres with cut and crease lines on separate layers; the PDF adds your artwork and bleed."
  },
  {
    "question": "Does it have a rigid box template?",
    "answer": "Yes. The rigid lid and base box draws both wraps from your inside size, with corner ears, turn-ins and an adjustable lid height, and shows the lid lifting off in 3D."
  },
  {
    "question": "Can I save projects and send review links?",
    "answer": "Yes. V2 supports account-based saved projects and shareable preview links in addition to PNG, MP4 and dieline export."
  }
];

export default function Page(){
  const url=new URL("/pacdora-alternative",site.url).toString();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"WebPage",name:"A focused Pacdora alternative for browser-based 3D box design.",description:"Looking for a Pacdora alternative? Compare a focused browser workflow for custom box dimensions, dieline artwork, 3D packaging previews, PNG and MP4 export, free SVG/DXF dielines, saving and sharing.",url},
    {"@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}
  ]};
  return <><MarketingProductPage eyebrow="Pacdora alternative" title="A focused Pacdora alternative for browser-based 3D box design." intro="If your main job is to choose a box structure, set dimensions, place artwork, preview it in 3D, and share or export the result, 3D Box Studio offers a simpler focused workflow. It is not intended to copy every feature of Pacdora." secondaryHref="/blog/free-pacdora-alternative-3d-box-mockups" secondaryLabel="Read the detailed comparison" sections={sections} faqs={faqs} afterHero={<><CompareTable competitor="Pacdora" rows={rows} checked="Pacdora details from public sources as of October 2026; check pacdora.com for current plans and features." /><ComparisonLinks current="/pacdora-alternative" /></>} /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
