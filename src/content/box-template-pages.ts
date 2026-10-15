import type { PreviewTemplateId } from '@/lib/packaging/template-preview';

// Public landing pages for each ready Studio template (/box-templates/<slug>).
// Every claim here must match what the template geometry actually draws.

export type BoxTemplatePreset = { label: string; note: string; width: number; height: number; depth: number; unit: 'mm' | 'in' };
export type BoxTemplateSection = { title: string; body: string; bullets?: string[] };

export type BoxTemplatePage = {
  slug: string;
  templateId: PreviewTemplateId;
  name: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  /** Field labels in the size picker, in the order width, height, depth. */
  fields: { width: string; height: string; depth: string };
  presets: BoxTemplatePreset[];
  geometryNote: string;
  sections: BoxTemplateSection[];
  faqs: { question: string; answer: string }[];
  guides: string[];
  /** Gallery filters; the first is shown on the card. */
  tags: string[];
  updated: string;
};

export const BOX_TEMPLATE_PAGES: BoxTemplatePage[] = [
  {
    slug: 'reverse-tuck-end-box',
    templateId: 'reverse-tuck-carton',
    name: 'Reverse tuck end box',
    title: 'Reverse Tuck End Box Template & Dieline (Free) | 3D Box Studio',
    description: 'Free reverse tuck end box template. Enter your size to draw the dieline with tuck flaps, dust flaps and glue flap, then design it and fold it in 3D.',
    eyebrow: 'Box template',
    h1: 'Reverse tuck end box template',
    intro: 'Enter the finished size of your carton and the dieline below redraws instantly: front, back and side panels, a tapered glue flap, tuck tongues and dust flaps. Open it in the Studio to place artwork on the flat layout, fold it in 3D and export a 1:1 PDF dieline.',
    fields: { width: 'Width (front)', height: 'Height', depth: 'Depth (side)' },
    presets: [
      { label: 'Lip balm / small tube', note: 'Narrow cosmetic carton', width: 30, height: 80, depth: 25, unit: 'mm' },
      { label: 'Perfume 50 ml', note: 'Tall square carton', width: 55, height: 120, depth: 55, unit: 'mm' },
      { label: 'Supplement bottle', note: 'Square bottle carton', width: 70, height: 130, depth: 70, unit: 'mm' },
      { label: 'Tea or food carton', note: 'Flat retail carton', width: 120, height: 180, depth: 55, unit: 'mm' },
      { label: 'Soap bar', note: 'Low, wide carton', width: 95, height: 40, depth: 65, unit: 'mm' },
    ],
    geometryNote: 'Cutting template: tuck tongues with slit locks, shouldered dust flaps, the glue flap and a thumb notch are added for you. Width, depth and height are inside sizes; panels are creased one board thickness wider. Ask your printer to confirm the allowances for their board.',
    sections: [
      {
        title: 'What is a reverse tuck end box?',
        body: 'A reverse tuck end (RTE) box is the most common folding carton for cosmetics, supplements, food and small retail products. It is cut from one sheet of paperboard, glued along one side seam, and shipped flat. The top closure panel and the bottom closure panel hinge from opposite faces, so the top tucks in from the front and the bottom tucks in from the back.',
      },
      {
        title: 'What is on the dieline',
        body: 'The template draws every panel of a standard RTE carton from your three measurements.',
        bullets: [
          'Four body panels: front, side, back, side, in one strip.',
          'A glue flap with 15° tapered ends, glued to the inside of the back panel.',
          'Top and bottom closure panels on opposite faces, each with a rounded tuck tongue and slit locks.',
          'Four shouldered dust flaps that fold in under the closure panels and catch the tucks.',
          'A thumb notch where the top tuck slides in, so the carton opens easily.',
          'Cut lines and crease lines kept separate, as in the PDF export.',
        ],
      },
      {
        title: 'Reverse tuck vs straight tuck',
        body: 'In a straight tuck end (STE) box both closures hinge from the same face. In 3D Box Studio that is the front, so both lids fold over from the front edge and tuck in at the back. A reverse tuck end box puts the closures on opposite faces. That layout nests better on the press sheet, so it usually costs less to print, and it is the default choice unless the design needs a clean front edge. 3D Box Studio supports both: see the [straight tuck end box](/box-templates/straight-tuck-end-box) template for closures on the same face.',
      },
      {
        title: 'How to measure for a tuck end box',
        body: 'Measure the product, then add a few millimetres of clearance on each side so it slides in easily. Width is the front face, depth is the side face and height runs between the two closures. Packaging suppliers often write the same box as length × width × depth (L × W × D), where L and W describe the opening and D the height. Confirm which convention your printer uses before ordering.',
      },
      {
        title: 'Before you send it to print',
        body: 'Retail cartons are usually printed on 300–400 gsm folding boxboard or SBS. The dieline here takes your sizes as inside dimensions and creases each panel one board thickness wider for the caliper you enter. Your printer may still fine-tune it for their board and creasing tools, so use it to design and approve the artwork, then ask for their die line or a proof before the production run.',
      },
    ],
    faqs: [
      { question: 'Is the reverse tuck end template free?', answer: 'Yes. The size picker and dieline on this page are free to use. Designing artwork, saving and exporting the PDF dieline happen in the Studio, which needs a free account.' },
      { question: 'Can I download the dieline as a PDF, SVG or DXF?', answer: 'Yes, from the Studio. Open this template with your size, then use Preview & Download to export a 1:1 vector PDF with your artwork, cut and crease lines, adjustable bleed and a calibration ruler, or the cutting template on its own as an SVG or DXF with cut and crease lines on separate layers.' },
      { question: 'Does the dieline include tuck flaps and dust flaps?', answer: 'Yes. The reverse tuck template draws the tuck tongues with slit locks, four shouldered dust flaps, a tapered glue flap and a thumb notch, with panels creased one board thickness wider than the inside size you enter. Artwork prints on the closure flaps too, exactly as laid out on the design grid; the glue flap stays bare.' },
      { question: 'Does it adjust for board thickness?', answer: 'Yes. The sizes you enter are inside dimensions, and each panel is creased one board thickness wider for the caliper set in the Studio. Printers sometimes use their own allowances for a particular board and tooling, so ask yours to confirm before production.' },
      { question: 'Can I use inches?', answer: 'Yes. Switch the unit to inches in the size picker; the Studio keeps the same unit when you open the template.' },
    ],
    guides: ['how-to-measure-a-box-inside-vs-outside-dimensions', 'packaging-bleed-safe-zone-dieline', 'tuck-end-folding-carton-mockup', 'box-dieline-svg-dxf-export', 'box-template-svg-cricut-laser-cutter'],
    tags: ['Folding cartons', 'Retail'],
    updated: '2026-10-11',
  },
  {
    slug: 'pizza-box',
    templateId: 'pizza-box',
    name: 'Pizza box',
    title: 'Pizza Box Template & Dieline with 3D Mockup | 3D Box Studio',
    description: 'Free pizza box template for 10, 12, 14 and 16 inch boxes. See the flat layout, add your branding, fold the box in 3D and export PNG mockups.',
    eyebrow: 'Box template',
    h1: 'Pizza box template',
    intro: 'Pick a standard pizza size or enter your own and the cutting template below updates: a one-piece corrugated box with a double front that locks into the base, corner tabs, and a rear-hinged lid with a front tuck and side flaps. Open it in the Studio to brand the lid, fold the box in 3D and export mockups or a 1:1 PDF.',
    fields: { width: 'Width', height: 'Wall height', depth: 'Depth' },
    presets: [
      { label: '10 inch pizza', note: 'Small', width: 10, height: 1.75, depth: 10, unit: 'in' },
      { label: '12 inch pizza', note: 'Medium', width: 12, height: 1.75, depth: 12, unit: 'in' },
      { label: '14 inch pizza', note: 'Large', width: 14, height: 1.75, depth: 14, unit: 'in' },
      { label: '16 inch pizza', note: 'Extra large', width: 16, height: 2, depth: 16, unit: 'in' },
      { label: '30 cm pizza', note: 'Metric', width: 305, height: 45, depth: 305, unit: 'mm' },
    ],
    geometryNote: 'Cutting template: double front wall over a roll strip with locking tabs and base slots, side-wall corner tabs, lid tuck and side flaps, and a finger hole. Ask your box maker to confirm the allowances for the flute you choose.',
    sections: [
      {
        title: 'How a pizza box is built',
        body: 'Most pizza boxes are a single die-cut sheet of corrugated board with no glue. The side walls fold up and their corner tabs turn in; the front wall folds up outside the tabs and then double over a narrow roll strip, its inner layer locking into slots in the base and trapping the tabs. The lid hinges from the back wall, and its front tuck and side flaps slide inside the walls to hold it closed.',
      },
      {
        title: 'What is on the layout',
        body: 'The template draws the panels you design on, sized from your width, depth and wall height.',
        bullets: [
          'Tray base with side walls, a back wall, and a double front wall that locks into slots in the base.',
          'Four corner tabs on the side walls: the front pair is trapped inside the double front.',
          'Lid hinged from the back wall, the main branding surface, with a front tuck and side flaps.',
          'A finger hole across the front to lift the lid.',
        ],
      },
      {
        title: 'Standard pizza box sizes',
        body: 'Box sizes are named after the pizza they hold: a 12 inch box has a base of about 12 × 12 inches. Walls are typically 1.5 to 2 inches high. Suppliers add a little clearance, so a 12 inch box often measures slightly more than 12 inches inside; check the supplier’s spec sheet and enter their inside dimensions for the most accurate mockup.',
      },
      {
        title: 'Designing a pizza box',
        body: 'The lid is what customers see, so most brands put the logo and a short message there and keep the walls simple. Corrugated board absorbs ink, and many pizza boxes are flexo printed in one or two colours. Preview your design on a kraft or white material in the Studio to see how it reads before you commit to a print run.',
      },
    ],
    faqs: [
      { question: 'Is the pizza box template free?', answer: 'Yes. The size picker and layout preview here are free. Designing artwork, saving and exporting happen in the Studio with a free account.' },
      { question: 'What sizes can I make?', answer: 'Any size. Presets cover 10, 12, 14 and 16 inch boxes and a 30 cm metric box, and you can type your own width, depth and wall height in millimetres or inches.' },
      { question: 'Is this a production-ready pizza box die?', answer: 'It is a real cutting template with the locking double front, slots, corner tabs, lid flaps and finger hole, sized from your inside dimensions and board thickness. Ask your box maker to confirm the allowances for the flute they run before production.' },
      { question: 'Can I export the pizza box design?', answer: 'Yes. The Studio exports PNG mockups from the 3D view and a 1:1 PDF cutting template with your artwork, cut and crease lines, and adjustable bleed. The cutting template on its own downloads as SVG or DXF for your box maker.' },
    ],
    guides: ['standard-box-sizes-carton-mailer-shipping', 'packaging-bleed-safe-zone-dieline', 'food-beverage-carton-shelf-preview'],
    tags: ['Corrugated', 'Food'],
    updated: '2026-10-11',
  },
  {
    slug: 'mailer-box',
    templateId: 'mailer-box',
    name: 'Mailer box',
    title: 'Mailer Box Template & Dieline (FEFCO 0427) with 3D Mockup | 3D Box Studio',
    description: 'Free mailer box template (FEFCO 0427 roll end tuck top). Enter your inside size to draw the dieline, brand the outside and inside, fold it in 3D and export a 1:1 PDF.',
    eyebrow: 'Box template',
    h1: 'Mailer box template',
    intro: 'The self-locking e-commerce mailer: one sheet of corrugated board, no glue, double side walls that lock into the base, and a hinged lid that tucks in at the front. Enter the inside size of your box and the cutting template below redraws. Open it in the Studio to brand the outside and the unboxing inside, fold it in 3D and export mockups or a 1:1 PDF.',
    fields: { width: 'Width (front)', height: 'Height', depth: 'Depth (front to back)' },
    presets: [
      { label: 'Jewellery / small gift', note: 'Slim mailer', width: 150, height: 50, depth: 100, unit: 'mm' },
      { label: 'Cosmetics set', note: 'Subscription box', width: 220, height: 80, depth: 160, unit: 'mm' },
      { label: 'Apparel', note: 'Folded T-shirt', width: 300, height: 70, depth: 230, unit: 'mm' },
      { label: 'Shoe-box size', note: 'Large mailer', width: 340, height: 120, depth: 220, unit: 'mm' },
      { label: '9 × 6 × 3 in', note: 'US standard', width: 9, height: 3, depth: 6, unit: 'in' },
    ],
    geometryNote: 'Cutting template: front and back walls with ears, side walls folded double over a roll strip with locking tabs and base slots, and a lid with a front tuck and side flaps. Width, depth and height are inside sizes; the base is cut wider so the double walls stand inside it. Ask your box maker to confirm the allowances for the flute you choose.',
    sections: [
      {
        title: 'How a mailer box is built',
        body: 'The roll end tuck top mailer (FEFCO 0427) is a single die-cut sheet of corrugated board with no glue. The front and back walls fold up and their ears turn in along the sides. Each side wall folds up outside the ears and then double over a narrow roll strip, its inner layer locking into slots in the base and trapping the ears. The lid hinges from the back wall; its side flaps drop inside the double walls and its front tuck slides in behind the front wall.',
      },
      {
        title: 'What is on the dieline',
        body: 'The template draws every panel from your three inside measurements and the board thickness.',
        bullets: [
          'Base with front and back walls, each with two tapered ears.',
          'Double side walls: outer wall, roll strip and inner wall with two locking tabs.',
          'Four slots in the base for the locking tabs.',
          'Lid hinged from the back wall, with a chamfered front tuck and two side flaps.',
          'Cut lines and crease lines kept separate, as in the PDF export.',
        ],
      },
      {
        title: 'Designing for unboxing',
        body: 'Mailers are opened by the customer, so the inside matters as much as the outside. Print the lid’s inside and the inner walls with a message, pattern or brand colour, and keep the outside simple for shipping labels. The Studio lets you design both sides of the sheet and preview the box opening in 3D.',
      },
      {
        title: 'Measuring for a mailer',
        body: 'Measure the product, or the stack of products with tissue and inserts, and add a few millimetres of clearance. Width runs across the front, depth from front to back and height from the base to the lid. The double side walls take up board inside the box; the template allows for that, so enter the space you need inside.',
      },
    ],
    faqs: [
      { question: 'Is the mailer box template free?', answer: 'Yes. The size picker and dieline here are free. Designing artwork, saving and exporting the PDF happen in the Studio with a free account.' },
      { question: 'Which mailer style is this?', answer: 'The roll end tuck top mailer, FEFCO 0427: one piece, no glue, double side walls locked into the base, and a lid with a front tuck and side flaps. It is the style most e-commerce and subscription boxes use.' },
      { question: 'Are the sizes inside or outside dimensions?', answer: 'Inside. The base and walls are cut larger so the folded box keeps the inside size you enter, for the board thickness set in the Studio. Ask your box maker to confirm the allowances for their flute and tooling.' },
      { question: 'Can I print the inside of the mailer?', answer: 'Yes. Every panel has an outside and an inside surface in the Studio, so you can design the unboxing view and export both sides in the PDF.' },
      { question: 'Can I download the mailer dieline as SVG or DXF?', answer: 'Yes. Preview & Download in the Studio saves the cutting template at 1:1 in millimetres as SVG or DXF, with cut and crease lines on separate layers, for your box maker or cutting table.' },
    ],
    guides: ['standard-box-sizes-carton-mailer-shipping', 'packaging-bleed-safe-zone-dieline', 'how-to-measure-a-box-inside-vs-outside-dimensions', 'box-dieline-svg-dxf-export'],
    tags: ['Corrugated', 'E-commerce', 'Gift'],
    updated: '2026-10-11',
  },
  {
    slug: 'rigid-box',
    templateId: 'rigid-lid-base',
    name: 'Rigid lid and base box',
    title: 'Rigid Box Template (Lid & Base) with 3D Mockup | 3D Box Studio',
    description: 'Free rigid lid and base box template. Enter your size to draw the base and lid wraps with corner ears and turn-ins, design them and see the lid lift off in 3D.',
    eyebrow: 'Box template',
    h1: 'Rigid lid and base box template',
    intro: 'The two-piece premium box for gifts, cosmetics and electronics: a base tray and a lid that lifts off. Enter the inside size of the base and the layout below redraws both trays, with corner ears and turn-ins. Open it in the Studio to design the outside and the inside, set the lid height, and watch the lid come off in 3D.',
    fields: { width: 'Width (front)', height: 'Height (base)', depth: 'Depth (front to back)' },
    presets: [
      { label: 'Jewellery box', note: 'Small and shallow', width: 90, height: 35, depth: 90, unit: 'mm' },
      { label: 'Cosmetics set', note: 'Gift set', width: 220, height: 60, depth: 160, unit: 'mm' },
      { label: 'Phone or gadget', note: 'Electronics', width: 170, height: 50, depth: 100, unit: 'mm' },
      { label: 'Apparel gift box', note: 'Folded shirt', width: 300, height: 80, depth: 220, unit: 'mm' },
      { label: '8 × 8 × 3 in', note: 'US gift box', width: 8, height: 3, depth: 8, unit: 'in' },
    ],
    geometryNote: 'Wrap layout for a rigid set-up box: base tray and lid tray, each with corner ears and turn-ins. Width, depth and height are the inside of the base; the lid fits over it with a little play. Rigid boxes are greyboard wrapped in printed paper, so ask your box maker to confirm the board and wrap allowances.',
    sections: [
      {
        title: 'How a rigid lid and base box is made',
        body: 'A rigid (set-up) box is built from thick greyboard, usually 1.5 to 3 mm, wrapped in printed paper. The base and the lid are each a tray: a bottom with four walls, the corners held by ears that wrap round inside the side walls, and turn-ins that fold the wrap over the top edge into the tray. The lid is a slightly larger tray that sits over the base.',
      },
      {
        title: 'What is on the layout',
        body: 'The template draws both trays side by side from your inside size and board thickness.',
        bullets: [
          'Base tray: bottom, front, back and side walls, with corner ears.',
          'Lid tray: lid top and four walls, sized to fit over the base with a little play.',
          'Turn-ins on every wall, notched at the corners clear of the ears.',
          'Adjustable lid height, from a shallow shoulder lid to a full-depth lid, and adjustable turn-ins.',
          'Cut lines and crease lines kept separate, as in the PDF and SVG/DXF exports.',
        ],
      },
      {
        title: 'Designing a rigid box',
        body: 'The lid top carries the brand, and the inside of the base is where an unboxing message or pattern goes. Rigid boxes are often finished with soft-touch lamination, foil or embossing; preview the material in the Studio, then confirm the finishes with your box maker.',
      },
    ],
    faqs: [
      { question: 'Is the rigid box template free?', answer: 'Yes. The size picker and layout here are free. Designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'Can I change the lid height?', answer: 'Yes. In the Studio the lid height is one of the box’s adjustable sizes: anything from a shallow lid to one that covers the base completely.' },
      { question: 'Are the sizes inside or outside dimensions?', answer: 'Inside the base. The base walls and the lid are sized from it for the board thickness you set, with the lid fitting over the base with a little play.' },
      { question: 'Can I download the dieline?', answer: 'Yes. The Studio exports a 1:1 PDF with your artwork, and the cutting template on its own as SVG or DXF for your box maker.' },
    ],
    guides: ['rigid-box-lid-and-base-template', 'gift-box-packaging-luxury-preview', 'jewelry-packaging-box-mockup', 'box-dieline-svg-dxf-export'],
    tags: ['Rigid', 'Gift'],
    updated: '2026-10-11',
  },
  {
    slug: 'straight-tuck-end-box',
    templateId: 'base-box',
    name: 'Straight tuck end box',
    title: 'Straight Tuck End Box Template & Dieline (Free) | 3D Box Studio',
    description: 'Free straight tuck end box template. Enter your size to draw the dieline with both lids on the front, tuck flaps, dust flaps and glue flap, then design it and fold it in 3D.',
    eyebrow: 'Box template',
    h1: 'Straight tuck end box template',
    intro: 'Enter the finished size of your carton and the dieline below redraws instantly: four body panels, a tapered glue flap, and top and bottom lids that both fold over from the front, with tuck tongues and dust flaps. Open it in the Studio to design it, fold it in 3D and export the dieline as a 1:1 PDF, SVG or DXF.',
    fields: { width: 'Width (front)', height: 'Height', depth: 'Depth (side)' },
    presets: [
      { label: 'Candle or jar', note: 'Square gift carton', width: 80, height: 100, depth: 80, unit: 'mm' },
      { label: 'Tea tin', note: 'Tall square carton', width: 65, height: 160, depth: 65, unit: 'mm' },
      { label: 'Cosmetic tube', note: 'Slim carton', width: 40, height: 150, depth: 40, unit: 'mm' },
      { label: 'Toy or game', note: 'Flat retail carton', width: 180, height: 220, depth: 60, unit: 'mm' },
      { label: '3 × 3 × 6 in', note: 'US retail carton', width: 3, height: 6, depth: 3, unit: 'in' },
    ],
    geometryNote: 'Cutting template: both lids hinge on the front and tuck in at the back, with slit-locked tucks, shouldered dust flaps, a 15° glue flap and a thumb notch. Width, depth and height are inside sizes; panels are creased one board thickness wider. Ask your printer to confirm the allowances for their board.',
    sections: [
      {
        title: 'What is a straight tuck end box?',
        body: 'A straight tuck end (STE) box is a folding carton whose top and bottom closures hinge from the same face. Both lids fold over from the front edge, so the front panel has clean folded edges at the top and bottom and the tucks slide in at the back. It is a common choice for gift cartons, candles, tea and products where the front should look seamless.',
      },
      {
        title: 'What is on the dieline',
        body: 'The template draws every panel from your three measurements.',
        bullets: [
          'Four body panels in one strip: front, side, back, side.',
          'A glue flap with 15° tapered ends.',
          'Top and bottom lids on the front panel, each with a tuck tongue and slit locks.',
          'Shouldered dust flaps that fold in under each lid.',
          'Adjustable glue flap, tuck and dust flap sizes in the Studio.',
          'Cut lines and crease lines kept separate, as in the PDF, SVG and DXF exports.',
        ],
      },
      {
        title: 'Straight tuck vs reverse tuck',
        body: 'A reverse tuck end box puts its closures on opposite faces, which nests better on the press sheet and usually costs a little less to print. Choose a straight tuck end box when you want the same clean front edge at the top and bottom, or when the box opens from the front on a shelf. The [reverse tuck end box](/box-templates/reverse-tuck-end-box) template is next door if you want to compare.',
      },
      {
        title: 'Opening styles',
        body: 'In the Studio you can also hinge the top lid on another wall or open the front as doors, and watch each option open in 3D before you decide.',
      },
    ],
    faqs: [
      { question: 'Is the straight tuck end template free?', answer: 'Yes. The size picker and dieline here are free. Designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'Which side do the lids hinge on?', answer: 'Both lids hinge on the front, so the top and bottom tuck in at the back. In the Studio you can move the top lid to another wall or open the front as doors.' },
      { question: 'Are the sizes inside or outside dimensions?', answer: 'Inside. Each panel is creased one board thickness wider for the caliper you set, so the folded carton keeps the inside size you enter.' },
      { question: 'Can I download the dieline?', answer: 'Yes. The Studio exports a 1:1 PDF with your artwork, and the cutting template on its own as SVG or DXF with cut and crease lines on separate layers.' },
    ],
    guides: ['tuck-end-folding-carton-mockup', 'how-to-measure-a-box-inside-vs-outside-dimensions', 'packaging-bleed-safe-zone-dieline', 'box-template-svg-cricut-laser-cutter'],
    tags: ['Folding cartons', 'Retail', 'Gift'],
    updated: '2026-10-11',
  },
  {
    slug: 'auto-lock-bottom-box',
    templateId: 'auto-lock-bottom-box',
    name: 'Auto lock bottom box',
    title: 'Auto Lock Bottom Box Template & Crash Lock Dieline (Free) | 3D Box Studio',
    description: 'Free auto lock bottom (crash lock) box template. Enter your size to draw the dieline with a tuck top, pre-glued locking bottom flaps and glue tabs, then design it and fold it in 3D.',
    eyebrow: 'Box template',
    h1: 'Auto lock bottom box template',
    intro: 'Enter the finished size of your carton and the dieline below redraws instantly: four body panels, a tapered glue flap, a tuck top on the front, and a crash-lock bottom with interlocking front and back flaps and 45° glue tabs on the side flaps. Open it in the Studio to design it, fold it in 3D and export the dieline as a 1:1 PDF, SVG or DXF.',
    fields: { width: 'Width (front)', height: 'Height', depth: 'Depth (side)' },
    presets: [
      { label: 'Wine or spirits bottle', note: 'Tall bottle carton', width: 90, height: 320, depth: 90, unit: 'mm' },
      { label: 'Supplement jar', note: 'Square carton', width: 80, height: 110, depth: 80, unit: 'mm' },
      { label: 'Candle set', note: 'Gift carton', width: 100, height: 140, depth: 70, unit: 'mm' },
      { label: 'Small appliance', note: 'Heavy retail carton', width: 160, height: 220, depth: 110, unit: 'mm' },
      { label: '4 × 4 × 8 in', note: 'US retail carton', width: 4, height: 8, depth: 4, unit: 'in' },
    ],
    geometryNote: 'Cutting template: a tuck top hinged on the front with slit-locked tuck, shouldered dust flaps and a thumb notch; at the bottom, front and back flaps that overlap past the middle and step at half their width to lock, and side flaps with a glue tab past a 45° crease. Width, depth and height are inside sizes; panels are creased one board thickness wider and the walls three boards taller for the layered bottom. Ask your printer to confirm the allowances and glue tabs for their board.',
    sections: [
      {
        title: 'What is an auto lock bottom box?',
        body: 'An auto lock bottom box, also called a crash lock or auto bottom box, is a folding carton whose bottom is folded and glued at the factory. It ships flat, and when you open it the four bottom flaps swing down together and lock, so the carton is ready to fill in a second. The bottom is much stronger than a tuck, which makes it the usual choice for bottles, jars, candles, electronics and anything heavy.',
      },
      {
        title: 'What is on the dieline',
        body: 'The template draws every panel from your three measurements.',
        bullets: [
          'Four body panels in one strip: side, front, side, back, with a glue flap with 15° tapered ends.',
          'A top lid on the front panel with a slit-locked tuck tongue, two shouldered dust flaps and a thumb notch in the back.',
          'Front and back bottom flaps that reach past the middle and step at half their width, so each lies over the other on one side and they lock.',
          'Side bottom flaps, each with a glue tab past a 45° crease at the corner where the flat carton folds.',
          'Adjustable glue flap, tuck, top dust flap and bottom side flap sizes in the Studio.',
          'Cut lines and crease lines kept separate, as in the PDF, SVG and DXF exports.',
        ],
      },
      {
        title: 'How the crash-lock bottom works',
        body: 'At the factory each glue tab is folded back along its 45° crease and glued to the inside of the front or back flap beside it, and the carton is folded flat with the bottom tucked inside. Opening the tube pulls those tabs, which swing the four flaps down into place, and the stepped front and back flaps lock over each other. Watch it fold in 3D in the Studio.',
      },
      {
        title: 'Auto lock bottom vs tuck end',
        body: 'A [straight tuck end box](/box-templates/straight-tuck-end-box) or [reverse tuck end box](/box-templates/reverse-tuck-end-box) closes its bottom with a tuck, which costs less to make but holds less weight and has to be closed by hand. An auto lock bottom needs a glued bottom and costs a little more, but it sets up faster on the packing line and carries heavier products safely.',
      },
    ],
    faqs: [
      { question: 'Is the auto lock bottom template free?', answer: 'Yes. The size picker and dieline here are free. Designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'Is an auto lock bottom the same as a crash lock bottom?', answer: 'Yes. Auto lock bottom, crash lock bottom and auto bottom are names for the same pre-glued bottom that locks itself when the carton is opened. A [snap lock (1-2-3) bottom](/box-templates/snap-lock-bottom-box) is different: it is not glued and is folded closed by hand.' },
      { question: 'Are the sizes inside or outside dimensions?', answer: 'Inside. Each panel is creased one board thickness wider for the caliper you set, and the walls are three boards taller for the layered bottom, so the folded carton keeps the inside size you enter.' },
      { question: 'Can I download the dieline?', answer: 'Yes. The Studio exports a 1:1 PDF with your artwork, and the cutting template on its own as SVG or DXF with cut and crease lines on separate layers. Ask your printer to confirm the glue tabs and allowances for their board and gluer.' },
    ],
    guides: ['auto-lock-bottom-box-crash-lock', 'tuck-end-folding-carton-mockup', 'how-to-measure-a-box-inside-vs-outside-dimensions', 'box-dieline-svg-dxf-export'],
    tags: ['Folding cartons', 'Retail', 'Heavy products'],
    updated: '2026-10-14',
  },
  {
    slug: 'snap-lock-bottom-box',
    templateId: 'snap-lock-bottom-box',
    name: 'Snap lock bottom box',
    title: 'Snap Lock Bottom Box Template & 1-2-3 Bottom Dieline (Free) | 3D Box Studio',
    description: 'Free snap lock (1-2-3) bottom box template. Enter your size to draw the dieline with a tuck top and a four-flap locking bottom that closes by hand with no glue, then design it and fold it in 3D.',
    eyebrow: 'Box template',
    h1: 'Snap lock bottom box template',
    intro: 'Enter the finished size of your carton and the dieline below redraws instantly: four body panels, a tapered glue flap, a tuck top on the front, and a snap-lock bottom of two side flaps, a back flap with a half-moon notch and a front flap with a lock tongue. Open it in the Studio to design it, fold it in 3D and export the dieline as a 1:1 PDF, SVG or DXF.',
    fields: { width: 'Width (front)', height: 'Height', depth: 'Depth (side)' },
    presets: [
      { label: 'Cosmetics jar', note: 'Square carton', width: 70, height: 80, depth: 70, unit: 'mm' },
      { label: 'Supplement bottle', note: 'Tall carton', width: 65, height: 130, depth: 65, unit: 'mm' },
      { label: 'Perfume', note: 'Slim carton', width: 60, height: 140, depth: 45, unit: 'mm' },
      { label: 'Electronics accessory', note: 'Flat carton', width: 120, height: 160, depth: 50, unit: 'mm' },
      { label: '3 × 3 × 5 in', note: 'US retail carton', width: 3, height: 5, depth: 3, unit: 'in' },
    ],
    geometryNote: 'Cutting template: a tuck top hinged on the front with slit-locked tuck, shouldered dust flaps and a thumb notch; at the bottom, two tapered side flaps, a back flap with a half-moon notch and a front flap whose tongue tucks in under the back flap. No glue on the bottom. Width, depth and height are inside sizes; panels are creased one board thickness wider and the walls three boards taller for the layered bottom. Ask your printer to confirm the allowances for their board.',
    sections: [
      {
        title: 'What is a snap lock bottom box?',
        body: 'A snap lock bottom box, also called a 1-2-3 bottom or lock bottom box, is a folding carton whose bottom closes with four interlocking flaps and no glue. It ships flat with the bottom open; the packer folds the flaps in order and the last one snaps into place. The bottom is much stronger than a tuck end, and the carton costs less to make than a pre-glued crash lock, which is why it is popular for cosmetics, supplements, candles and small electronics.',
      },
      {
        title: 'What is on the dieline',
        body: 'The template draws every panel from your three measurements.',
        bullets: [
          'Four body panels in one strip: side, front, side, back, with a glue flap with 15° tapered ends.',
          'A top lid on the front panel with a slit-locked tuck tongue, two shouldered dust flaps and a thumb notch in the back.',
          'Two tapered side flaps at the bottom that fold in first.',
          'A back flap covering two thirds of the depth, with a half-moon notch in its edge.',
          'A front flap that overlaps the back flap, with a lock tongue that tucks in under it.',
          'Adjustable glue flap, tuck, top dust flap, bottom side flap and lock tongue sizes in the Studio.',
          'Cut lines and crease lines kept separate, as in the PDF, SVG and DXF exports.',
        ],
      },
      {
        title: 'How to close a 1-2-3 bottom',
        body: 'Turn the open carton upside down. (1) Fold in the two side flaps. (2) Fold the back flap over them. (3) Fold the front flap over the back flap and push its tongue in under the back flap\'s edge, past the half-moon notch, until it snaps flat. The walls are cut so each flap creases a board above the one that closes after it, so the bottom lies flat. Watch it fold in that order in 3D in the Studio.',
      },
      {
        title: 'Snap lock vs auto lock vs tuck end',
        body: 'A [straight tuck end](/box-templates/straight-tuck-end-box) or [reverse tuck end](/box-templates/reverse-tuck-end-box) bottom is the cheapest and fine for light products, but a tuck can open under weight. A snap lock bottom holds more and needs no glue, so it suits short runs and products packed by hand. An [auto lock bottom](/box-templates/auto-lock-bottom-box) is pre-glued and forms itself when the carton is opened, which is fastest on a packing line and strongest, at a slightly higher price per carton.',
      },
    ],
    faqs: [
      { question: 'Is the snap lock bottom template free?', answer: 'Yes. The size picker and dieline here are free. Designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'Is a snap lock bottom the same as a 1-2-3 bottom?', answer: 'Yes. Snap lock, 1-2-3 bottom and lock bottom are names for the same four-flap bottom that closes by hand without glue. A crash lock or auto lock bottom is different: it is glued at the factory and forms itself when the carton is opened.' },
      { question: 'Are the sizes inside or outside dimensions?', answer: 'Inside. Each panel is creased one board thickness wider for the caliper you set, and the walls are three boards taller for the layered bottom, so the folded carton keeps the inside size you enter.' },
      { question: 'Can I download the dieline?', answer: 'Yes. The Studio exports a 1:1 PDF with your artwork, and the cutting template on its own as SVG or DXF with cut and crease lines on separate layers. Ask your printer to confirm the allowances for their board.' },
    ],
    guides: ['auto-lock-bottom-box-crash-lock', 'tuck-end-folding-carton-mockup', 'how-to-measure-a-box-inside-vs-outside-dimensions', 'box-dieline-svg-dxf-export'],
    tags: ['Folding cartons', 'Retail', 'Cosmetics'],
    updated: '2026-10-14',
  },
  {
    slug: 'pillow-box',
    templateId: 'pillow-box',
    name: 'Pillow box',
    title: 'Pillow Box Template & Dieline (Free) | 3D Box Studio',
    description: 'Free pillow box template. Enter your size to draw the pillow box dieline with its curved end creases, end flaps and glue flap, then design it and see it curve closed in 3D.',
    eyebrow: 'Box template',
    h1: 'Pillow box template',
    intro: 'Enter the size of your closed pillow box and the dieline below redraws instantly: two faces, a curved crease and end flap at each end of both faces, and a glue flap. Open it in the Studio to design it, watch the faces bow and the ends close in 3D, and export the dieline as a 1:1 PDF, SVG or DXF.',
    fields: { width: 'Width (tip to tip)', height: 'Height (thickness)', depth: 'Depth (across)' },
    presets: [
      { label: 'Jewellery', note: 'Necklace or bracelet', width: 100, height: 30, depth: 60, unit: 'mm' },
      { label: 'Gift card', note: 'Slim pillow', width: 120, height: 20, depth: 80, unit: 'mm' },
      { label: 'Party favour', note: 'Sweets or soap', width: 90, height: 35, depth: 70, unit: 'mm' },
      { label: 'Socks or scarf', note: 'Apparel', width: 220, height: 60, depth: 130, unit: 'mm' },
      { label: '4 × 3 × 1 in', note: 'US gift pillow', width: 4, height: 1, depth: 3, unit: 'in' },
    ],
    geometryNote: 'Cutting template: a front and a back face joined by a straight crease, each with a curved crease at both ends and a curved end flap beyond it, and a glue flap whose ends follow the creases. No glue at the ends. Width, depth and height are the outside of the closed pillow: tip to tip, across, and through the middle. The faces are cut as wide as their bowed curve. Ask your printer to confirm the curved scores for their board.',
    sections: [
      {
        title: 'What is a pillow box?',
        body: 'A pillow box is a small carton with two bowed faces and curved ends, shaped like a pillow. It is cut from one piece of board, glued along one side and shipped flat; to close it, you push in the curved ends and they lock shut against each other with no tuck or glue. Pillow boxes are a favourite for jewellery, gift cards, party favours, cosmetics samples and small accessories, because they look premium and use little board.',
      },
      {
        title: 'What is on the dieline',
        body: 'The template draws every part from your three measurements.',
        bullets: [
          'A front and a back face, each as wide as its curve across the closed box, sharing a crease that becomes one side edge.',
          'A curved crease at each end of both faces, dipping into the face: the deeper it dips, the longer the taper to the closed end.',
          'A curved end flap beyond each crease, as deep as it needs to be to reach the middle of the closed end.',
          'A glue flap along the back face, whose ends follow the front\'s creases so it stays hidden inside.',
          'An adjustable glue flap width in the Studio.',
          'Cut lines and crease lines kept separate, as in the PDF, SVG and DXF exports.',
        ],
      },
      {
        title: 'How to fold a pillow box',
        body: 'Score the curved creases cleanly first: they are what make the box work. Fold along the straight crease between the two faces, glue the flap inside the front edge and let it dry. Squeeze the sides so the faces bow out, then push one curved end in until both flaps meet in the middle, fill the box, and push the other end in the same way. In the Studio you can watch the faces bow and the ends close in 3D. For more detail, see [how to make a pillow box](/blog/how-to-make-a-pillow-box).',
      },
      {
        title: 'Choosing the size',
        body: 'Measure the product and add a little room: the pillow is thickest in the middle and tapers to its ends, so a product needs to fit well inside the middle third of the length. Keep the height at no more than about two thirds of the depth across, or the faces cannot bow enough to close. For a flat item such as a gift card, a slim pillow 20 to 25 mm thick works well; for jewellery or soap, 30 to 40 mm.',
      },
    ],
    faqs: [
      { question: 'Is the pillow box template free?', answer: 'Yes. The size picker and dieline here are free. Designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'Are the sizes inside or outside dimensions?', answer: 'Outside. Width is the closed pillow from tip to tip, depth is across, and height is its thickness in the middle. The inside is a little smaller, and less towards the ends, where the pillow tapers.' },
      { question: 'Does a pillow box need glue?', answer: 'Only once, along the glue flap that closes the tube. The ends close by pushing in the curved flaps, with no glue or tuck, so the box can be opened and closed again.' },
      { question: 'Can I download the dieline?', answer: 'Yes. The Studio exports a 1:1 PDF with your artwork, and the cutting template on its own as SVG or DXF with cut and crease lines on separate layers. The curved creases are drawn as short straight segments, as die makers cut them. Ask your printer to confirm the scores for their board.' },
    ],
    guides: ['how-to-make-a-pillow-box', 'jewelry-packaging-box-mockup', 'gift-box-packaging-luxury-preview', 'box-dieline-svg-dxf-export'],
    tags: ['Folding cartons', 'Gift'],
    updated: '2026-10-14',
  },
  {
    slug: 'gable-box',
    templateId: 'gable-box',
    name: 'Gable box',
    title: 'Gable Box Template & Dieline with Handle (Free) | 3D Box Studio',
    description: 'Free gable box template. Enter your size to draw the gable box dieline with its roof, carry handle, gusseted gable ends and auto-lock bottom, then design it and fold it closed in 3D.',
    eyebrow: 'Box template',
    h1: 'Gable box template',
    intro: 'Enter the size of your gable box and the dieline below redraws instantly: four walls and a glue flap, a sloping roof panel and a handle with a finger hole over the front and back, a gable end with two gussets over each side, and an auto-lock bottom. Open it in the Studio to design it, change the roof and handle height, watch it fold closed in 3D, and export the dieline as a 1:1 PDF, SVG or DXF.',
    fields: { width: 'Width', height: 'Height (body)', depth: 'Depth' },
    presets: [
      { label: 'Cupcakes', note: 'Two to four', width: 180, height: 90, depth: 90, unit: 'mm' },
      { label: 'Party favour', note: 'Small gift', width: 100, height: 70, depth: 60, unit: 'mm' },
      { label: 'Kids\' meal', note: 'Takeaway', width: 160, height: 100, depth: 100, unit: 'mm' },
      { label: 'Gift box', note: 'Candle or mug', width: 140, height: 120, depth: 100, unit: 'mm' },
      { label: '6 × 4 × 4 in', note: 'US gable box', width: 6, height: 4, depth: 4, unit: 'in' },
    ],
    geometryNote: 'Cutting template: a glue flap, the left, front, right and back walls, a roof panel and a handle with a finger hole over the front and back, a gable end with a gusset on each slope over each side, and auto-lock bottom flaps with glue tabs. The gussets are cut free from the roof beside them. Width, depth and height are the inside of the body; the roof and handle sit above it, and their heights can be changed in the Studio. Ask your printer to confirm the allowances for their board.',
    sections: [
      {
        title: 'What is a gable box?',
        body: 'A gable box is a carton with a pitched roof like a house and a carry handle on top. Its front and back walls rise into roof panels that slope in to meet over the middle, and each roof ends in a handle panel with a finger hole; the two handles stand back to back. The sides rise into triangular gable ends. Gable boxes are popular for bakery and cupcakes, kids\' meals and takeaway, party favours and gifts, because they carry easily and the tall roof and handle give plenty of room for branding.',
      },
      {
        title: 'What is on the dieline',
        body: 'The template draws every part from your three measurements.',
        bullets: [
          'Four walls and a glue flap, creased one board wider than the inside size so the folded box keeps it.',
          'A roof panel over the front and back walls, as long as it needs to be to reach the middle of the box at the roof height you choose.',
          'A handle panel above each roof, with a rounded finger hole cut through it.',
          'A triangular gable end over each side wall, with a gusset flap on each slope that folds in under the roof. The gussets are cut free from the roof panels, so you will see short cuts along those edges.',
          'An auto-lock (crash-lock) bottom: front and back flaps that interlock, and side flaps with glue tabs, so the bottom springs into place when the flat box is opened.',
          'Adjustable roof height, handle height, glue flap and bottom side flaps in the Studio.',
          'Cut lines and crease lines kept separate, as in the PDF, SVG and DXF exports.',
        ],
      },
      {
        title: 'How to fold a gable box',
        body: 'Glue the bottom side flaps\' triangular tabs to the front and back flaps beside them, and the glue flap inside the back wall, then fold the box flat to let the glue dry; this is how a printer\'s gluer ships them. To set it up, open the tube and push the bottom in until it locks. Fill the box, fold the gussets in under the roof line, bring the two roof panels together over the middle and put the handles back to back. In the Studio you can watch every step in 3D, and the [gable box guide](/blog/how-to-make-a-gable-box) walks through it.',
      },
      {
        title: 'Choosing the size',
        body: 'Measure the product and add a few millimetres of room: width, depth and height are the inside of the body, below the roof. The roof adds space above that, about half the depth by default, and the handle sits on top. For cupcakes or a pastry, leave the roof at least as high as the product rises above the walls. For something you will carry, keep the handle at least 30 mm tall so a finger fits through the hole, and choose a stronger board for heavier contents.',
      },
    ],
    faqs: [
      { question: 'Is the gable box template free?', answer: 'Yes. The size picker and dieline here are free. Designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'Are the sizes inside or outside dimensions?', answer: 'Inside, for the body: width, depth and height are the space inside the walls, below the roof. Each panel is creased one board wider so the folded box keeps that inside size. The roof and handle add to the overall height.' },
      { question: 'Can I change the roof and handle height?', answer: 'Yes. In the Studio, under Box & Size, you can set the roof height, the handle height, the glue flap and the bottom side flaps, each within limits that keep the box folding. The dieline and the 3D box follow.' },
      { question: 'Does a gable box need glue?', answer: 'Only where the printer glues it: the glue flap along the side and the bottom\'s glue tabs, so the bottom locks itself when the box is opened. The roof closes by bringing the handles together, so the box can be opened and closed again.' },
      { question: 'Can I download the dieline?', answer: 'Yes. The Studio exports a 1:1 PDF with your artwork, and the cutting template on its own as SVG or DXF with cut and crease lines on separate layers, finger holes included. Ask your printer to confirm the allowances for their board.' },
    ],
    guides: ['how-to-make-a-gable-box', 'auto-lock-bottom-box-crash-lock', 'gift-box-packaging-luxury-preview', 'box-dieline-svg-dxf-export'],
    tags: ['Folding cartons', 'Food', 'Gift'],
    updated: '2026-10-15',
  },
  {
    slug: 'drawer-box',
    templateId: 'drawer-box',
    name: 'Drawer box',
    title: 'Drawer Box Template & Dieline, Sleeve and Tray (Free) | 3D Box Studio',
    description: 'Free drawer box template. Enter your size to draw the dieline for a sliding tray and its sleeve, with thumb notches, corner ears and turn-ins, then design it and watch the drawer slide out in 3D.',
    eyebrow: 'Box template',
    h1: 'Drawer box template',
    intro: 'Enter the inside size of your drawer and the dieline below redraws instantly: a tray with corner ears and double walls, and a sleeve that slides over it, with a thumb notch at each end. Open it in the Studio to design both, watch the sleeve slide on and the drawer pull out in 3D, and export the dieline as a 1:1 PDF, SVG or DXF.',
    fields: { width: 'Width', height: 'Height', depth: 'Depth (slides out)' },
    presets: [
      { label: 'Jewellery', note: 'Ring or earrings', width: 80, height: 30, depth: 80, unit: 'mm' },
      { label: 'Chocolates', note: 'Box of 12', width: 160, height: 30, depth: 120, unit: 'mm' },
      { label: 'Tea or soap', note: 'Gift set', width: 140, height: 50, depth: 100, unit: 'mm' },
      { label: 'Phone accessory', note: 'Retail', width: 90, height: 25, depth: 170, unit: 'mm' },
      { label: '4 × 4 × 2 in', note: 'US gift drawer', width: 4, height: 2, depth: 4, unit: 'in' },
    ],
    geometryNote: 'Cutting template: a tray (a bottom, four walls, ears on the front and back walls that wrap the corners inside the side walls, and a turn-in on every wall) above a sleeve (a glue flap, two sides, a bottom and a top with a half-round thumb notch at each end). Width, depth and height are the inside of the tray; the sleeve fits round it with a little play, which you can change in the Studio. Ask your printer to confirm the allowances for their board.',
    sections: [
      {
        title: 'What is a drawer box?',
        body: 'A drawer box, also called a slide box, sleeve and tray box or matchbox-style box, is two parts: a tray that holds the product and a sleeve it slides into. Pushing the tray out of the sleeve makes a small moment of unboxing, which is why drawer boxes are popular for jewellery, chocolates, tea, cosmetics, gift sets and premium accessories. The sleeve carries most of the branding and the tray can carry a surprise inside.',
      },
      {
        title: 'What is on the dieline',
        body: 'The template draws both parts on one sheet, the tray above the sleeve, from your three measurements.',
        bullets: [
          'The tray: a bottom and four walls, with ears on the front and back walls that fold round the corners and turn-ins that fold over inside every wall, so the walls are double and hold together without glue.',
          'The sleeve: a glue flap, two sides, a bottom and a top, glued into a tube open at both ends.',
          'A half-round thumb notch at each end of the sleeve\'s top, to push the tray out from either side.',
          'Sleeve play: the gap between the tray and the sleeve, so the drawer slides smoothly.',
          'Adjustable turn-ins, sleeve play, thumb notch size and glue flap in the Studio.',
          'Cut lines and crease lines kept separate, as in the PDF, SVG and DXF exports.',
        ],
      },
      {
        title: 'How to fold a drawer box',
        body: 'For the tray, fold up the front and back walls, fold their ears in round the corners, fold up the side walls over the ears, then fold each turn-in over the top of its wall and down inside; the turn-ins hold the ears in place. For the sleeve, glue the glue flap inside the top panel to make a tube and let it dry flat. Slide the tray into the sleeve. In the Studio you can watch both fold and the sleeve slide on in 3D, and the [drawer box guide](/blog/how-to-make-a-drawer-box) walks through it.',
      },
      {
        title: 'Choosing the size',
        body: 'Measure the product and add a few millimetres of room: width, depth and height are the inside of the tray, and the drawer slides out along the depth. The sleeve is sized from the tray automatically. Thin board slides most smoothly; for a heavier product or a premium feel, choose a thicker board and a little more sleeve play.',
      },
    ],
    faqs: [
      { question: 'Is the drawer box template free?', answer: 'Yes. The size picker and dieline here are free. Designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'Are the sizes inside or outside dimensions?', answer: 'Inside, for the tray: width, depth and height are the space the product sits in. The sleeve is sized round the tray with a little play, so the outside of the closed box is a few millimetres larger.' },
      { question: 'Does a drawer box need glue?', answer: 'Only the sleeve, along its glue flap. The tray\'s ears and turn-ins lock its walls without glue, although a dot of glue under each turn-in makes it sturdier.' },
      { question: 'Can I change how tight the drawer is?', answer: 'Yes. In the Studio, under Box & Size, set the sleeve play: the gap between the tray and the sleeve. You can also change the turn-ins, the thumb notches and the glue flap.' },
      { question: 'Can I download the dieline?', answer: 'Yes. The Studio exports a 1:1 PDF with your artwork, and the cutting template on its own as SVG or DXF with cut and crease lines on separate layers. Ask your printer to confirm the allowances for their board.' },
    ],
    guides: ['how-to-make-a-drawer-box', 'gift-box-packaging-luxury-preview', 'jewelry-packaging-box-mockup', 'box-dieline-svg-dxf-export'],
    tags: ['Folding cartons', 'Gift'],
    updated: '2026-10-15',
  },
  {
    slug: 'sleeve-box',
    templateId: 'sleeve-box',
    name: 'Sleeve box',
    title: 'Sleeve Box Template & Packaging Sleeve Dieline | 3D Box Studio',
    description: 'Free packaging sleeve template. Enter the size of your tray or product to draw an open-ended sleeve with a glue flap, design the wrap and preview it in 3D.',
    eyebrow: 'Box template',
    h1: 'Sleeve box template',
    intro: 'A sleeve is a printed band that slides over a tray, a box or the product itself. Enter the inside size of the opening and the sleeve’s length, and the dieline below redraws: four walls and a glue flap, glued into a tube with both ends open. Open it in the Studio to design the wrap and preview it in 3D.',
    fields: { width: 'Width (opening)', height: 'Length', depth: 'Depth (opening)' },
    presets: [
      { label: 'Soap bar band', note: 'Narrow belly band', width: 95, height: 40, depth: 35, unit: 'mm' },
      { label: 'Chocolate bar', note: 'Slim wrap', width: 80, height: 160, depth: 12, unit: 'mm' },
      { label: 'Gift box sleeve', note: 'Over a tray', width: 180, height: 120, depth: 60, unit: 'mm' },
      { label: 'Food tray', note: 'Ready-meal sleeve', width: 190, height: 140, depth: 45, unit: 'mm' },
      { label: 'Candle sleeve', note: 'Square band', width: 80, height: 60, depth: 80, unit: 'mm' },
    ],
    geometryNote: 'Cutting template: four walls and a 15° glue flap, both ends cut flush and left open. Width and depth are the inside of the opening and length runs along the sleeve. Each wall is creased one board wider so the folded sleeve keeps that inside. Ask your printer to confirm the allowances for their board.',
    sections: [
      {
        title: 'What is a packaging sleeve?',
        body: 'A sleeve (also called a belly band or wrap) is a printed tube with open ends. It slides over a plain tray, box or product and carries the branding, so one stock tray can be relabelled for every product or season. It is common for soap, chocolate, ready meals, apparel and gift sets.',
      },
      {
        title: 'What is on the dieline',
        body: 'The template draws the sleeve as one strip from your measurements.',
        bullets: [
          'Four walls: left, front, right and back.',
          'A glue flap with 15° tapered ends, glued to the inside of the back.',
          'Both ends cut flush and left open.',
          'An adjustable glue flap in the Studio.',
          'Cut lines and crease lines kept separate, as in the PDF, SVG and DXF exports.',
        ],
      },
      {
        title: 'Measuring for a sleeve',
        body: 'Measure the outside of the tray or product the sleeve goes over and add a millimetre or two so it slides on easily: those are the width and depth of the opening. The length is how much of the tray the sleeve covers, from a narrow band to the full length of the box.',
      },
    ],
    faqs: [
      { question: 'Is the sleeve template free?', answer: 'Yes. The size picker and dieline here are free. Designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'What size should the sleeve be?', answer: 'The opening should be the outside size of the tray or product plus a little play, so it slides on without catching. Enter that as width and depth, and the length you want the sleeve to cover.' },
      { question: 'Can I print the inside of the sleeve?', answer: 'Yes. Every panel has an outside and an inside surface in the Studio, and the PDF exports either side.' },
      { question: 'Can I download the dieline?', answer: 'Yes. The Studio exports a 1:1 PDF with your artwork, and the cutting template on its own as SVG or DXF.' },
    ],
    guides: ['how-to-measure-a-box-inside-vs-outside-dimensions', 'packaging-bleed-safe-zone-dieline', 'box-dieline-svg-dxf-export'],
    tags: ['Folding cartons', 'Food'],
    updated: '2026-10-11',
  },
  {
    slug: 'split-top-box',
    templateId: 'split-top-box',
    name: 'Split top box',
    title: 'Split Top Box Template & 3D Shipping Box Mockup | 3D Box Studio',
    description: 'Free split top shipping box template (FEFCO 0201). Enter your size to draw the slotted cutting template with four flaps at each end, design the outside and inside, and preview it in 3D.',
    eyebrow: 'Box template',
    h1: 'Split top box template',
    intro: 'The everyday corrugated shipping box: a regular slotted container whose outer top flaps meet in the middle and split the lid in two. Enter your inside size and the cutting template below redraws; open it in the Studio to brand the outside and inside, open the flaps in 3D and export mockups or a 1:1 PDF.',
    fields: { width: 'Width (front)', height: 'Height', depth: 'Depth (side)' },
    presets: [
      { label: 'Small shipper', note: 'Books, small goods', width: 300, height: 200, depth: 200, unit: 'mm' },
      { label: 'Medium shipper', note: 'General e-commerce', width: 400, height: 300, depth: 300, unit: 'mm' },
      { label: 'Large shipper', note: 'Bulky items', width: 500, height: 400, depth: 400, unit: 'mm' },
      { label: '12 × 12 × 12 in', note: 'Cube', width: 12, height: 12, depth: 12, unit: 'in' },
    ],
    geometryNote: 'Cutting template: a slotted shipping box with four flaps at each end, slots between them and a glued joint, scored one board wider than the inside size you enter. Drawn here with every top flap meeting in the middle (FEFCO 0204); in the Studio you can switch to the regular slotted container (FEFCO 0201).',
    sections: [
      {
        title: 'What the template is for',
        body: 'Use the split top box for shipping and subscription packaging: branded outer walls, a printed inside, and two outer lid flaps that open from the centre. The PDF is a slotted cutting template your box maker can quote from.',
      },
      {
        title: 'What is on the layout',
        body: 'The template draws the panels you can design on from your width, height and depth.',
        bullets: [
          'Four walls in one strip with a tapered manufacturer\'s joint (35 mm on corrugated).',
          'Four flaps at each end, slotted so they fold past each other.',
          'Outer flaps that meet in the middle of the lid, on the front and back (FEFCO 0201) or on the ends (FEFCO 0204).',
          'Separate outside and inside artwork in the Studio.',
        ],
      },
      {
        title: 'Split top box vs regular slotted container',
        body: 'A regular slotted container (RSC), the standard corrugated shipping box, has four flaps at each end: two major flaps that meet in the middle and two minor flaps underneath. This template draws all of them, with slots between the flaps, a glued joint and score allowances for the board thickness you choose (up to 7 mm for double-wall).',
      },
      {
        title: 'Designing the unboxing',
        body: 'Printing the inside of a shipper is a cheap way to make unboxing memorable. In the Studio you can design the outside and inside separately, open the flaps in 3D and export PNG images for your store, social posts or a supplier brief.',
      },
    ],
    faqs: [
      { question: 'Is the split top box template free?', answer: 'Yes. The size picker and layout here are free; designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'Can I print inside the box?', answer: 'Yes. The Studio has separate outside and inside artwork for this template, and the 3D view opens the flaps so you can review both.' },
      { question: 'Is it the same as a standard shipping box?', answer: 'Yes. It is a regular slotted container (FEFCO 0201), or a centre special slotted container (FEFCO 0204) if you put the outer flaps on the ends. Ask your box maker to confirm the score allowances for the flute you choose.' },
      { question: 'Can I use inches?', answer: 'Yes. Switch the size picker to inches; the Studio opens with the same unit.' },
      { question: 'Can I download the cutting template?', answer: 'Yes. The Studio exports a 1:1 PDF with your artwork, and the cutting template on its own as SVG or DXF with cut and crease lines on separate layers.' },
    ],
    guides: ['standard-box-sizes-carton-mailer-shipping', 'how-to-measure-a-box-inside-vs-outside-dimensions', 'corrugated-shipping-box-branding', 'subscription-box-unboxing-preview'],
    tags: ['Corrugated', 'Shipping', 'E-commerce'],
    updated: '2026-10-11',
  },
];

export function getBoxTemplatePage(slug: string) {
  return BOX_TEMPLATE_PAGES.find(page => page.slug === slug);
}
