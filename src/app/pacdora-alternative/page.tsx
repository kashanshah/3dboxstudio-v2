import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Pacdora Alternative for Free 3D Box Mockups | 3D Box Studio" },
  description: "Looking for a Pacdora alternative? Compare a focused browser workflow for custom box dimensions, dieline artwork, 3D packaging previews, PNG export, saving and sharing.",
  alternates: { canonical: "/pacdora-alternative" },
  openGraph: { title: "Pacdora Alternative for Free 3D Box Mockups | 3D Box Studio", description: "Looking for a Pacdora alternative? Compare a focused browser workflow for custom box dimensions, dieline artwork, 3D packaging previews, PNG export, saving and sharing.", type: "website" }
};

const sections = [
  {
    "title": "What 3D Box Studio focuses on",
    "body": "The Studio is centered on box structures, finished dimensions, 2D artwork placement, live 3D review, opening behavior, PNG export, project saving, and share links."
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
    "question": "Can I save projects and send review links?",
    "answer": "Yes. V2 supports account-based saved projects and shareable preview links in addition to PNG export."
  }
];

export default function Page(){
  const url=new URL("/pacdora-alternative",site.url).toString();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"WebPage",name:"A focused Pacdora alternative for browser-based 3D box design.",description:"Looking for a Pacdora alternative? Compare a focused browser workflow for custom box dimensions, dieline artwork, 3D packaging previews, PNG export, saving and sharing.",url},
    {"@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}
  ]};
  return <><MarketingProductPage eyebrow="Pacdora alternative" title="A focused Pacdora alternative for browser-based 3D box design." intro="If your main job is to choose a box structure, set dimensions, place artwork, preview it in 3D, and share or export the result, 3D Box Studio offers a simpler focused workflow. It is not intended to copy every feature of Pacdora." secondaryHref="/blog/free-pacdora-alternative-3d-box-mockups" secondaryLabel="Read the detailed comparison" sections={sections} faqs={faqs} /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
