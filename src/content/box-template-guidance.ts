import type { PublishStatus } from '@/lib/seo';

// What each box style suits, what it doesn't, and the boards to make it
// from, shown on its /box-templates page. New copy on live pages, so it is a
// draft until approved: drafts show only on previews and in development.
// Board figures are common starting points, not specifications: the page
// says to confirm with the printer. VERIFY marks figures to check.

export type TemplateGuidance = {
  status: PublishStatus;
  bestFor: string[];
  notIdealFor: string[];
  materials: { board: string; caliper: string; use: string }[];
};

const CARD = { board: 'SBS or folding boxboard', caliper: '16–18 pt (0.41–0.46 mm)', use: 'Light products, up to about 250 g' };
const CARD_HEAVY = { board: 'SBS or folding boxboard', caliper: '20–24 pt (0.51–0.61 mm)', use: 'Heavier products and larger cartons' };
const KRAFT = { board: 'Kraft or recycled board', caliper: '18–24 pt', use: 'A natural look; prints darker and less bright' };
const E_FLUTE = { board: 'E-flute corrugated', caliper: 'about 1.5 mm', use: 'Shipping and stacking; fine enough to print well' };
const B_FLUTE = { board: 'B-flute corrugated', caliper: 'about 3 mm', use: 'Heavier contents and rougher handling' };

