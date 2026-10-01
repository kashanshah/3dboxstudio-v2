import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Packaging Design Online — Dieline Artwork to 3D Preview | 3D Box Studio" },
  description: "Design packaging online in a browser workflow that combines box structure, finished dimensions, dieline artwork, layers, 3D preview, save, share and PNG export.",
  alternates: { canonical: "/packaging-design-online" },
  openGraph: { title: "Packaging Design Online — Dieline Artwork to 3D Preview | 3D Box Studio", description: "Design packaging online in a browser workflow that combines box structure, finished dimensions, dieline artwork, layers, 3D preview, save, share and PNG export.", type: "website" }
};

const sections = [
  {
    "title": "Define the packaging first",
    "body": "Choose the structure, finished size, units, material, and formation before artwork decisions get locked into the wrong proportions."
  },
  {
    "title": "Design on the dieline",
    "body": "Work on the flat layout with uploads, layers, crop, resize, rotation, and exact positioning."
  },
  {
    "title": "Check the same work in 3D",
    "body": "Move to Preview & Download to inspect the design around edges, corners, lids, and flaps."
  },
  {
    "title": "Iterate without rebuilding",
    "body": "Return to the artwork, make a change, and review the updated package from the same project."
  },
  {
    "title": "Save and share the review",
    "body": "Keep the project in your account and send a preview link when stakeholders need to inspect the result."
  }
];
const faqs = [
  {
    "question": "Do I need Photoshop to use 3D Box Studio?",
    "answer": "No. The Studio includes its own artwork placement and transform workflow. You can still prepare source artwork in another design tool if you prefer."
  },
  {
    "question": "Does it replace Illustrator or structural CAD?",
    "answer": "No. It focuses on packaging layout, visual editing, and 3D review. Final production artwork and structural validation may still involve specialist tools and printer requirements."
  },
  {
    "question": "Can I switch between 2D and 3D?",
    "answer": "Yes. The product workflow is designed around a flat Design workspace and a 3D Preview & Download workspace using the same project state."
  },
  {
    "question": "Can I work from a box template?",
    "answer": "Yes. Supported box structures provide the geometry and layout used by the Studio."
  }
];

export default function Page(){
  const url=new URL("/packaging-design-online",site.url).toString();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"WebPage",name:"Design packaging online without separating the flat file from the 3D proof.",description:"Design packaging online in a browser workflow that combines box structure, finished dimensions, dieline artwork, layers, 3D preview, save, share and PNG export.",url},
    {"@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}
  ]};
  return <><MarketingProductPage eyebrow="Packaging design online" title="Design packaging online without separating the flat file from the 3D proof." intro="3D Box Studio combines the box setup, 2D packaging artwork workspace, and interactive 3D review so a design can move from panel layout to client-ready preview without rebuilding the mockup." secondaryHref="/features" secondaryLabel="View all features" sections={sections} faqs={faqs} /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
