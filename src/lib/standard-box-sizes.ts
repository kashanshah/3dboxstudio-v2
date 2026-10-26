// The standard box sizes chart: common stock sizes by kind of box, and the
// arithmetic of the "find a box that fits" tool. Typical sizes, not a
// specification; the page says suppliers differ and to confirm their inside
// sizes. Kept in line with the guide at /blog/standard-box-sizes-carton-mailer-shipping.

export type ChartUnits = 'in' | 'mm';
export type ChartSize = { length: number; width: number; depth: number };

/** A box template page and its generator style, to make a chart size into a dieline. */
type Template = { slug: string; styleId: string };
const SHIPPING: Template = { slug: 'split-top-box', styleId: 'shipping-box-rsc' };
const MAILER: Template = { slug: 'mailer-box', styleId: 'mailer-box' };
const PIZZA: Template = { slug: 'pizza-box', styleId: 'pizza-box' };
const CARTON: Template = { slug: 'reverse-tuck-end-box', styleId: 'reverse-tuck-end' };

export type ChartBox = ChartSize & {
  name: string;
  use: string;
  units: ChartUnits;
  /** Inside, as stock sizes are quoted, or outside, as pallet-sized metric cartons are. */
  measure: 'inner' | 'outer';
  template: Template;
};

export type ChartGroup = { id: string; title: string; intro: string; boxes: ChartBox[] };

const inches = (template: Template, rows: [string, number, number, number, string][]): ChartBox[] =>
  rows.map(([name, length, width, depth, use]) => ({ name, length, width, depth, use, units: 'in', measure: 'inner', template }));
const millimetres = (template: Template, measure: ChartBox['measure'], rows: [string, number, number, number, string][]): ChartBox[] =>
  rows.map(([name, length, width, depth, use]) => ({ name, length, width, depth, use, units: 'mm', measure, template }));

export const BOX_SIZE_GROUPS: ChartGroup[] = [
  {
    id: 'small-medium-large',
    title: 'Small, medium and large boxes',
    intro: 'The stock corrugated boxes sold for moving and shipping. Sizes vary a little by supplier; these are typical inside sizes.',
    boxes: inches(SHIPPING, [
      ['Small box', 16, 12, 12, 'Books, tins, heavy small items'],
      ['Medium box', 18, 18, 16, 'Kitchenware, toys, small appliances'],
      ['Large box', 18, 18, 24, 'Bedding, lamps, light bulky items'],
      ['Extra large box', 24, 18, 24, 'Pillows, coats, very light bulky items'],
    ]),
  },
  {
    id: 'shipping',
    title: 'Shipping box sizes',
    intro: 'Regular slotted cartons that most corrugated suppliers stock. Cubes are the easiest to find in every size.',
    boxes: inches(SHIPPING, [
      ['6 in cube', 6, 6, 6, 'Mugs, candles, small gifts'],
      ['8 × 6 × 4 in', 8, 6, 4, 'Cosmetics, phone accessories'],
      ['8 in cube', 8, 8, 8, 'Jars, small electronics'],
      ['10 × 8 × 6 in', 10, 8, 6, 'Shoes for children, gift sets'],
      ['10 in cube', 10, 10, 10, 'Plants, homeware'],
      ['12 × 10 × 8 in', 12, 10, 8, 'Small appliances, multi-item orders'],
      ['12 in cube', 12, 12, 12, 'Homeware, bundles'],
      ['14 in cube', 14, 14, 14, 'Larger bundles, cushions'],
      ['16 × 12 × 8 in', 16, 12, 8, 'Shoes, folded textiles'],
    ]),
  },
  {
    id: 'mailer',
    title: 'Mailer box dimensions',
    intro: 'Flat, folded corrugated mailers for e-commerce, apparel and subscription boxes, quoted as inside sizes.',
    boxes: inches(MAILER, [
      ['6 × 4 × 2 in mailer', 6, 4, 2, 'Jewellery, cosmetics samples'],
      ['9 × 6 × 2 in mailer', 9, 6, 2, 'Small accessories, books'],
      ['10 × 8 × 4 in mailer', 10, 8, 4, 'Candles, small gift sets'],
      ['12 × 9 × 4 in mailer', 12, 9, 4, 'Apparel, subscription boxes'],
      ['14 × 10 × 4 in mailer', 14, 10, 4, 'Folded clothing, larger kits'],
    ]),
  },
  {
    id: 'metric',
    title: 'Standard box sizes in cm',
    intro: 'Outside North America, cartons are sized in millimetres to fill a pallet with no overhang. These footprints divide a 1200 × 800 mm Euro pallet, and are outside sizes.',
    boxes: millimetres(SHIPPING, 'outer', [
      ['300 × 200 × 150 mm', 300, 200, 150, '16 per layer on a Euro pallet'],
      ['300 × 200 × 200 mm', 300, 200, 200, '16 per layer on a Euro pallet'],
      ['400 × 300 × 200 mm', 400, 300, 200, '8 per layer on a Euro pallet'],
      ['400 × 300 × 300 mm', 400, 300, 300, '8 per layer on a Euro pallet'],
      ['600 × 400 × 300 mm', 600, 400, 300, '2 per layer on a Euro pallet'],
      ['600 × 400 × 400 mm', 600, 400, 400, '2 per layer on a Euro pallet'],
    ]),
  },
  {
    id: 'pizza',
    title: 'Pizza box sizes',
    intro: 'Named after the pizza they hold: the base is about the pizza\'s diameter each way, with walls 1.75 to 2 in high.',
    boxes: inches(PIZZA, [
      ['10 in pizza box', 10, 10, 1.75, 'Small pizza'],
      ['12 in pizza box', 12, 12, 1.75, 'Medium pizza'],
      ['14 in pizza box', 14, 14, 1.75, 'Large pizza'],
      ['16 in pizza box', 16, 16, 2, 'Extra large pizza'],
    ]),
  },
  {
    id: 'retail',
    title: 'Retail carton sizes',
    intro: 'Folding cartons are sized to the product, so these are typical proportions rather than stock sizes.',
    boxes: millimetres(CARTON, 'inner', [
      ['Lip balm carton', 25, 25, 80, 'Lip balm, small tubes'],
      ['Bar soap carton', 95, 65, 35, 'Bar soap'],
      ['Perfume carton', 55, 55, 120, '50 ml perfume'],
      ['Supplement carton', 70, 70, 130, 'Supplement bottles'],
      ['Tea carton', 120, 55, 180, 'Tea, dry food'],
    ]),
  },
];

