export type FaqCategoryId =
  | "overview"
  | "getting-started"
  | "comparison"
  | "export"
  | "privacy"
  | "technical";

export type FaqItem = {
  id: string;
  category: FaqCategoryId;
  question: string;
  answer: string;
};

export const FAQ_CATEGORIES: { id: FaqCategoryId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "getting-started", label: "Getting started" },
  { id: "comparison", label: "vs CAD tools" },
  { id: "export", label: "Export & files" },
  { id: "privacy", label: "Privacy & data" },
  { id: "technical", label: "Technical" },
];

/** FAQs shown on the landing page preview (must match JSON-LD on homepage). */
export const LANDING_FAQ_PREVIEW_COUNT = 8;

export function getLandingFaqItems(): FaqItem[] {
  return FAQ_ITEMS.slice(0, LANDING_FAQ_PREVIEW_COUNT);
}

/** Plain text for FAQ schema (strips HTML markup from answers). */
export function faqAnswerPlainText(answer: string): string {
  return answer
    .replace(/<code>(.*?)<\/code>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-3d-box-designer",
    category: "overview",
    question: "What is a 3D box designer or packaging simulator?",
    answer:
      "A 3D box designer lets you preview how flat packaging artwork and structural choices look on a three-dimensional carton or mailer. A packaging simulator applies realistic lighting and materials so stakeholders can review proportions, openings, and branding before print.",
  },
  {
    id: "free-3d-box-maker",
    category: "getting-started",
    question: "Is 3D Box Studio a free 3D box maker?",
    answer:
      "Yes. The current 3D Box Studio preview runs in your browser and can be opened without an account. You can explore packaging templates, adjust dimensions, place artwork, open and close the structure, rotate the 3D view, and export a PNG preview. Accounts and persistent cloud projects are planned, but they are not required in the current V2 Studio.",
  },
  {
    id: "3d-box-simulation-use",
    category: "overview",
    question: "What is 3D box simulation used for?",
    answer:
      "3D box simulation helps packaging designers, brand teams, and printers validate scale, graphic placement, and opening behavior before committing to plates or physical samples. It is ideal for client presentations, e-commerce mockups, and internal design reviews—not for engineering production die-lines.",
  },
  {
    id: "vs-esko-artioscad",
    category: "comparison",
    question: "Is this a substitute for Esko, ArtiosCAD, or dedicated packaging CAD?",
    answer:
      "No. Those platforms engineer production die-lines. This 3D packaging simulator helps you communicate look and feel, camera angles, and rough scale early. Export is a viewport PNG, not a print plate.",
  },
  {
    id: "vs-mockup-templates",
    category: "comparison",
    question: "How is a 3D box design maker different from a mockup template site?",
    answer:
      "Template libraries give you fixed box shapes with uploaded artwork. A 3D box design maker like 3D Box Studio lets you adjust width, height, depth, materials, lid and flap openings, and per-face graphics in one interactive viewport—better for custom carton sizes and structural previews.",
  },
  {
    id: "mobile-support",
    category: "technical",
    question: "Does the 3D box simulator work on mobile?",
    answer:
      "The studio is built for desktop browsers with WebGL. Phones may run it, but the control density is optimized for keyboard and mouse users.",
  },
  {
    id: "data-storage",
    category: "privacy",
    question: "Where is my data stored?",
    answer:
      "In the current V2 Studio, design state and uploaded artwork stay in your browser session. The local Artwork Library lets you reuse an uploaded image across multiple surfaces during that session. Persistent accounts, project storage, and cloud media storage are planned for a later milestone.",
  },
  {
    id: "cloud-share",
    category: "export",
    question: "How do cloud save and share links work?",
    answer:
      "Cloud save and share links are not available in the current V2 Studio yet. The present version is focused on the core packaging workflow: template selection, dimensions, artwork, folding, 3D inspection, and PNG export. Persistent projects and shareable review links are planned for a later release.",
  },
  {
    id: "view-only-preview",
    category: "export",
    question: "Can I send a view-only preview link to clients?",
    answer:
      "Not yet in V2. A dedicated view-only review link is planned, but the current Studio does not generate client share links. You can export a PNG of the current 3D view for review today.",
  },
  {
    id: "color-accuracy",
    category: "technical",
    question: "Will on-screen colors match my print run?",
    answer:
      "Screen previews are RGB and depend on your display calibration. This tool is for structural and graphic composition—not ink drawdowns or press proofs. Always validate color with your printer's proofing process.",
  },
  {
    id: "json-export-import",
    category: "export",
    question: "Can I export or import my 3D box design as JSON?",
    answer:
      "Not yet in V2. Project serialization is part of the planned persistent-project workflow. The current Studio keeps its design state in the browser session and supports PNG export from the 3D view.",
  },
  {
    id: "export-formats",
    category: "export",
    question: "What file formats can I export?",
    answer:
      "PNG export from the current 3D view is available now. Animation, share links, project files, and production-oriented PDF, SVG, and DXF exports are planned and are shown as upcoming features rather than active controls.",
  },
  {
    id: "box-types",
    category: "overview",
    question: "What box types can I design?",
    answer:
      "The first engine-ready structure is a reverse-tuck folding carton with editable dimensions, outside and inside artwork surfaces, and a full open-to-closed fold simulation. The Structure catalog already includes additional cartons, mailers, rigid boxes, bottles, jars, pouches, cups, and cans as planned templates that will become usable as their real geometry is implemented.",
  },
  {
    id: "who-is-it-for",
    category: "getting-started",
    question: "Who is 3D Box Studio for?",
    answer:
      "Graphic designers, packaging freelancers, brand managers, and print shops who need a quick 3D box preview without installing CAD software. It complements—not replaces—structural engineering tools when you need production-ready die-lines.",
  },
  {
    id: "vs-pacdora",
    category: "comparison",
    question: "Is 3D Box Studio a free Pacdora alternative?",
    answer:
      "3D Box Studio is being built as a browser-based packaging design alternative focused on an intuitive 2D/3D workflow. Pacdora currently has a much larger template library and mature production/export tooling. V2 already supports a real foldable reverse-tuck carton, custom dimensions, reusable artwork, inside/outside surfaces, camera controls, and PNG export; more templates and production workflows are being added progressively.",
  },
  {
    id: "download-required",
    category: "getting-started",
    question: "Do I need to download software to use this online box mockup generator?",
    answer:
      "No. 3D Box Studio is a browser-based online box mockup generator. Open the studio in Chrome, Firefox, Safari, or Edge—no install, plugin, or desktop license required. WebGL support is recommended for smooth 3D rendering.",
  },
  {
    id: "amazon-listing-use",
    category: "overview",
    question: "Can I use 3D box mockups for Amazon or Shopify product listings?",
    answer:
      "You can export a PNG preview for presentations, internal review, or early e-commerce layout work. Whether a render meets a marketplace's final image requirements depends on that marketplace and the quality of the final scene, so verify the applicable listing rules before publishing.",
  },
  {
    id: "commercial-use",
    category: "getting-started",
    question: "Can I use exported mockups commercially?",
    answer:
      "PNG exports created from your own designs can be used in client work, presentations, and marketing, provided you have the rights to the artwork, logos, and other assets you upload. MP4 export is planned but is not part of the current V2 Studio.",
  },
  {
    id: "custom-dimensions",
    category: "technical",
    question: "Can I set custom box dimensions in millimeters, centimeters, or inches?",
    answer:
      "Yes. The current reverse-tuck template lets you edit width, height, depth, and board thickness in millimeters, and the 3D structure updates from the same dimensions. Additional unit systems can be added later through the template parameter layer.",
  },
  {
    id: "folding-carton-explainer",
    category: "overview",
    question: "What is a folding carton and can I mock one up in 3D?",
    answer:
      "A folding carton is a paperboard box folded from a single sheet—common for retail products, cosmetics, food, and supplements. 3D Box Studio simulates folding cartons and mailer-style boxes with configurable lid and flap openings so you can preview artwork, proportions, and shelf presence before print.",
  },
  {
    id: "dieline-vs-mockup",
    category: "comparison",
    question: "What is the difference between a dieline and a 3D box mockup?",
    answer:
      "A dieline is a flat production file with cut, crease, and bleed lines for the printer—it defines manufacturing geometry. A 3D box mockup is a visual preview showing how finished packaging looks with artwork, materials, and lighting. Use dieline tools (Pacdora, ArtiosCAD, Templatemaker) for print plates; use a 3D mockup tool for client presentations, e-commerce visuals, and design reviews.",
  },
  {
    id: "tuck-end-box",
    category: "technical",
    question: "Can I preview tuck end boxes and retail cartons?",
    answer:
      "Yes. Set retail carton dimensions and upload artwork to each face to simulate tuck end and folding carton proportions. The tool focuses on visual scale and graphic placement—not engineering every glue tab or tuck flap for production.",
  },
  {
    id: "account-required",
    category: "getting-started",
    question: "Do I need an account to use 3D Box Studio?",
    answer:
      "No account is required for the current V2 Studio preview. Designs currently live in the browser session. Accounts will become useful when persistent projects, cloud media libraries, and collaboration are introduced.",
  },
  {
    id: "unboxing-video",
    category: "export",
    question: "Can I record an unboxing video or animation of my box mockup?",
    answer:
      "Not yet in V2. The fold engine can already animate the structure between open and closed states in the browser, but MP4/video export is planned for a later export milestone.",
  },
  {
    id: "material-presets",
    category: "technical",
    question: "What packaging materials can I simulate?",
    answer:
      "The current Studio includes simple visual finish presets such as white board, kraft, soft touch, matte coated, gloss coated, and foil. More physically detailed controls for roughness, reflectivity, lighting, transparency, and premium finishes will be added as those rendering controls become functional.",
  },
];

export function getCategoryLabel(id: FaqCategoryId): string {
  return FAQ_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const FAQ_PAGE_TITLE =
  "FAQ: Free 3D Box Designer, Packaging Mockups & Pacdora Alternative | 3D Box Studio";

export const FAQ_PAGE_DESCRIPTION =
  "Answers about 3D Box Studio—the free online 3D box maker and packaging mockup generator. Learn about carton simulation, custom dimensions, Pacdora alternatives, export formats, commercial use, privacy, and how we compare to packaging CAD tools.";
