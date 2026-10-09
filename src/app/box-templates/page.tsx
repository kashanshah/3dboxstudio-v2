import type { Metadata } from "next";
import Link from "next/link";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { TemplatePageLinks } from "@/components/template-page-links";
import { site, defaultOgImage } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "3D Box Templates & Packaging Structures | 3D Box Studio" },
  description: "Explore the template-based packaging approach in 3D Box Studio. Choose supported box structures, set finished dimensions, design the flat layout, and preview folding/opening behavior in 3D.",
  alternates: { canonical: "/box-templates" },
  openGraph: { images:[defaultOgImage], title: "3D Box Templates & Packaging Structures | 3D Box Studio", description: "Explore the template-based packaging approach in 3D Box Studio. Choose supported box structures, set finished dimensions, design the flat layout, and preview folding/opening behavior in 3D.", type: "website" }
};

const sections = [
  {
    "title": "Folding carton structures",
    "body": "Tuck-style carton structures can define front, back, side, top, bottom, flap, and glue-related geometry for a packaging-specific workflow."
  },
  {
    "title": "Lid and box structures",
    "body": "Two-part or lid-based packaging needs different opening logic and panel relationships than a folding carton, so it is treated as its own structure type."
  },
  {
    "title": "Mailer-style packaging",
    "body": "A mailer template is planned, with its own panel layout and folding behavior. Until then, the split top box covers corrugated shippers: a slotted shipping box with four flaps at each end."
  },
  {
    "title": "Template-specific behavior",
    "body": "Dimensions, dieline geometry, panel mapping, folds, and opening behavior belong to each template so adding a new structure does not require changing the rules for every existing box."
  }
];
const faqs = [
  {
    "question": "Which box templates are available?",
    "answer": "Reverse tuck end carton, straight tuck end box, pizza box and split top box are ready now. Mailer, sleeve, rigid lid and base, and drawer boxes are planned."
  },
  {
    "question": "Can I resize a template?",
    "answer": "Yes, supported templates can use editable finished dimensions."
  },
  {
    "question": "Do all templates open the same way?",
    "answer": "No. Opening and folding behavior is structure-specific."
  },
  {
    "question": "Can new structures be added later?",
    "answer": "Yes. The template architecture is designed so new structures can define their own geometry and behavior without hard-coding the entire Studio around one dieline."
  },
  {
    "question": "Can template dimensions be changed after artwork is added?",
    "answer": "Yes. Supported structures are dimension-driven, although major size changes can affect artwork placement and should be reviewed again in both 2D and 3D."
  },
  {
    "question": "Does each template have its own dieline?",
    "answer": "Each supported template defines the flat panel layout and geometry used by the Design workspace. The layout is generated from the Studio's own template rather than imported from an external dieline file."
  }
];

export default function Page(){
  const url=new URL("/box-templates",site.url).toString();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"WebPage",name:"Box templates built for real packaging structures.",description:"Explore the template-based packaging approach in 3D Box Studio. Choose supported box structures, set finished dimensions, design the flat layout, and preview folding/opening behavior in 3D.",url},
    {"@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}
  ]};
  const heroAside=<div className="template-hero-visual" aria-label="Illustration of several packaging structure templates">
    <Link className="template-hero-card" href="/box-templates/reverse-tuck-end-box"><strong>Reverse tuck end</strong><span>Folding carton</span><i/></Link>
    <Link className="template-hero-card" href="/box-templates/pizza-box"><strong>Pizza box</strong><span>Locking tray, hinged lid</span><i/></Link>
    <Link className="template-hero-card" href="/box-templates/split-top-box"><strong>Split top</strong><span>Slotted shipper</span><i/></Link>
    <div className="template-hero-note">Mailer and sleeve boxes are planned</div>
  </div>;
  return <><MarketingProductPage eyebrow="Box templates" title="Box templates built for real packaging structures." intro="Choose a supported structure, set its finished dimensions, design on its generated flat layout, and preview the package using that template's own geometry and opening behavior." secondaryHref="/studio" secondaryLabel="Open the template browser" sections={sections} faqs={faqs} heroAside={heroAside} afterHero={<TemplatePageLinks />} /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
