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
      { label: 'Lip balm / small tube', note: 'Narrow cosmetic carton', width: 25, height: 80, depth: 25, unit: 'mm' },
      { label: 'Perfume 50 ml', note: 'Tall square carton', width: 55, height: 120, depth: 55, unit: 'mm' },
      { label: 'Supplement bottle', note: 'Square bottle carton', width: 70, height: 130, depth: 70, unit: 'mm' },
      { label: 'Tea or food carton', note: 'Flat retail carton', width: 120, height: 180, depth: 55, unit: 'mm' },
      { label: 'Soap bar', note: 'Low, wide carton', width: 95, height: 35, depth: 65, unit: 'mm' },
    ],
    geometryNote: 'Cutting template: tuck tongues, dust flaps and the glue flap are added for you. Faces are drawn at their nominal size, with no allowance for board thickness or crease compensation.',
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
        body: 'In a straight tuck end (STE) box both closures hinge from the same face, usually the back, which gives an uninterrupted front panel at the top and bottom. A reverse tuck end box puts the closures on opposite faces. That layout nests better on the press sheet, so it usually costs less to print, and it is the default choice unless the design needs a clean front edge. 3D Box Studio supports both: choose the straight tuck end box for closures on the same face.',
      },
      {
        title: 'How to measure for a tuck end box',
        body: 'Measure the product, then add a few millimetres of clearance on each side so it slides in easily. Width is the front face, depth is the side face and height runs between the two closures. Packaging suppliers often write the same box as length × width × depth (L × W × D), where L and W describe the opening and D the height. Confirm which convention your printer uses before ordering.',
      },
      {
        title: 'Before you send it to print',
        body: 'Retail cartons are usually printed on 300–400 gsm folding boxboard or SBS. The dieline here uses nominal face sizes; your printer will adjust it for the board caliper and their creasing tools. Use the dieline to design and approve the artwork, then ask the printer for their own die or a proof before the production run.',
      },
    ],
    faqs: [
      { question: 'Is the reverse tuck end template free?', answer: 'Yes. The size picker and dieline on this page are free to use. Designing artwork, saving and exporting the PDF dieline happen in the Studio, which needs a free account.' },
      { question: 'Can I download the dieline as a PDF?', answer: 'Yes, from the Studio. Open this template with your size, then use Preview & Download to export a 1:1 vector PDF with cut and crease lines, adjustable bleed and a calibration ruler.' },
      { question: 'Does the dieline include tuck flaps and dust flaps?', answer: 'Yes. The reverse tuck template draws the tuck tongues with slit locks, four shouldered dust flaps, a tapered glue flap and a thumb notch, with panels creased one board thickness wider than the inside size you enter. Artwork prints on the closure flaps too, exactly as laid out on the design grid; the glue flap stays bare.' },
      { question: 'Does it adjust for board thickness?', answer: 'No. Panels are drawn at the nominal size you enter, without caliper or crease compensation. Your printer should adapt the final die to their board and tooling.' },
      { question: 'Can I use inches?', answer: 'Yes. Switch the unit to inches in the size picker; the Studio keeps the same unit when you open the template.' },
    ],
    guides: ['how-to-measure-a-box-inside-vs-outside-dimensions', 'packaging-bleed-safe-zone-dieline', 'tuck-end-folding-carton-mockup', 'dieline-in-illustrator-vs-online-generator'],
    updated: '2026-10-06',
  },
  {
    slug: 'pizza-box',
    templateId: 'pizza-box',
    name: 'Pizza box',
    title: 'Pizza Box Template & Dieline with 3D Mockup | 3D Box Studio',
    description: 'Free pizza box template for 10, 12, 14 and 16 inch boxes. See the flat layout, add your branding, fold the box in 3D and export PNG mockups.',
    eyebrow: 'Box template',
    h1: 'Pizza box template',
    intro: 'Pick a standard pizza size or enter your own and the flat layout below updates: tray base, walls, rear-hinged lid, tuck-in lid flaps and corner tabs. Open it in the Studio to brand the lid, fold the box in 3D and export mockups for menus, delivery apps and printer approvals.',
    fields: { width: 'Width', height: 'Wall height', depth: 'Depth' },
    presets: [
      { label: '10 inch pizza', note: 'Small', width: 10, height: 1.75, depth: 10, unit: 'in' },
      { label: '12 inch pizza', note: 'Medium', width: 12, height: 1.75, depth: 12, unit: 'in' },
      { label: '14 inch pizza', note: 'Large', width: 14, height: 1.75, depth: 14, unit: 'in' },
      { label: '16 inch pizza', note: 'Extra large', width: 16, height: 2, depth: 16, unit: 'in' },
      { label: '30 cm pizza', note: 'Metric', width: 305, height: 45, depth: 305, unit: 'mm' },
    ],
    geometryNote: 'Layout proof: shows the panel layout for artwork. Locking slots, vents and manufacturing allowances are not included, so get the production die from your box supplier.',
    sections: [
      {
        title: 'How a pizza box is built',
        body: 'Most pizza boxes are a single die-cut sheet of corrugated board. The base forms a shallow tray with folded walls, the lid hinges from the back wall, and flaps on the lid tuck in at the front and sides to hold it closed. Corner tabs fold inside the walls to keep the tray square.',
      },
      {
        title: 'What is on the layout',
        body: 'The template draws the panels you design on, sized from your width, depth and wall height.',
        bullets: [
          'Tray base with front, back and side walls.',
          'Lid hinged from the back wall, the main branding surface.',
          'Lid front and side tuck flaps.',
          'Four corner tabs that fold inside the tray walls.',
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
      { question: 'Is this a production-ready pizza box die?', answer: 'No. It is a layout proof for artwork and 3D review. Locking slots, vents and the allowances needed for corrugated board are not included; use your box supplier’s die for production.' },
      { question: 'Can I export the pizza box design?', answer: 'Yes. The Studio exports PNG mockups from the 3D view and a PDF of the flat layout with your artwork.' },
    ],
    guides: ['standard-box-sizes-carton-mailer-shipping', 'packaging-bleed-safe-zone-dieline', 'food-beverage-carton-shelf-preview'],
    updated: '2026-10-06',
  },
  {
    slug: 'split-top-box',
    templateId: 'split-top-box',
    name: 'Split top box',
    title: 'Split Top Box Template & 3D Shipping Box Mockup | 3D Box Studio',
    description: 'Free split top box template. Enter your size to see the flat layout with two-flap top and bottom, design the outside and inside, and preview it in 3D.',
    eyebrow: 'Box template',
    h1: 'Split top box template',
    intro: 'A six-sided box whose top is split into two hinged flaps that meet in the middle, like a shipping carton. Enter your size and the flat layout below redraws; open it in the Studio to brand the outside and inside, open the flaps in 3D and export mockups.',
    fields: { width: 'Width (front)', height: 'Height', depth: 'Depth (side)' },
    presets: [
      { label: 'Small shipper', note: 'Books, small goods', width: 300, height: 200, depth: 200, unit: 'mm' },
      { label: 'Medium shipper', note: 'General e-commerce', width: 400, height: 300, depth: 300, unit: 'mm' },
      { label: 'Large shipper', note: 'Bulky items', width: 500, height: 400, depth: 400, unit: 'mm' },
      { label: '12 × 12 × 12 in', note: 'Cube', width: 12, height: 12, depth: 12, unit: 'in' },
    ],
    geometryNote: 'Layout proof: shows the panel layout for artwork. It has two top flaps and two bottom flaps and does not include the minor flaps or allowances of a regular slotted container.',
    sections: [
      {
        title: 'What the template is for',
        body: 'Use the split top box to present shipping and subscription packaging: branded outer walls, a printed inside, and two lid flaps that open from the centre. It is a visual template for design and review rather than a corrugated production die.',
      },
      {
        title: 'What is on the layout',
        body: 'The template draws the panels you can design on from your width, height and depth.',
        bullets: [
          'Four walls in one strip with a glue flap.',
          'Two top flaps that meet in the middle of the lid.',
          'Two bottom flaps that close the base.',
          'Separate outside and inside artwork in the Studio.',
        ],
      },
      {
        title: 'Split top box vs regular slotted container',
        body: 'A regular slotted container (RSC), the standard corrugated shipping box, has four flaps at each end: two major flaps that meet in the middle and two minor flaps underneath. This template shows the two meeting flaps, which is what customers see when they open the box. Your box supplier will add the minor flaps and corrugated allowances.',
      },
      {
        title: 'Designing the unboxing',
        body: 'Printing the inside of a shipper is a cheap way to make unboxing memorable. In the Studio you can design the outside and inside separately, open the flaps in 3D and export PNG images for your store, social posts or a supplier brief.',
      },
    ],
    faqs: [
      { question: 'Is the split top box template free?', answer: 'Yes. The size picker and layout here are free; designing, saving and exporting happen in the Studio with a free account.' },
      { question: 'Can I print inside the box?', answer: 'Yes. The Studio has separate outside and inside artwork for this template, and the 3D view opens the flaps so you can review both.' },
      { question: 'Is it the same as a standard shipping box?', answer: 'It is close in appearance, but the template only has the two flaps that meet in the middle at each end. Use your supplier’s RSC die for production.' },
      { question: 'Can I use inches?', answer: 'Yes. Switch the size picker to inches; the Studio opens with the same unit.' },
    ],
    guides: ['standard-box-sizes-carton-mailer-shipping', 'how-to-measure-a-box-inside-vs-outside-dimensions', 'corrugated-shipping-box-branding', 'subscription-box-unboxing-preview'],
    updated: '2026-10-06',
  },
];

export function getBoxTemplatePage(slug: string) {
  return BOX_TEMPLATE_PAGES.find(page => page.slug === slug);
}
