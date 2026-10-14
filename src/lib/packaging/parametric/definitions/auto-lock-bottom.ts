import type { ParametricTemplate, PanelSpec } from '../format';
import { panelRegions } from './artwork-regions';
import { dustFlapHinges, tongueCurl, TUCK_END_FOLD, tuckEndDie } from './tuck-end';

// The tuck top auto-lock bottom carton, also called a crash-lock bottom: the
// tuck end's top on the front, and a bottom the gluer pre-folds so it springs
// into place when the flat carton is opened. Each side wall's bottom flap has
// a glue tab past a 45° crease at the corner where the flat carton folds; the
// tab is glued to the neighbouring front or back flap, so opening the tube
// pulls all four flaps down together. The front and back flaps reach past
// the middle and step at half their width, so each lies over the other on
// one side and they lock. Built on the tuck end die (tuck-end.ts).
//
// Layers from the outside in: the front and back flaps, the glue tabs folded
// under the side flaps, then the side flaps. The side walls are cut two boards
// short so their flaps crease above the other two layers.

const die = tuckEndDie({
  bottom: 'crash-lock',
  notes: [
    { text: 'Tuck top auto-lock (crash-lock) bottom: slit-locked top tuck, shouldered dust flaps, 15° glue flap and a thumb notch.' },
    { text: 'Glue each side flap\'s triangular tab to the front or back flap beside it, on the inside, so the bottom forms when the carton is opened.' },
    { text: 'Width, depth and height are inside sizes; panels are creased one board ({t} mm) wider and the walls three boards taller for the bottom. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the closure flaps.' },
  ],
});

/** A front or back flap: tall on the half next to its glue tab, short on the other, stepped in the middle. */
const lockFlap = (wall: 'front' | 'back'): PanelSpec => {
  const W = wall === 'front' ? 'Front' : 'Back';
  const [x, y, w] = [`x${W}`, `wallBottom${W}`, `wall${W}`];
  return {
    id: `bottom-${wall}`, label: `BOTTOM ${wall.toUpperCase()}`, kind: 'flap', layer: wall === 'front' ? 3 : 2,
    outline: [
      [x, y], [`${x} + ${w}`, y], [`${x} + ${w}`, `${y} + lockShort`],
      [`${x} + ${w} / 2 + lockRelief / 2`, `${y} + lockShort`], [`${x} + ${w} / 2 - lockRelief / 2`, `${y} + lockTall`],
      [x, `${y} + lockTall`],
    ],
    // The model keeps the flap's average reach; the step only shows on the die.
    fold: [[x, y], [`${x} + ${w}`, y], [`${x} + ${w}`, `${y} + lockReach`], [x, `${y} + lockReach`]],
  };
};

/** A side flap and, past a 45° crease at its corner by the next wall, the glue tab. */
const sideFlap = (wall: 'left' | 'right'): PanelSpec[] => {
  const W = wall === 'left' ? 'Left' : 'Right';
  const [x0, y, x1] = [`x${W}`, `wallBottom${W}`, `x${W} + wall${W}`];
  return [
    {
      id: `bottom-${wall}`, label: `BOTTOM ${wall.toUpperCase()}`, kind: 'flap', layer: 0, closureFlap: true,
      outline: [[`${x0} + dustRelief`, y], [x1, y], [`${x1} - sideFlap`, `${y} + sideFlap`], [`${x0} + dustRelief + sideTaper`, `${y} + sideFlap`]],
    },
    {
      id: `bottom-${wall}-tab`, label: `${wall.toUpperCase()} GLUE`, kind: 'glue', layer: 0, closureFlap: true,
      outline: [[x1, y], [`${x1} - dustRelief`, `${y} + sideFlap - tabChamfer`], [`${x1} - dustRelief - tabChamfer`, `${y} + sideFlap`], [`${x1} - sideFlap`, `${y} + sideFlap`]],
    },
  ];
};

