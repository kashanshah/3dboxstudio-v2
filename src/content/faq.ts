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
      "Yes. 3D Box Studio is a free 3D box maker and design tool that runs entirely in your browser. There is no paywall for dimensions, materials, openings, per-face artwork, HDRI lighting, PNG export, or JSON import/export. Create a free account to open the studio and start designing. Email verification is optional for now—you can save, share, and export right after signing up.",
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
      "While you work, your design stays in the browser session. When you upload face artwork, the studio auto-saves to the cloud as “Untitled” (rename anytime via File → Rename). Images upload to AWS S3 and configuration is stored in a Postgres database. You can also save manually with File → Save (⌘S).",
  },
  {
    id: "cloud-share",
    category: "export",
    question: "How do cloud save and share links work?",
    answer:
      "Uploading face artwork auto-saves your design to the cloud as “Untitled”. Use File → Rename to change the name. File → Save (⌘S) updates an existing project; File → Save As creates a copy with a new link. File → Open lets you paste a share link or ID to reload a saved design. After saving, use File → Share Preview Link or Copy Preview Link to send clients a separate view-only URL (<code>/preview/…</code>). Editor links use <code>/studio/…</code> and are not exposed in preview mode.",
  },
  {
    id: "view-only-preview",
    category: "export",
    question: "Can I send a view-only preview link to clients?",
    answer:
      "Yes. After you save a design to the cloud, use File → Share Preview Link or Copy Preview Link. The preview URL uses its own token and opens read-only mode: clients can orbit, zoom, adjust lighting, animate openings, and export PNGs, but cannot discover or use your editor link from that page.",
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
      "Yes. In the studio you can download a v1 JSON file that contains dimensions, materials, openings, viewport options, per-face rotations, and images as base64. Import that file on another machine or browser to restore the same preview—useful for offline backups alongside cloud share links.",
  },
  {
    id: "export-formats",
    category: "export",
    question: "What file formats can I export?",
    answer:
      "You can save designs to the cloud with editor and view-only preview links (File → Save / Save As), export a PNG snapshot of the 3D viewport for presentations and marketing, record a short MP4 video of the viewport, and download or import a full setup as JSON. There is no DXF, PDF die-line, or GLB export—the focus is fast visual preview.",
  },
  {
    id: "box-types",
    category: "overview",
    question: "What box types can I design?",
    answer:
      "3D Box Studio supports folding cartons and mailer-style boxes with configurable lid and flap openings. You can set custom dimensions in millimeters, centimeters, or inches and apply artwork to each face independently.",
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
      "For quick 3D box mockups and client previews, yes. Pacdora offers a large dieline template library, print-ready exports, and 4K campaign renders. 3D Box Studio is a free browser tool focused on interactive 3D simulation—custom dimensions, per-face artwork, material presets, and PNG export—without subscriptions or credits. Use Pacdora when you need production dielines; use 3D Box Studio when you need fast visual validation.",
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
      "Yes. Export a viewport PNG and use it in Amazon main images, A+ content, Shopify product pages, or social ads. The mockup helps you test angles and artwork before a photo shoot. For final listing photography, many sellers still use professional product photos—but 3D previews accelerate early listing setup and internal approvals.",
  },
  {
    id: "commercial-use",
    category: "getting-started",
    question: "Can I use exported mockups commercially?",
    answer:
      "Yes. PNG and MP4 exports from your own designs are yours to use in client work, marketing, e-commerce listings, and presentations. Always ensure your uploaded artwork and logos are properly licensed for commercial use.",
  },
  {
    id: "custom-dimensions",
    category: "technical",
    question: "Can I set custom box dimensions in millimeters, centimeters, or inches?",
    answer:
      "Yes. Enter any width, height, and depth in millimeters, centimeters, or inches. The 3D preview updates in real time so you can compare standard retail sizes, custom mailers, or shipper boxes without being locked to template dimensions.",
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
      "Yes. Create a free account to open the studio and start a new design. Email verification is optional for now—you can save, share, and export right after signing up. Shared project links and view-only previews remain available without an account.",
  },
  {
    id: "unboxing-video",
    category: "export",
    question: "Can I record an unboxing video or animation of my box mockup?",
    answer:
      "Yes. Use the viewport recording feature to capture a short MP4 of your 3D box—ideal for storyboarding unboxing videos, crowdfunding campaign clips, or social media teasers before physical samples exist.",
  },
  {
    id: "material-presets",
    category: "technical",
    question: "What packaging materials can I simulate?",
    answer:
      "Material presets include kraft board, white carton, gloss and matte plastic, corrugated cardboard, and metallic foil. Combined with HDRI studio lighting, these presets help you approximate how artwork reads on different substrates before print.",
  },
];

export function getCategoryLabel(id: FaqCategoryId): string {
  return FAQ_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const FAQ_PAGE_TITLE =
  "FAQ: Free 3D Box Designer, Packaging Mockups & Pacdora Alternative | 3D Box Studio";

export const FAQ_PAGE_DESCRIPTION =
  "Answers about 3D Box Studio—the free online 3D box maker and packaging mockup generator. Learn about carton simulation, custom dimensions, Pacdora alternatives, export formats, commercial use, privacy, and how we compare to packaging CAD tools.";
