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

export const LANDING_FAQ_PREVIEW_COUNT = 12;

export function getLandingFaqItems(): FaqItem[] {
  return FAQ_ITEMS.slice(0, LANDING_FAQ_PREVIEW_COUNT);
}

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
      "A 3D box designer combines packaging structure, dimensions, artwork, and a three-dimensional preview so you can judge proportions, panel relationships, openings, materials, and branding before production. 3D Box Studio adds a 2D flat-layout workspace so the design and the 3D proof stay connected.",
  },
  {
    id: "free-3d-box-maker",
    category: "getting-started",
    question: "Is 3D Box Studio a free 3D box maker?",
    answer:
      "Yes. 3D Box Studio is free to start in the browser. Create a free account to access the Studio, choose supported packaging templates, set dimensions, add artwork, review the package in 3D, save projects, share previews, and export PNGs.",
  },
  {
    id: "3d-box-simulation-use",
    category: "overview",
    question: "What is 3D box simulation used for?",
    answer:
      "3D box simulation helps packaging designers, brand teams, agencies, sellers, and print shops validate proportions, graphic placement, panel hierarchy, materials, and opening behavior before committing to a physical sample or final print workflow.",
  },
  {
    id: "vs-esko-artioscad",
    category: "comparison",
    question: "Is this a substitute for Esko, ArtiosCAD, or dedicated packaging CAD?",
    answer:
      "No. 3D Box Studio is designed for packaging design, visualization, and review. Dedicated structural CAD tools handle production engineering, manufacturing tolerances, tooling, and other production requirements that still need specialist validation.",
  },
  {
    id: "vs-mockup-templates",
    category: "comparison",
    question: "How is a 3D box design maker different from a mockup template site?",
    answer:
      "A static mockup template usually locks you to one perspective and one set of proportions. 3D Box Studio lets supported structures use editable finished dimensions, a 2D artwork layout, panel-aware graphics, materials, opening behavior, and an interactive 3D camera.",
  },
  {
    id: "mobile-support",
    category: "technical",
    question: "Does the 3D box simulator work on mobile?",
    answer:
      "The website and project library are responsive, while the full Studio is most comfortable on a larger screen because packaging artwork and 3D controls need space. Mobile and tablet behavior is being improved, but desktop remains the best environment for detailed editing.",
  },
  {
    id: "data-storage",
    category: "privacy",
    question: "Where are my designs and artwork stored?",
    answer:
      "Signed-in V2 projects are stored with your account so designs can be reopened later. Uploaded media used by projects is stored in the product's cloud media workflow. Treat any confidential customer artwork according to your own organization's data-handling requirements.",
  },
  {
    id: "cloud-share",
    category: "export",
    question: "How do save and share links work?",
    answer:
      "Save keeps the editable project in your account. You can reopen saved designs from the project library and create a separate shareable preview link for review without giving the recipient the editable Studio project.",
  },
  {
    id: "view-only-preview",
    category: "export",
    question: "Can I send a view-only preview link to clients?",
    answer:
      "Yes. Saved designs can create preview links intended for review. The preview is separate from the editable Studio workflow so a client or teammate can inspect the package without working inside your design file.",
  },
  {
    id: "color-accuracy",
    category: "technical",
    question: "Will on-screen colors match my print run?",
    answer:
      "No screen preview can guarantee press color. Browser previews are RGB and depend on display calibration, materials, lighting, inks, paper, coating, and the printer's process. Use the Studio for visual review, then validate final color through the printer's proofing workflow.",
  },
  {
    id: "project-files",
    category: "export",
    question: "Can I move a design between browsers or computers?",
    answer:
      "Yes, by saving the design to your account and reopening it after signing in elsewhere. V2 is centered on persistent cloud projects rather than requiring a downloadable JSON project file for normal continuity.",
  },
  {
    id: "export-formats",
    category: "export",
    question: "What file formats can I export?",
    answer:
      "The 3D workspace exports PNG previews. The 2D Design workspace can prepare the current flat layout for PDF output. Scene/video output is not part of the current launch scope. Generated layout output should still be validated before manufacturing.",
  },
  {
    id: "box-types",
    category: "overview",
    question: "What box types can I design?",
    answer:
      "3D Box Studio uses a growing template library rather than one hard-coded box. Supported structures include folding-carton and other packaging templates as they become engine-ready. Open the current template browser to see which structures are available now; planned structures are clearly marked rather than counted as usable.",
  },
  {
    id: "who-is-it-for",
    category: "getting-started",
    question: "Who is 3D Box Studio for?",
    answer:
      "It is useful for packaging designers, freelancers, agencies, brand teams, e-commerce sellers, small businesses, and print shops that need a fast visual packaging workflow before a physical sample or production proof exists.",
  },
  {
    id: "vs-pacdora",
    category: "comparison",
    question: "Is 3D Box Studio a free Pacdora alternative?",
    answer:
      "It can be an alternative for focused box-design work: supported structures, editable dimensions, flat-layout artwork, interactive 3D review, saving, sharing, and PNG export. Pacdora has a broader mature packaging ecosystem, so compare the specific feature you need rather than assuming one-to-one parity.",
  },
  {
    id: "download-required",
    category: "getting-started",
    question: "Do I need to download software to use this online box mockup generator?",
    answer:
      "No. 3D Box Studio runs in a modern browser. A current version of Chrome, Edge, Firefox, or Safari and hardware-accelerated WebGL support are recommended for the smoothest 3D experience.",
  },
  {
    id: "amazon-listing-use",
    category: "overview",
    question: "Can I use 3D box mockups for Amazon or Shopify product listings?",
    answer:
      "You can use exported PNG previews in concept work, internal approvals, presentations, and listing-planning workflows. Before publishing a marketplace image, verify that the final render meets that marketplace's current image and content rules.",
  },
  {
    id: "commercial-use",
    category: "getting-started",
    question: "Can I use exported mockups commercially?",
    answer:
      "Yes, you can use exports created from your own designs for client work, presentations, marketing, and e-commerce planning, provided you have the rights to the artwork, logos, fonts, and other assets you upload.",
  },
  {
    id: "custom-dimensions",
    category: "technical",
    question: "Can I set custom box dimensions in millimeters or inches?",
    answer:
      "Yes. Supported templates use editable finished width, height, and depth, and the current Studio supports millimeters and inches. The 2D layout and 3D structure update from the same template dimensions.",
  },
  {
    id: "folding-carton-explainer",
    category: "overview",
    question: "What is a folding carton and can I mock one up in 3D?",
    answer:
      "A folding carton is a paperboard package formed from a flat sheet, commonly used for retail products, cosmetics, food, supplements, and many consumer goods. Supported carton templates can be designed on the flat layout and reviewed as an assembled 3D package.",
  },
  {
    id: "dieline-vs-mockup",
    category: "comparison",
    question: "What is the difference between a dieline and a 3D box mockup?",
    answer:
      "A dieline is the flat structural layout of the package. A 3D box mockup shows how that structure looks when assembled with artwork and materials. In 3D Box Studio, supported templates connect those two views, but final production geometry still needs printer or structural validation.",
  },
  {
    id: "tuck-end-box",
    category: "technical",
    question: "Can I preview tuck-end boxes and retail cartons?",
    answer:
      "Yes, when the structure is available as a supported template. You can set its finished size, design the flat layout, inspect panel artwork in 3D, and review its template-specific folding or opening behavior.",
  },
  {
    id: "account-required",
    category: "getting-started",
    question: "Do I need an account to use 3D Box Studio?",
    answer:
      "Yes. The V2 Studio uses accounts so projects, artwork, saving, reopening, and sharing can work consistently across sessions. Shared preview links can be opened separately for review.",
  },
  {
    id: "video-export",
    category: "export",
    question: "Can I record an unboxing video or export an MP4?",
    answer:
      "Not in the current V2 launch scope. The Studio can animate supported structures open and closed interactively, but video or Scene Studio output should not be treated as a launched export feature yet.",
  },
  {
    id: "material-presets",
    category: "technical",
    question: "What packaging materials and finishes can I preview?",
    answer:
      "The current Studio includes visual presets such as white board, kraft, soft touch, matte coated, gloss coated, and foil, plus outside and inside color controls. These are visualization aids rather than physical print or substrate proofs.",
  },
  {
    id: "generated-dieline",
    category: "technical",
    question: "Can 3D Box Studio generate a dieline from a box template and dimensions?",
    answer:
      "For supported structures, the Studio uses the template geometry and finished dimensions to create the flat layout used for artwork and visualization. This is generated from 3D Box Studio's own supported structures; external dieline importing is not part of the current product.",
  },
  {
    id: "production-ready-dieline",
    category: "comparison",
    question: "Is a generated 3D Box Studio dieline production-ready?",
    answer:
      "Do not assume that it is. Dimensional and production accuracy is still being improved. Before manufacturing, validate bleed, board caliper, folds, cut tolerances, glue areas, tooling, grain direction where relevant, and printer-specific requirements.",
  },
];

export function getCategoryLabel(id: FaqCategoryId): string {
  return FAQ_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const FAQ_PAGE_TITLE =
  "FAQ: Free 3D Box Designer, Dielines, Packaging Mockups & Pacdora Alternative | 3D Box Studio";

export const FAQ_PAGE_DESCRIPTION =
  "Answers about 3D Box Studio: supported box templates, dimensions, generated dielines, artwork, 3D previews, materials, save/share, PNG and PDF output, commercial use, browser support, and CAD comparisons.";
