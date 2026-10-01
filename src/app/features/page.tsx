import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "3D Box Studio Features — 2D Dieline Design, 3D Preview & Export" },
  description: "Explore 3D Box Studio features: packaging templates, custom dimensions, 2D dieline artwork, layers, live 3D preview, opening simulation, PNG export, saving and share links.",
  alternates: { canonical: "/features" },
  openGraph: { title: "3D Box Studio Features — 2D Dieline Design, 3D Preview & Export", description: "Explore 3D Box Studio features: packaging templates, custom dimensions, 2D dieline artwork, layers, live 3D preview, opening simulation, PNG export, saving and share links.", type: "website" }
};

const sections = [
  {
    "title": "Choose a real packaging structure",
    "body": "Start from a supported box template instead of stretching one generic cube. The structure controls panel layout, geometry, and opening behavior.",
    "bullets": [
      "Template-based geometry",
      "Finished dimensions and units",
      "Material and finish controls"
    ]
  },
  {
    "title": "Design on the flat layout",
    "body": "Use the 2D dieline workspace for artwork placement. Upload graphics, drag and drop them, crop, resize, rotate, and organize layers while keeping panel context visible.",
    "bullets": [
      "Artwork upload and replace",
      "Layer ordering",
      "Exact transforms",
      "Outside/inside artwork where supported"
    ]
  },
  {
    "title": "See every change in 3D",
    "body": "The 3D preview uses the same design state, so edits can be checked from different angles without rebuilding a separate mockup.",
    "bullets": [
      "Orbit and zoom",
      "Camera presets",
      "Panel-aware artwork",
      "Live 2D-to-3D sync"
    ]
  },
  {
    "title": "Review how the box opens",
    "body": "Use fold/open controls to inspect how the structure behaves rather than judging only a closed hero angle.",
    "bullets": [
      "Open/close controls",
      "Structure-specific motion",
      "Assembled and flatter review states"
    ]
  },
  {
    "title": "Export, save, and share",
    "body": "Download PNG previews, save projects to your account, reopen designs later, and create shareable preview links for review.",
    "bullets": [
      "PNG export",
      "Project save/reopen",
      "Shareable previews"
    ]
  }
];
const faqs = [
  {
    "question": "Is 3D Box Studio a CAD program?",
    "answer": "No. It is a browser-based packaging design and visualization workspace. It can generate and use dielines for supported structures, but final manufacturing geometry and tolerances should still be validated in a production workflow."
  },
  {
    "question": "Does the Studio support custom box dimensions?",
    "answer": "Yes. Supported templates can be resized using finished dimensions and selectable units."
  },
  {
    "question": "Can I upload my own graphics?",
    "answer": "Yes. You can upload artwork and position it on the flat packaging layout with layer and transform controls."
  },
  {
    "question": "Can I save designs?",
    "answer": "Yes. Account-based projects can be saved and reopened, and preview links can be shared for review."
  },
  {
    "question": "Can I prepare a flat-layout PDF?",
    "answer": "Yes. The 2D Design workspace can prepare the current supported template layout for PDF output. Treat that output as part of the design/review workflow and validate production requirements before manufacturing."
  },
  {
    "question": "Does 3D Box Studio work entirely in the browser?",
    "answer": "Yes. The V2 workflow runs in a modern browser; no desktop application is required."
  }
];

export default function Page(){
  const url=new URL("/features",site.url).toString();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"WebPage",name:"A packaging design workspace that connects the dieline to the 3D box.",description:"Explore 3D Box Studio features: packaging templates, custom dimensions, 2D dieline artwork, layers, live 3D preview, opening simulation, PNG export, saving and share links.",url},
    {"@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}
  ]};
  return <><MarketingProductPage eyebrow="Product features" title="A packaging design workspace that connects the dieline to the 3D box." intro="3D Box Studio brings structure, dimensions, artwork editing, 3D review, export, saving, and sharing into one browser workflow. It is built for fast visual packaging decisions without requiring a heavyweight desktop install." secondaryHref="/box-templates" secondaryLabel="Explore box templates" sections={sections} faqs={faqs} /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