export const autoLockBottomDefinition = {
  format: 'parametric-template/1',
  templateId: 'auto-lock-bottom-box',
  structureKey: 'auto-lock-bottom-v1',
  rendererKey: 'auto-lock-bottom-v1',
  description: 'Tuck top auto-lock (crash-lock) bottom carton: top tuck on the front, a pre-glued bottom that locks itself.',
  ...die,
  derived: [
    ['topOnFront', 1], ['topOnBack', 0], ['topOnLeft', 0], ['topOnRight', 0],
    ...die.derived,
    // The front and back flaps overlap past the middle and step at half their
    // width: tall on one half, short on the other, so they lock in a Z.
    ['lockOverlap', 'clamp(0.2 * depth, 5, 15)'],
    ['lockStep', '0.15 * depth'],
    ['lockTall', '(depth + lockOverlap) / 2 + lockStep'],
    ['lockShort', '(depth + lockOverlap) / 2 - lockStep'],
    ['lockReach', '(lockTall + lockShort) / 2'],
    ['lockRelief', 'tuckInset'],
    // Side flaps meet the glue tab's 45° crease at their full depth, stay clear
    // of each other across the width and stay within the tall half they glue to.
    ['sideFlap', 'max(6, min(0.45 * width, width / 2 - t - 1.5, wallLeft - dustRelief - 5, lockTall, wallFront / 2 - lockRelief))'],
    ['sideTaper', 'min(4, 0.15 * sideFlap)'],
    ['tabChamfer', 'min(4, 0.2 * sideFlap)'],
  ],
  adjustable: [
    ...die.adjustable!,
    { key: 'sideFlap', label: 'Bottom side flaps', min: 6, max: 'max(6, min(width / 2 - t - 1.5, wallLeft - dustRelief - 5, lockTall, wallFront / 2 - lockRelief))' },
  ],
  panels: [
    ...die.panels,
    lockFlap('front'),
    lockFlap('back'),
    ...sideFlap('left'),
    ...sideFlap('right'),
  ],
  validations: [
    ...die.validations!,
    { require: 'depth >= 20', message: 'The depth is too small for the bottom flaps to lock. Use a depth of at least 20 mm.' },
    { require: 'width >= 30', message: 'The width is too small for the bottom\'s side flaps and glue tabs. Use a width of at least 30 mm.' },
  ],
  // Folded from the cutting template: the body wraps round with the glue flap
  // stuck inside the back. At the bottom every flap swings up from below, so
  // they close from the inside layer out: the glue tabs turn under their side
  // flaps, as the gluer folds them, the side flaps close, then the front flap
  // and last the back, outermost where the two overlap. The top closes like
  // the straight tuck end's.
  fold: {
    ...TUCK_END_FOLD,
    motions: [
      ['turnWalls', 'stage(formation, 0, 0.6) * (pi / 2)'],
      ['turnBack', 'stage(formation, 0.15, 0.75) * (pi / 2)'],
      ['turnTabs', 'stage(formation, 0.38, 0.54) * pi'],
      ['turnSides', 'stage(formation, 0.5, 0.68) * (pi / 2)'],
      ['turnFront', 'stage(formation, 0.6, 0.78) * (pi / 2)'],
      ['turnBackFlap', 'stage(formation, 0.66, 0.84) * (pi / 2)'],
      ['turnTopDust', 'stage(formation, 0.78, 0.88) * (pi / 2)'],
      ['turnTopPrefold', 'stage(formation, 0.88, 0.94) * (pi / 2)'],
      ['turnTop', 'stage(formation, 0.9, 1) * (pi / 2)'],
      // The tuck slides into the back past the glue flap stuck there.
      ['topClear', 'foldT * 2.2'],
    ],
    hinges: [
      { child: 'left', parent: 'front', angle: 'turnWalls' },
      { child: 'right', parent: 'front', angle: 'turnWalls' },
      { child: 'back', parent: 'right', angle: 'turnBack' },
      { child: 'glue', parent: 'left', angle: 'turnBack', setback: 'foldT * 1.1' },
      { child: 'top', parent: 'front', angle: 'turnTop' },
      { child: 'top-tuck', parent: 'top', angle: tongueCurl('turnTopPrefold', 'turnTop', 'depth', 'topTongue', 'topClear'), setback: 'topClear' },
      ...dustFlapHinges('crash-lock', () => 'turnTopDust', 'foldT * 1.1'),
      { child: 'bottom-front', parent: 'front', angle: 'turnFront', setback: 'foldT' },
      { child: 'bottom-back', parent: 'back', angle: 'turnBackFlap' },
      // The side flaps rest above the glue tabs turned under them, which take
      // a board and the bend's own thickness.
      { child: 'bottom-left', parent: 'left', angle: 'turnSides', setback: 'foldT * 2.6' },
      { child: 'bottom-right', parent: 'right', angle: 'turnSides', setback: 'foldT * 2.6' },
      { child: 'bottom-left-tab', parent: 'bottom-left', angle: '-turnTabs' },
      { child: 'bottom-right-tab', parent: 'bottom-right', angle: '-turnTabs' },
    ],
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'closed',
    openingStage: 'never',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Tuck top auto-lock bottom cutting template. Your printer must approve the stock, crease allowances and glue tabs.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the bottom and closure flaps.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/auto-lock-bottom-box.webp',
    version: 1,
    name: 'Auto Lock Bottom Box',
    shortName: 'Auto-lock bottom',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Tuck top carton with a crash-lock bottom that locks itself when the carton is opened: strong enough for heavier products.',
    tags: ['carton', 'auto lock bottom', 'crash lock', 'auto bottom', 'tuck top', 'retail', 'paperboard'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 30, max: 400, step: 1, defaultValue: 100 },
      { key: 'height', label: 'Height', unit: 'mm', min: 40, max: 500, step: 1, defaultValue: 140 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 20, max: 250, step: 1, defaultValue: 70 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: panelRegions(['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom Front', 'Bottom Back']),
    defaultDimensions: { width: 100, height: 140, depth: 70, thickness: 0.5 },
  },
} satisfies ParametricTemplate;
