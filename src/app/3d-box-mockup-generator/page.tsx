import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Free 3D Box Mockup Generator Online | 3D Box Studio" },
  description: "Create a free 3D box mockup online from real dimensions and your own artwork. Rotate, open, review, save, share, and export PNG packaging previews in your browser.",
  alternates: { canonical: "/3d-box-mockup-generator" },
  openGraph: { title: "Free 3D Box Mockup Generator Online | 3D Box Studio", description: "Create a free 3D box mockup online from real dimensions and your own artwork. Rotate, open, review, save, share, and export PNG packaging previews in your browser.", type: "website" }
};

const sections = [
  {
    "title": "Choose the box and size",
    "body": "Start from a supported structure and enter finished dimensions so the mockup reflects the proportions you are actually designing for."
  },
  {
    "title": "Add your artwork",
    "body": "Upload graphics to the flat packaging layout and place them on the correct panels with layer and transform controls."
  },
  {
    "title": "Review the assembled result",
    "body": "Orbit, zoom, switch camera views, and inspect how artwork wraps around edges and adjacent panels."
  },
  {
    "title": "Open, close, and refine",
    "body": "Use the structure's opening behavior to check more than one closed presentation angle."
  },
  {
    "title": "Export or share",
    "body": "Download a PNG or share a browser preview when you need feedback without sending an editable file."
  }
];
const faqs = [
  {
    "question": "Is the 3D box mockup generator free?",
    "answer": "3D Box Studio is free to start in the browser. You can open the Studio and begin designing without installing desktop software."
  },
  {
    "question": "Can I use my own artwork?",
    "answer": "Yes. Upload your graphics and place them on the box panels in the 2D workspace."
  },
  {
    "question": "Can I use custom dimensions?",
    "answer": "Yes, for supported templates. Enter finished dimensions and choose the relevant unit."
  },
  {
    "question": "Can clients view a mockup without editing it?",
    "answer": "Yes. Saved projects can provide shareable preview links for review."
  },
  {
    "question": "Can I save and reopen a mockup later?",
    "answer": "Yes. Signed-in projects can be saved to your account and reopened from the project library."
  },
  {
    "question": "Can I use the PNG in client or commercial work?",
    "answer": "Yes, provided you have the rights to the artwork and assets used in the design. Marketplace-specific image rules should still be checked before publishing."
  }
];

export default function Page(){
  const url=new URL("/3d-box-mockup-generator",site.url).toString();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"WebPage",name:"Turn packaging artwork into an interactive 3D box mockup.",description:"Create a free 3D box mockup online from real dimensions and your own artwork. Rotate, open, review, save, share, and export PNG packaging previews in your browser.",url},
    {"@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}
  ]};
  return <><MarketingProductPage eyebrow="3D box mockup generator" title="Turn packaging artwork into an interactive 3D box mockup." intro="Use your own artwork and finished box dimensions to create a browser-based packaging mockup you can rotate, open, review, save, share, and export as a PNG." secondaryHref="/packaging-design-online" secondaryLabel="See the full design workflow" sections={sections} faqs={faqs} /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