export const TEMPLATE_GUIDANCE: Record<string, TemplateGuidance> = {
  'reverse-tuck-end-box': {
    status: 'draft',
    bestFor: ['Cosmetics, skincare and fragrance', 'Supplements, tea and other light retail products', 'Candles, soap and small gifts', 'Products under about 500 g that sit on a shelf'],
    notIdealFor: ['Heavy products, which can push the bottom tuck open: use an [auto lock bottom](/box-templates/auto-lock-bottom-box)', 'Shipping on its own without an outer carton'],
    materials: [CARD, CARD_HEAVY, KRAFT],
  },
  'straight-tuck-end-box': {
    status: 'draft',
    bestFor: ['Products with a printed window or a clean front panel', 'Cartons opened from the same side top and bottom, such as trays slid out', 'Light retail products'],
    notIdealFor: ['High-speed packing lines, where a reverse tuck is more common', 'Heavy products: the bottom tuck holds only light weights'],
    materials: [CARD, CARD_HEAVY],
  },
  'auto-lock-bottom-box': {
    status: 'draft',
    bestFor: ['Heavier retail products: bottles, jars, kits', 'Packing by hand at volume: the bottom pops into place', 'Products that would push a tuck bottom open'],
    notIdealFor: ['Very small runs, where the pre-glued bottom adds a gluing step at the printer', 'Products that ship without an outer carton'],
    materials: [CARD_HEAVY, CARD, E_FLUTE],
  },
  'snap-lock-bottom-box': {
    status: 'draft',
    bestFor: ['Medium-weight products where no gluing at the printer is wanted', 'Short runs and samples, since the bottom locks by hand', 'Bottles and jars'],
    notIdealFor: ['Fast packing: four flaps take longer than an auto lock bottom', 'Very heavy products'],
    materials: [CARD_HEAVY, CARD],
  },
  'mailer-box': {
    status: 'draft',
    bestFor: ['E-commerce and subscription boxes', 'Unboxing: the lid opens like a book', 'Apparel, cosmetics sets, books and gadgets'],
    notIdealFor: ['Heavy or bulky goods, better in a [regular slotted carton](/box-templates/split-top-box)', 'Retail shelves, where a carton takes less space'],
    materials: [E_FLUTE, B_FLUTE, { board: 'Kraft E-flute', caliper: 'about 1.5 mm', use: 'A natural brown finish, printed in one or two colours' }],
  },
  'split-top-box': {
    status: 'draft',
    bestFor: ['Shipping and storage', 'Heavy and bulky goods', 'The lowest cost per box'],
    notIdealFor: ['Presentation and unboxing: it is taped shut', 'Retail display'],
    materials: [B_FLUTE, { board: 'C-flute corrugated', caliper: 'about 4 mm', use: 'More cushioning for general shipping' }, { board: 'BC double wall', caliper: 'about 7 mm', use: 'Heavy and fragile goods' }],
  },
  'pillow-box': {
    status: 'draft',
    bestFor: ['Favours, gift cards and small jewellery', 'Soap bars and small cosmetics', 'Light, flat products'],
    notIdealFor: ['Heavy or rigid-cornered products, which do not fit the bowed shape', 'Products that must stand up on a shelf'],
    materials: [{ board: 'SBS or folding boxboard', caliper: '12–16 pt (0.30–0.41 mm)', use: 'Thin enough for the curved ends to fold cleanly' }, KRAFT],
  },
  'gable-box': {
    status: 'draft',
    bestFor: ['Bakery, takeaway and party favours', 'Gifts carried by hand', 'Retail products that hang from a hook'],
    notIdealFor: ['Heavy contents: the handle carries the weight', 'Shipping in bulk, where the roof wastes space'],
    materials: [CARD_HEAVY, KRAFT],
  },
  'drawer-box': {
    status: 'draft',
    bestFor: ['Jewellery, chocolates and small gifts', 'A sliding reveal for premium products', 'Sets of items in a tray'],
    notIdealFor: ['Heavy products, which strain the sleeve', 'High-volume packing: two parts to assemble'],
    materials: [CARD, CARD_HEAVY, { board: 'Greyboard, wrapped', caliper: '1–2 mm', use: 'A rigid drawer box for luxury products' }],
  },
  'pizza-box': {
    status: 'draft',
    bestFor: ['Pizza and flatbreads', 'Flat, hot or greasy food', 'Wide, shallow products'],
    notIdealFor: ['Retail display', 'Deep products: the walls are low'],
    materials: [E_FLUTE, B_FLUTE],
  },
  'sleeve-box': {
    status: 'draft',
    bestFor: ['Wrapping a tray, a carton or a food pack to brand it', 'Slide boxes, with a [four-corner tray](/box-templates/tray-box) inside', 'Bundling several items'],
    notIdealFor: ['Holding loose products: it is open at both ends', 'Shipping on its own'],
    materials: [CARD, CARD_HEAVY, KRAFT],
  },
  'rigid-box': {
    status: 'draft',
    bestFor: ['Luxury gifts, jewellery and watches', 'Electronics and premium products', 'Keepsake boxes that customers keep'],
    notIdealFor: ['Low cost or high volume: rigid boxes cost several times more than cartons', 'Shipping flat: they are assembled before shipping'],
    // VERIFY: greyboard thickness range and wrap paper weight.
    materials: [{ board: 'Greyboard (chipboard)', caliper: '1.5–2.5 mm', use: 'The walls; thicker for larger boxes' }, { board: 'Printed wrap paper', caliper: 'about 120–157 gsm', use: 'Glued over the greyboard' }],
  },
  'tray-box': {
    status: 'draft',
    bestFor: ['Bakery and produce trays', 'Display trays and gift set inserts', 'The tray inside a [sleeve](/box-templates/sleeve-box)'],
    notIdealFor: ['Closed packaging: it has no lid (see the [telescope box](/box-templates/telescope-box))', 'Shipping on its own'],
    materials: [CARD_HEAVY, E_FLUTE, KRAFT],
  },
  'telescope-box': {
    status: 'draft',
    bestFor: ['Apparel, shoes and gift sets', 'Subscription boxes with a lift-off lid', 'A rigid-box look at folding-carton cost'],
    notIdealFor: ['Very heavy products in card: use E-flute or a full-depth lid', 'Products that need a tamper-evident closure'],
    materials: [CARD_HEAVY, E_FLUTE, KRAFT],
  },
  'hexagon-box': {
    status: 'draft',
    bestFor: ['Candles, jars and other round products', 'Chocolates, tea, soap and small gifts', 'Shelf displays where the shape stands out'],
    notIdealFor: ['Shipping without an outer box', 'Heavy products in card: use a thicker board', 'Packing many to a carton, where hexagons waste space'],
    materials: [CARD, CARD_HEAVY, KRAFT],
  },
  'cake-box': {
    status: 'draft',
    bestFor: ['Cakes, cupcakes and pastries', 'Cookies and macarons, with a window', 'Bakery takeaway'],
    notIdealFor: ['Shipping by courier without an outer box', 'Tall tiered cakes, which need a taller, stronger box'],
    // VERIFY: food-contact grades and coatings depend on the market and the food.
    materials: [{ board: 'Food-grade SBS', caliper: '18–24 pt (0.46–0.61 mm)', use: 'Ask for food-contact board and inks' }, { board: 'Food-grade kraft', caliper: '18–24 pt', use: 'A natural look; add a greaseproof liner for buttery cakes' }],
  },
};
