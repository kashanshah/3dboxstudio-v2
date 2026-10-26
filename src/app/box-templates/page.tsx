import type { Metadata } from "next";
import Link from "next/link";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { TemplatePageLinks } from "@/components/template-page-links";
import { site, defaultOgImage } from "@/lib/site";
import { inactiveTemplateIds, listedTemplates } from "@/lib/packaging/template-catalog";
import { getPackagingTemplateCopy } from "@/lib/i18n/template-copy";
import { getTemplateCatalog } from "@/server/templates";

export const metadata: Metadata = {
  title: { absolute: "3D Box Templates & Packaging Structures | 3D Box Studio" },
  description: "Explore the template-based packaging approach in 3D Box Studio. Choose supported box structures, set finished dimensions, design the flat layout, and preview folding/opening behavior in 3D.",
  alternates: { canonical: "/box-templates", languages: { en: '/box-templates', es: '/es/box-templates', 'x-default': '/box-templates' } },
  openGraph: { images:[defaultOgImage], title: "3D Box Templates & Packaging Structures | 3D Box Studio", description: "Explore the template-based packaging approach in 3D Box Studio. Choose supported box structures, set finished dimensions, design the flat layout, and preview folding/opening behavior in 3D.", type: "website" }
};

const sections = [
  {
    "title": "Folding carton structures",
    "body": "Tuck end cartons close with tuck lids, top and bottom. The auto lock bottom box keeps the tuck top but has a pre-glued crash-lock bottom that locks itself when the carton is opened, for heavier products; the snap lock bottom box closes its four bottom flaps by hand, with no glue. The pillow box has two bowed faces and curved ends that close when pushed in, the gable box has a pitched roof with a carry handle over an auto-lock bottom, and the drawer box is a tray that slides out of a sleeve. The four-corner tray is an open tray with glued corners; with a second, larger tray as its lid it becomes a telescope box. The hexagon box is a six-sided base and lift-off lid, each glued into a tube and closed by a hexagon panel. The cake box is a one-piece bakery box whose corners lock without glue, with an optional window in its lid."
  },
  {
    "title": "Lid and box structures",
    "body": "Two-part or lid-based packaging needs different opening logic and panel relationships than a folding carton, so it is treated as its own structure type."
  },
  {
    "title": "Mailer-style packaging",
    "body": "The mailer box is the one-piece roll end tuck top mailer (FEFCO 0427): double side walls that lock into the base, and a lid that tucks in at the front. For plain shipping cartons, the split top box is a slotted shipper with four flaps at each end."
  },
  {
    "title": "Template-specific behavior",
    "body": "Dimensions, dieline geometry, panel mapping, folds, and opening behavior belong to each template so adding a new structure does not require changing the rules for every existing box."
  }
];
const FAQS = [
  {
    "question": "Which box templates are available?",
    // Filled in from the catalog: whatever is active now (Admin → Templates).
    "answer": ""
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

/** "a, b and c are ready now." */
function availableAnswer(names: string[]) {
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join("");
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${names.length === 1 ? "is" : "are"} ready now.`;
}

export default async function Page(){
  const catalog = await getTemplateCatalog();
  const hidden = inactiveTemplateIds(catalog);
  const names = listedTemplates(catalog).map(entry => getPackagingTemplateCopy(entry).name.toLowerCase());
  const faqs = FAQS.map(item => item.question === "Which box templates are available?" ? { ...item, answer: availableAnswer(names) } : item);
  const url=new URL("/box-templates",site.url).toString();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"WebPage",name:"Box templates built for real packaging structures.",description:"Explore the template-based packaging approach in 3D Box Studio. Choose supported box structures, set finished dimensions, design the flat layout, and preview folding/opening behavior in 3D.",url},
    {"@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}
  ]};
  const heroAside=<div className="template-hero-visual" aria-label="Illustration of several packaging structure templates">
    {!hidden.has("reverse-tuck-carton") && <Link className="template-hero-card" href="/box-templates/reverse-tuck-end-box"><strong>Reverse tuck end</strong><span>Folding carton</span><i/></Link>}
    {!hidden.has("pizza-box") && <Link className="template-hero-card" href="/box-templates/pizza-box"><strong>Pizza box</strong><span>Locking tray, hinged lid</span><i/></Link>}
    {!hidden.has("split-top-box") && <Link className="template-hero-card" href="/box-templates/split-top-box"><strong>Split top</strong><span>Slotted shipper</span><i/></Link>}
    {!hidden.has("hexagon-box") && <Link className="template-hero-note" href="/box-templates/hexagon-box">New: hexagon box with a lid</Link>}
  </div>;
  return <><MarketingProductPage alternates={{ es: '/es/box-templates' }} eyebrow="Box templates" title="Box templates built for real packaging structures." intro="Choose a supported structure, set its finished dimensions, design on its generated flat layout, and preview the package using that template's own geometry and opening behavior." secondaryHref="/studio" secondaryLabel="Open the template browser" sections={sections} faqs={faqs} heroAside={heroAside} afterHero={<TemplatePageLinks filters />} /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
