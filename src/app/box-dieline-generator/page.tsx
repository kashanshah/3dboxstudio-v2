import type { Metadata } from "next";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { TemplatePageLinks } from "@/components/template-page-links";
import { site, defaultOgImage } from "@/lib/site";
import { DielineGenerator } from "@/components/dieline-generator/dieline-generator";
import { generatorSetup } from "@/lib/dieline/thumbnails";
import { breadcrumbSchema } from "@/lib/seo";
import { MoreTools } from "@/components/seo/more-tools";

export const metadata: Metadata = {
  title: { absolute: "Free Box Dieline Generator: SVG, PDF, DXF | 3D Box Studio" },
  description: "Draw a box dieline to your size in 16 styles and download it free as SVG, PDF, DXF, PNG or a Cricut file. No sign-up, no watermark. Then fold it in 3D.",
  alternates: { canonical: "/box-dieline-generator", languages: { en: '/box-dieline-generator', es: '/es/box-dieline-generator', 'x-default': '/box-dieline-generator' } },
  openGraph: { images:[defaultOgImage], title: "Free Box Dieline Generator: SVG, PDF, DXF | 3D Box Studio", description: "Draw a box dieline to your size in 16 styles and download it free as SVG, PDF, DXF, PNG or a Cricut file. No sign-up, no watermark. Then fold it in 3D.", type: "website" }
};

const sections = [
  {
    "title": "Free, with no account",
    "body": "The generator above runs in your browser. Pick a style, type the length, width and depth in millimetres or inches, choose whether they are the inside, the outside or crease to crease, and pick your board. The dieline redraws as you type, with cut, crease, glue, bleed and safe-zone lines. Downloads need no sign-up, carry no watermark and have no limit.",
    "bullets": [
      "16 styles: tuck end, snap lock and auto lock bottom cartons, mailer (FEFCO 0427), shipping carton (FEFCO 0201), pillow, gable, sleeve, pizza, drawer, tray, telescope, hexagon, cake and rigid boxes",
      "Inside, outside or manufacture sizes, with board thickness worked in",
      "SVG, PDF (one page or tiled on A4 or Letter), DXF, PNG and a Cricut or Silhouette file",
      "A link that reopens the same box, to send to a printer or a colleague"
    ]
  },
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
    "title": "Download it as PDF, SVG or DXF",
    "body": "Export the dieline at 1:1 in millimetres. The PDF carries your artwork, bleed and cut and crease lines for the printer. The SVG and DXF carry the cutting template on its own, with cut lines and crease lines on separate layers, for die makers, CAD programs and cutting tables.",
    "bullets": [
      "1:1 vector PDF with artwork and bleed",
      "SVG for Illustrator, Inkscape and Affinity",
      "DXF R12 in millimetres for CAD and cutting tables",
      "Separate CUT and CREASE layers"
    ]
  },
  {
    "title": "Validate before manufacturing",
    "body": "Use the generated layout for design and visualization, then verify final production details with your printer or structural packaging specialist before plates, tooling, or manufacturing."
  }
];
const faqs = [
  {
    "question": "Is the dieline generator free? Do I need an account?",
    "answer": "It is free, and downloading needs no account: SVG, PDF, DXF, PNG and Cricut files download straight from this page, without a watermark or a limit. A free account is only needed to open the box in 3D Box Studio, where you add artwork and fold it in 3D."
  },
  {
    "question": "Can I cut the dieline on a Cricut or Silhouette?",
    "answer": "Yes. Download the Cricut / Silhouette file: an SVG sized in inches with only the cut lines (black) and score lines (blue). In Design Space, set the blue lines to Score. Silhouette Studio Basic can't open SVG, so use the DXF there. A 12 × 24 in mat cuts boxes up to about 292 × 597 mm flat; the generator tells you whether yours fits."
  },
  {
    "question": "Can 3D Box Studio generate a dieline from dimensions?",
    "answer": "For supported structures, yes. The Studio can create the flat layout from the selected template and finished dimensions."
  },
  {
    "question": "Is the generated dieline press-ready?",
    "answer": "It is a 1:1 cutting template drawn from your inside size and board thickness, ready for proofs, samples and quotes. Each factory has its own board, crease rules and tooling, so have your printer confirm the final die before production."
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
    "answer": "Yes. Preview & Download exports a 1:1 vector PDF with your artwork, adjustable bleed, and cut and crease lines. Have your printer review it against their structural requirements before production."
  },
  {
    "question": "Can I download the dieline as SVG or DXF?",
    "answer": "Yes, for every box template and for free. The SVG and DXF contain the cutting template at 1:1 in millimetres, with cut lines on a CUT layer and crease lines on a CREASE layer, ready for Illustrator, CAD programs, die makers and cutting tables."
  }
];

export default function Page(){
  const url=new URL("/box-dieline-generator",site.url).toString();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"WebPage",name:"Free box dieline generator: draw it to size, download it, fold it in 3D.",description:"Draw a box dieline to your size in 16 styles and download it free as SVG, PDF, DXF, PNG or a Cricut file. No sign-up, no watermark. Then fold it in 3D.",url},
    {"@type":"SoftwareApplication",name:"Box dieline generator",applicationCategory:"DesignApplication",operatingSystem:"Any (runs in the browser)",url,offers:{"@type":"Offer",price:"0",priceCurrency:"USD"},featureList:["16 box styles","Inside, outside and manufacture sizes","SVG, PDF, DXF and PNG downloads","Cricut and Silhouette cut files","Tiled PDF for home printers","No sign-up"]},
    breadcrumbSchema([{name:"Box dieline generator",path:"/box-dieline-generator"}]),
    {"@type":"FAQPage",mainEntity:faqs.map(item=>({"@type":"Question",name:item.question,acceptedAnswer:{"@type":"Answer",text:item.answer}}))}
  ]};
  return <><MarketingProductPage alternates={{ es: '/es/box-dieline-generator' }} breadcrumbs={[{name:"Box dieline generator",path:"/box-dieline-generator"}]} about eyebrow="Box dieline generator" title="Free box dieline generator: draw it to size, download it, fold it in 3D." intro="Pick a box style, type your size, and download the dieline as SVG, PDF, DXF, PNG or a Cricut file. Free, with no account, no watermark and no limits." secondaryHref="/blog/how-to-generate-box-dieline-online" secondaryLabel="Read the dieline guide" sections={sections} faqs={faqs} note="Use generated dielines for design, panel planning, and visualization. Before production, validate final geometry, bleed, folds, tolerances, material behavior, and tooling requirements with the printer or structural packaging workflow responsible for manufacturing." afterHero={<><DielineGenerator setup={generatorSetup("reverse-tuck-end")} title="Choose a style and size" className="dg-in-mpp" page={{type:"dieline_generator",slug:"box-dieline-generator"}} /><MoreTools /><TemplatePageLinks title="Templates with guides for each box" /></>} /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
