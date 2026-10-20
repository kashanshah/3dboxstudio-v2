// The box size calculator's arithmetic: from a product's size to the inside
// of the box that holds it, the outside of that box, the board to make it
// from and the box styles that suit it. Rules of thumb, stated as such on the
// page; the generator then draws the exact dieline for the chosen style.

export type Units = 'mm' | 'in';
export type Fit = 'snug' | 'standard' | 'cushioned';
export type Weight = 'light' | 'medium' | 'heavy';
export type Use = 'retail' | 'shipping' | 'gift' | 'food';
export type Size = { length: number; width: number; depth: number };

const MM_PER_IN = 25.4;

/** Room on each side of the product, in mm. */
export const FIT_PADDING: Record<Fit, { mm: number; label: string; hint: string }> = {
  snug: { mm: 2, label: 'Snug', hint: '2 mm each side: the product slides in without rattling.' },
  standard: { mm: 5, label: 'Standard', hint: '5 mm each side: room for a tissue wrap or an easy lift-out.' },
  cushioned: { mm: 20, label: 'Cushioned', hint: '20 mm each side: room for bubble wrap, crinkle paper or a foam insert.' },
};

/** Weight bands, in kg, as the page states them. */
export const WEIGHTS: Record<Weight, { label: string; hint: string }> = {
  light: { label: 'Under 0.5 kg', hint: 'About 1 lb or less' },
  medium: { label: '0.5–2 kg', hint: 'About 1–4 lb' },
  heavy: { label: 'Over 2 kg', hint: 'About 4 lb or more' },
};

export const USES: Record<Use, string> = { retail: 'Retail shelf', shipping: 'Shipping', gift: 'Gift', food: 'Food and bakery' };

/** A board to start from, by weight and use: id and caliper match the generator's presets. */
export function suggestBoard(weight: Weight, use: Use): { id: string; label: string; thickness: number } {
  if (use === 'shipping' || weight === 'heavy') return weight === 'heavy' ? { id: 'bflute', label: 'B-flute corrugated', thickness: 3 } : { id: 'eflute', label: 'E-flute corrugated', thickness: 1.5 };
  if (use === 'gift' && weight !== 'light') return { id: 'grey2', label: '2 mm greyboard (rigid)', thickness: 2 };
  return weight === 'medium' ? { id: 'sbs24', label: '24 pt SBS card', thickness: 0.61 } : { id: 'sbs18', label: '18 pt SBS card', thickness: 0.46 };
}

/** The box template pages (slugs) that suit a product, best first, with why. */
export function suggestStyles(weight: Weight, use: Use): { slug: string; why: string }[] {
  const table: Record<Use, Record<Weight, { slug: string; why: string }[]>> = {
    retail: {
      light: [{ slug: 'reverse-tuck-end-box', why: 'The standard retail carton: cheap, quick to pack, prints on every face.' }, { slug: 'straight-tuck-end-box', why: 'Both tucks on one side, for a clean front.' }, { slug: 'pillow-box', why: 'Light, small items and favours; closes without glue.' }],
      medium: [{ slug: 'snap-lock-bottom-box', why: 'A bottom that locks by hand, stronger than a tuck.' }, { slug: 'auto-lock-bottom-box', why: 'A pre-glued bottom that pops into place, fast to pack.' }, { slug: 'telescope-box', why: 'A lift-off lid for a premium unboxing.' }],
      heavy: [{ slug: 'auto-lock-bottom-box', why: 'The crash-lock bottom carries heavier products.' }, { slug: 'telescope-box', why: 'Double walls where the lid overlaps the base.' }, { slug: 'split-top-box', why: 'A corrugated carton for the heaviest goods.' }],
    },
    shipping: {
      light: [{ slug: 'mailer-box', why: 'A self-locking mailer that doubles as presentation packaging.' }, { slug: 'split-top-box', why: 'The regular slotted carton, cheapest per box.' }, { slug: 'sleeve-box', why: 'A sleeve over a tray for flat items.' }],
      medium: [{ slug: 'mailer-box', why: 'Double side walls and a locking lid for e-commerce.' }, { slug: 'split-top-box', why: 'The regular slotted carton, taped shut.' }, { slug: 'telescope-box', why: 'In E-flute, a strong two-piece shipper.' }],
      heavy: [{ slug: 'split-top-box', why: 'The regular slotted carton in B-flute or double wall.' }, { slug: 'mailer-box', why: 'In B-flute, for heavier subscription and e-commerce boxes.' }],
    },
    gift: {
      light: [{ slug: 'drawer-box', why: 'A sliding tray for jewellery, chocolates and small gifts.' }, { slug: 'pillow-box', why: 'A light favour box that closes without glue.' }, { slug: 'rigid-box', why: 'A rigid lid and base for a premium feel.' }],
      medium: [{ slug: 'rigid-box', why: 'Greyboard walls that hold their shape.' }, { slug: 'telescope-box', why: 'A lift-off lid at folding-carton cost.' }, { slug: 'drawer-box', why: 'A sliding reveal for sets.' }],
      heavy: [{ slug: 'rigid-box', why: 'Thick greyboard for heavy gift sets.' }, { slug: 'telescope-box', why: 'Full-telescope lid in E-flute for strength.' }, { slug: 'mailer-box', why: 'A presentation box that also ships.' }],
    },
    food: {
      light: [{ slug: 'gable-box', why: 'A carry handle for takeaway, favours and bakery.' }, { slug: 'cake-box', why: 'A hinged lid and optional window for pastries.' }, { slug: 'tray-box', why: 'An open tray for the counter or a sleeve.' }],
      medium: [{ slug: 'cake-box', why: 'Locking corners and a lid for cakes and cupcakes.' }, { slug: 'pizza-box', why: 'A corrugated tray and lid for hot food.' }, { slug: 'gable-box', why: 'Carry it home by the handle.' }],
      heavy: [{ slug: 'pizza-box', why: 'Corrugated board for heavier food.' }, { slug: 'cake-box', why: 'In 24 pt card or heavier for big cakes.' }, { slug: 'tray-box', why: 'In E-flute for fruit and produce.' }],
    },
  };
  return table[use][weight];
}

const round = (value: number, units: Units) => (units === 'in' ? Math.round(value * 100) / 100 : Math.round(value * 10) / 10);

/**
 * The inside of the box (the product plus the padding all round) and its
 * outside, a board's thickness further on each side. The outside is an
 * estimate: each style folds its board a little differently, and the
 * generator gives the exact figure.
 */
export function boxSize(product: Size, units: Units, fit: Fit, thicknessMm: number, paddingMm = FIT_PADDING[fit].mm) {
  const pad = units === 'in' ? paddingMm / MM_PER_IN : paddingMm;
  const board = units === 'in' ? thicknessMm / MM_PER_IN : thicknessMm;
  const inner: Size = { length: round(product.length + 2 * pad, units), width: round(product.width + 2 * pad, units), depth: round(product.depth + 2 * pad, units) };
  const outer: Size = { length: round(inner.length + 2 * board, units), width: round(inner.width + 2 * board, units), depth: round(inner.depth + 2 * board, units) };
  return { inner, outer };
}

/** The opening's long side first: a product's length and width as the box takes them. */
export function orient(product: Size): Size {
  return product.length >= product.width ? product : { ...product, length: product.width, width: product.length };
}
