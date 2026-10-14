import type { Metadata } from "next";
import { FeaturesHeroVideo } from "@/components/features-hero-video";
import { MarketingProductPage } from "@/components/marketing-product-page";
import { site, defaultOgImage } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "3D Box Studio Features — 2D Dieline Design, 3D Preview & Export",
  },
  description:
    "Explore 3D Box Studio features: packaging templates, custom dimensions, 2D dieline artwork, layers, live 3D preview, adjustable flap sizes, opening simulation, PNG and MP4 export, PDF, SVG and DXF dielines, saving and share links.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "3D Box Studio Features — 2D Dieline Design, 3D Preview & Export",
    description:
      "Explore 3D Box Studio features: packaging templates, custom dimensions, 2D dieline artwork, layers, live 3D preview, adjustable flap sizes, opening simulation, PNG and MP4 export, PDF, SVG and DXF dielines, saving and share links.",
    type: "website",
    url: "/features",
    images: [defaultOgImage],
  },
};

const sections = [
  {
    title: "Choose a real packaging structure",
    body: "Start from a supported box template instead of stretching one generic cube. The structure controls panel layout, geometry, and opening behavior.",
    bullets: [
      "Template-based geometry",
      "Finished dimensions and units",
      "Material and finish controls",
    ],
  },
  {
    title: "Change any flap or panel size",
    body: "Every template has its own adjustable sizes: tuck flaps, dust flaps, glue flaps, lid height, turn-ins and more. Type a size in the Sizes panel, click a size on the 3D box or the flat dieline and type over it, or drag a handle on the dieline. The cutting template, the 3D fold and the exports all follow.",
    bullets: [
      "Per-side flap and panel sizes",
      "Edit on the 3D box or the dieline",
      "Drag handles on the dieline",
      "Show sizes on or off",
    ],
  },
  {
    title: "Design on the flat layout",
    body: "Use the 2D dieline workspace for artwork placement. Upload graphics or add text, drag and drop them, crop, resize, rotate, and organize layers while keeping panel context visible.",
    bullets: [
      "Artwork upload and replace",
      "Text in 9 fonts, with colour, alignment and spacing",
      "Panel colours, snapping and align buttons",
      "Shapes, QR codes and EAN-13, UPC-A and Code 128 barcodes",
      "Layer ordering",
      "Exact transforms",
      "Outside/inside artwork where supported",
    ],
  },
  {
    title: "See every change in 3D",
    body: "The 3D preview uses the same design state, so edits can be checked from different angles without rebuilding a separate mockup.",
    bullets: [
      "Orbit and zoom",
      "Camera presets",
      "Panel-aware artwork",
      "Live 2D-to-3D sync",
    ],
  },
  {
    title: "Review how the box opens",
    body: "Use fold/open controls to inspect how the structure behaves rather than judging only a closed hero angle.",
    bullets: [
      "Open/close controls",
      "Animated fold from flat to closed",
      "Structure-specific motion",
      "Assembled and flatter review states",
    ],
  },
  {
    title: "Export, save, and share",
    body: "Download PNG or JPG images up to 4K on a transparent, studio or colour background, four standard product shots in one go, an MP4 of the box folding, turning or opening, the dieline as a 1:1 PDF with your artwork, or the cutting template as SVG or DXF. Save projects to your account, duplicate designs, and create view-only share links for review.",
    bullets: ["PNG and JPG up to 4K, plus product shots", "MP4 fold, turntable and open-close video", "1:1 PDF dieline with artwork", "SVG and DXF cutting templates", "Projects, duplicates and share links"],
  },
];
const faqs = [
  {
    question: "Is 3D Box Studio a CAD program?",
    answer:
      "No. It is a browser-based packaging design and visualization workspace. It can generate and use dielines for supported structures, but final manufacturing geometry and tolerances should still be validated in a production workflow.",
  },
  {
    question: "Does the Studio support custom box dimensions?",
    answer:
      "Yes. Supported templates can be resized using finished dimensions and selectable units.",
  },
  {
    question: "Can I upload my own graphics?",
    answer:
      "Yes. You can upload artwork and position it on the flat packaging layout with layer and transform controls.",
  },
  {
    question: "Can I save designs?",
    answer:
      "Yes. Account-based projects can be saved and reopened, and preview links can be shared for review.",
  },
  {
    question: "Can I prepare a flat-layout PDF?",
    answer:
      "Yes. The 2D Design workspace can prepare the current supported template layout for PDF output. Treat that output as part of the design/review workflow and validate production requirements before manufacturing.",
  },
  {
    question: "Can I download the dieline as SVG or DXF?",
    answer:
      "Yes. Preview & Download saves the cutting template at 1:1 in millimetres as an SVG or a DXF, with cut and crease lines on separate layers, for die makers, CAD programs and cutting tables.",
  },
  {
    question: "Does 3D Box Studio work entirely in the browser?",
    answer:
      "Yes. The V2 workflow runs in a modern browser; no desktop application is required.",
  },
];

export default function Page() {
  const url = new URL("/features", site.url).toString();
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "A packaging design workspace that connects the dieline to the 3D box.",
        description:
          "Explore 3D Box Studio features: packaging templates, custom dimensions, 2D dieline artwork, layers, live 3D preview, adjustable flap sizes, opening simulation, PNG and MP4 export, PDF, SVG and DXF dielines, saving and share links.",
        url,
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
  return (
    <>
      <MarketingProductPage
        eyebrow="Product features"
        title="A packaging design workspace that connects the dieline to the 3D box."
        intro="3D Box Studio brings structure, dimensions, artwork editing, 3D review, export, saving, and sharing into one browser workflow. It is built for fast visual packaging decisions without requiring a heavyweight desktop install."
        secondaryHref="/box-templates"
        secondaryLabel="Explore box templates"
        sections={sections}
        faqs={faqs}
        heroAside={<FeaturesHeroVideo />}
        scrollHero
        showStudioProof={false}
        heroSecondary={{
          eyebrow: "See your packaging take shape",
          title: "From a flat dieline to a 3D box.",
          body: "Design your artwork on the flat layout, then review the same packaging in 3D. Explore how the panels fold, how the box opens and closes, and how your artwork looks across each face before exporting or sharing your design.",
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </>
  );
}