const MM_PER_IN = 25.4;
/** Single-wall corrugated, about 4 mm a wall: the outside of a metric carton less this on each side is its inside. */
export const CORRUGATED_WALL_MM = 4;

const toMm = (box: ChartSize, units: ChartUnits): ChartSize => units === 'mm' ? box : { length: box.length * MM_PER_IN, width: box.width * MM_PER_IN, depth: box.depth * MM_PER_IN };
const sorted = (size: ChartSize) => [size.length, size.width, size.depth].sort((a, b) => b - a);
const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

/** A box's size in inches and in cm, for the chart's two columns. */
export function bothUnits(box: ChartBox): { in: string; cm: string } {
  const mm = toMm(box, box.units);
  const inch = box.units === 'in' ? box : { length: round(mm.length / MM_PER_IN, 1), width: round(mm.width / MM_PER_IN, 1), depth: round(mm.depth / MM_PER_IN, 1) };
  const cm = { length: round(mm.length / 10, 1), width: round(mm.width / 10, 1), depth: round(mm.depth / 10, 1) };
  const show = (size: ChartSize) => `${size.length} × ${size.width} × ${size.depth}`;
  return { in: show(inch), cm: show(cm) };
}

/** The space inside a chart box, in mm. */
export function insideMm(box: ChartBox): ChartSize {
  const mm = toMm(box, box.units);
  if (box.measure === 'inner') return mm;
  const wall = 2 * CORRUGATED_WALL_MM;
  return { length: mm.length - wall, width: mm.width - wall, depth: mm.depth - wall };
}

/** Volume in litres and cubic feet, from the inside. */
export function volume(box: ChartBox): { litres: number; cubicFeet: number } {
  const inside = insideMm(box);
  const litres = inside.length * inside.width * inside.depth / 1e6;
  return { litres: round(litres, 1), cubicFeet: round(litres / 28.3168, 2) };
}

export type FitResult = { box: ChartBox; emptyShare: number };

/**
 * The chart boxes a product fits, with the room on each side, smallest
 * first. The product may turn any way in the box. Sizes in mm.
 */
export function boxesThatFit(product: ChartSize, paddingMm: number, groups = BOX_SIZE_GROUPS, limit = 5): FitResult[] {
  const need = sorted(product).map(value => value + 2 * paddingMm);
  const productVolume = product.length * product.width * product.depth;
  return groups.flatMap(group => group.boxes)
    .map(box => ({ box, inside: sorted(insideMm(box)) }))
    .filter(({ inside }) => inside.every((value, index) => value >= need[index]))
    .map(({ box, inside }) => ({ box, emptyShare: 1 - productVolume / (inside[0] * inside[1] * inside[2]) }))
    .sort((a, b) => a.emptyShare - b.emptyShare)
    .slice(0, limit);
}

/** The template page that draws a chart box, with its size filled in. */
export function chartBoxHref(box: ChartBox): string {
  const query = new URLSearchParams({ style: box.template.styleId, l: String(box.length), w: String(box.width), d: String(box.depth), u: box.units, mode: box.measure });
  return `/box-templates/${box.template.slug}?${query}`;
}
