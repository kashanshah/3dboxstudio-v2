import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { TemplatePageLinks } from "@/components/template-page-links";
import { site, defaultOgImage } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Box Dieline Generator Online — Design-Ready Packaging Layouts | 3D Box Studio" },
  description: "Generate a box dieline from supported packaging structures and dimensions, design artwork on the flat layout, and preview the result in 3D. Validate final production dielines before manufacturing.",
  alternates: { canonical: "/box-dieline-generator" },
  openGraph: { images:[defaultOgImage], title: "Box Dieline Generator Online — Design-Ready Packaging Layouts | 3D Box Studio", description: "Generate a box dieline from supported packaging structures and dimensions, design artwork on the flat layout, and preview the result in 3D. Validate final production dielines before manufacturing.", type: "website" }
};

const sections = [
  {
    "title": "Start with a supported structure",
    "body": "Choose a box template whose panel geometry and folding behavior are defined in the Studio. This gives the dieline a structural basis instead of treating it like a decorative outline.",
    "bullets": [
      "Structure-specific panels",
      "Finished dimensions",
      "Selectable units"
    ]
  },
  {
    "title": "Generate the flat layout",
    "body": "The Studio uses the structure and dimensions to create the 2D layout used for artwork placement and panel mapping.",
    "bullets": [
      "Panel boundaries",
      "Fold/cut layout for design context",
      "Artwork surface mapping"
    ]
  },
  {
    "title": "Design directly on the dieline",
    "body": "Add graphics to the flat layout with visual editing tools rather than guessing where perspective artwork belongs on a 3D mockup.",
    "bullets": [
      "Drag and drop artwork",
      "Crop and transform",
      "Layer management",
      "2D-to-3D preview"
    ]
  },
  {
    "title": "Validate before manufacturing",
    "body": "Use the generated layout for design and visualization, then verify final production details with your printer or structural packaging specialist before plates, tooling, or manufacturing."
  }
];
const faqs = [
  {
    "question": "Can 3D Box Studio generate a dieline from dimensions?",
    "answer": "For supported structures, yes. The Studio can create the flat layout from the selected template and finished dimensions."
  },
  {
    "question": "Is the generated dieline press-ready?",
    "answer": "Not universally. Dimensional and production tolerances are still being improved, so final manufacturing files should be checked for bleed, tolerances, board behavior, cut/fold rules, and printer requirements."
  },
  {
    "question": "Can I design artwork on the generated dieline?",
    "answer": "Yes. The flat layout is part of the artwork workflow, so you can place, transform, and organize graphics there."
  },
  {
    "question": "Can I preview the generated dieline as a 3D box?",
    "answer": "Yes. The same structure and artwork can be viewed in the interactive 3D workspace."
  },
  {
    "question": "Can I upload an external dieline into 3D Box Studio?",
    "answer": "No. The current workflow is based on 3D Box Studio's own supported packaging templates and their dimensions. External dieline importing is intentionally not part of the product right now."
  },
  {
    "question": "Can I export the flat layout as a PDF?",
    "answer": "The Design workspace can prepare the supported template layout for PDF output. It should still be reviewed against printer and structural requirements before production."
  }
];

export default function Page(){
  const url=new URL("/box-dieline-generator",site.url).toString();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"WebPage",name:"Box dieline generator—design the flat layout, preview in 3D.",description:"Generate a box dieline from supported packaging structures and dimensions, design artwork on the flat layout, and preview the result in 3D. Validate final production dielines before manufacturing.",url},
    {"@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}
  ]};
  return <><MarketingProductPage eyebrow="Box dieline generator" title="Box dieline generator—design the flat layout, preview in 3D." intro="For supported packaging structures, 3D Box Studio can derive the flat layout from the template and finished dimensions so you can plan artwork, understand panels, and visualize the assembled package." secondaryHref="/blog/how-to-generate-box-dieline-online" secondaryLabel="Read the dieline guide" sections={sections} faqs={faqs} note="Use generated dielines for design, panel planning, and visualization. Before production, validate final geometry, bleed, folds, tolerances, material behavior, and tooling requirements with the printer or structural packaging workflow responsible for manufacturing." afterHero={<TemplatePageLinks title="Generate a dieline for your box" />} /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
