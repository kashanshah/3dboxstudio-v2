import type { Expr } from '../expression';
import type { HingeSpec, ModelPanelSpec, OutlineEntry, ParametricTemplate, PanelSpec } from '../format';
import { panelRegions } from './artwork-regions';
import { finish, tray, trayHinges } from './rigid-lid-base';

// A drawer box: a tray that slides in and out of a sleeve, like a matchbox.
// Both are cut side by side on one sheet.
//
// The tray is the rigid box's base tray (rigid-lid-base.ts): a bottom and
// four walls, ears on the front and back walls that wrap the corners inside
// the side walls, and a turn-in on every wall that folds over inside it, so
// the walls are double and need no glue. The sleeve is a glued tube open at
// both ends, laid out like the sleeve box: a glue flap, then the left side,
// bottom, right side and top. Its top has a half-round thumb notch at each
// open end, to push the tray out from either side.
//
// Width, depth and height are the inside of the tray; the drawer slides out
// along the depth. The sleeve fits round the tray with a little play.

/** Points along each thumb notch in the 3D model, so the notch shows: odd, so no strip ends in a point. */
const NOTCH_STEPS = 5;
const notchSteps = Array.from({ length: NOTCH_STEPS }, (_, i) => i);
type End = { id: 'back' | 'front'; y: string; sign: '+' | '-' };
// On the sheet the sleeve's top runs from sy0 (its back end) to sy1 (its front end).
const ENDS: End[] = [{ id: 'back', y: 'sy0', sign: '+' }, { id: 'front', y: 'sy1', sign: '-' }];

/** The notch's edge at x: how far into the top it reaches from the end. */
const notchDepth = (x: string) => `sqrt(max(0, notchR * notchR - pow(${x} - notchX, 2)))`;
const sliceX = (i: number) => `notchX - notchR + ${i} * 2 * notchR / ${NOTCH_STEPS}`;

/** The sleeve's top: a rectangle with a half-round notch cut into each end. */
const sleeveTop: PanelSpec = {
  id: 'sleeveTop', label: 'SLEEVE TOP', kind: 'body', layer: 1,
  outline: [
    ['xTop', 'sy0'],
    ['notchX - notchR', 'sy0'],
    { arc: { center: ['notchX', 'sy0'], radius: 'notchR', from: 180, to: 0, segments: 12 } },
    ['xTop + topW', 'sy0'],
    ['xTop + topW', 'sy1'],
    ['notchX + notchR', 'sy1'],
    { arc: { center: ['notchX', 'sy1'], radius: 'notchR', from: 0, to: -180, segments: 12 } },
    ['xTop', 'sy1'],
  ] as OutlineEntry[],
  fold: [['xTop', 'sy0'], ['xTop + topW', 'sy0'], ['xTop + topW', 'sy1'], ['xTop', 'sy1']],
};

/**
 * The top in 3D, as pieces round its notches so they show: a strip either
 * side of the notches, the strip between them, and at each end slices
 * filling the board beside the notch's curve.
 */
const topPieces = (): { panels: ModelPanelSpec[]; hinges: HingeSpec[] } => {
  const [l, r] = ['notchX - notchR', 'notchX + notchR'];
  const [y0, y1] = ['sy0 + notchR', 'sy1 - notchR'];
  const panels: ModelPanelSpec[] = [
    { id: 'sleeveTop-l', of: 'sleeveTop', outline: [['xTop', 'sy0'], [l, 'sy0'], [l, 'sy1'], ['xTop', 'sy1']] },
    { id: 'sleeveTop-m', of: 'sleeveTop', outline: [[l, y0], [r, y0], [r, y1], [l, y1]] },
    { id: 'sleeveTop-r', of: 'sleeveTop', outline: [[r, 'sy0'], ['xTop + topW', 'sy0'], ['xTop + topW', 'sy1'], [r, 'sy1']] },
    ...ENDS.flatMap(end => notchSteps.map((i): ModelPanelSpec => {
      const [a, b] = [sliceX(i), sliceX(i + 1)];
      const inner = end.id === 'back' ? y0 : y1;
      return { id: `sleeveTop-${end.id}${i}`, of: 'sleeveTop', outline: [[a, `${end.y} ${end.sign} ${notchDepth(a)}`], [b, `${end.y} ${end.sign} ${notchDepth(b)}`], [b, inner], [a, inner]] };
    })),
  ];
  const hinges: HingeSpec[] = [
    { child: 'sleeveTop-l', parent: 'sleeveRight', angle: 'turnTop' },
    { child: 'sleeveTop-m', parent: 'sleeveTop-l', angle: 0, sharp: true },
    { child: 'sleeveTop-r', parent: 'sleeveTop-m', angle: 0, sharp: true },
    ...ENDS.flatMap(end => notchSteps.map((i): HingeSpec => ({ child: `sleeveTop-${end.id}${i}`, parent: 'sleeveTop-m', angle: 0, sharp: true }))),
  ];
  return { panels, hinges };
};

const top = topPieces();

/** A placement: the tray's turn (printed side down, so its walls fold up) moved to (x, y, z) for the panel centre (cx, cy). */
const placed = (cx: Expr, cy: Expr, x: Expr, y: Expr, z: Expr): Expr[] =>
  [-1, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, `${x} + (${cx})`, y, `${z} - (${cy})`, 1];

export const drawerBoxDefinition = {
  format: 'parametric-template/1',
  templateId: 'drawer-box',
  structureKey: 'drawer-v1',
  rendererKey: 'drawer-v1',
  description: 'Drawer box: a double-walled tray with corner ears and turn-ins that slides in and out of a glued sleeve with thumb notches.',
  parameters: {
    width: { fallback: 120, min: 1 },
    height: { fallback: 40, min: 1 },
    depth: { fallback: 80, min: 1 },
    thickness: { fallback: 0.5, min: 0.3, max: 2 },
  },
  derived: [
    ['t', 'thickness'],
    // The tray, as the rigid box's base: cut a board wider than the inside
    // for the turn-ins lying inside the walls.
    ['baseBoard', 't'],
    ['baseW', 'width + 2 * t'], ['baseD', 'depth + 3 * t'], ['baseH', 'height + t'],
    ['turnIn', 'clamp(0.3 * height, 8, 18)'],
    ['baseTurn', 'max(4, min(turnIn, baseH - 3 * t - 2))'],
    ['baseEar', 'min(depth / 3, 20)'], ['baseEarTaper', 'min((baseH - t) / 3, baseEar * 0.4)'],
    // The sleeve fits round the tray's outside with play on each side and
    // above, and is as long as the tray.
    ['clearance', 'max(0.5, t)'],
    ['innerW', 'baseW + 2 * t + 2 * clearance'],
    ['innerH', 'baseH + 2 * t + clearance'],
    ['sleeveL', 'baseD + 2 * t'],
    ['glue', 'clamp(0.3 * min(innerW, innerH) + 4, 10, 15)'],
    ['glueCut', 't + 1'],
    ['glueTaper', 'glue * tan(15 * pi / 180)'],
    // Crease to crease; the top, which the glue flap is stuck to, takes half a board less.
    ['sideW', 'innerH + t'], ['bottomW', 'innerW + t'], ['topW', 'innerW + t / 2'],
    ['notchR', 'max(3, min(12, innerW / 5, sleeveL / 6))'],
    // Sheet: the tray on the left, the sleeve on the right, both centred on one line.
    ['baseX0', 'max(baseH + baseTurn, baseEar)'],
    ['baseY0', 'baseH + baseTurn'],
    ['sleeveX0', 'baseX0 + baseW + max(baseH + baseTurn, baseEar) + 10'],
    ['sy0', 'max(0, baseY0 + baseD / 2 - sleeveL / 2)'], ['sy1', 'sy0 + sleeveL'],
    ['xLeft', 'sleeveX0 + glue'], ['xBottom', 'xLeft + sideW'], ['xRight', 'xBottom + bottomW'], ['xTop', 'xRight + sideW'],
    ['notchX', 'xTop + topW / 2'],
  ],
  adjustable: [
    { key: 'turnIn', label: 'Turn-ins', min: 4, max: 'max(4, min(30, baseH - 3 * t - 2))' },
    { key: 'clearance', label: 'Sleeve play', min: 0.2, max: 5 },
    { key: 'notchR', label: 'Thumb notch', min: 3, max: 'max(3, min(25, innerW / 3, sleeveL / 3))' },
    { key: 'glue', label: 'Glue flap', min: 6, max: 'max(6, min(30, innerW / 2))' },
  ],
  panels: [
    ...tray('base').map(finish),
    { id: 'sleeveGlue', label: 'SLEEVE GLUE', kind: 'glue', layer: 0, outline: [
      ['xLeft', 'sy0 + glueCut'], ['xLeft', 'sy1 - glueCut'],
      ['sleeveX0', 'sy1 - glueCut - glueTaper'], ['sleeveX0', 'sy0 + glueCut + glueTaper'],
    ] },
    { id: 'sleeveLeft', label: 'SLEEVE LEFT', kind: 'body', layer: 1, rect: ['xLeft', 'sy0', 'sideW', 'sleeveL'] },
    { id: 'sleeveBottom', label: 'SLEEVE BOTTOM', kind: 'body', layer: 1, rect: ['xBottom', 'sy0', 'bottomW', 'sleeveL'] },
    { id: 'sleeveRight', label: 'SLEEVE RIGHT', kind: 'body', layer: 1, rect: ['xRight', 'sy0', 'sideW', 'sleeveL'] },
    sleeveTop,
  ],
  validations: [
    { require: 'height >= max(15, 6 * t)', message: 'The drawer is too shallow for its turn-ins. Use a height of at least {max(15, 6 * t)} mm.' },
    { require: 'width >= 30 && depth >= 30', message: 'The drawer is too small for its corner ears. Use a width and depth of at least 30 mm.' },
  ],
  notes: [
    { text: 'Drawer box: a tray with corner ears and turn-ins, and a sleeve glued into a tube with a thumb notch at each end. The sleeve fits round the tray with {clearance} mm play.' },
    { text: 'Width, depth and height are the inside of the tray, on {t} mm board; the drawer slides out along the depth. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the turn-ins.' },
  ],
  // The tray folds up as the rigid box's base does, and the sleeve folds
  // into a tube beside it. Then the sleeve moves behind the tray and slides
  // on over it; opening pulls the drawer out of the front.
  fold: {
    root: 'bottom',
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.06))',
    matrix: placed('bottom.x + bottom.width / 2', 'bottom.y + bottom.height / 2', 0, 'floor + trayLift', 'pull'),
    motions: [
      ['turnWalls', 'stage(formation, 0, 0.25) * (pi / 2)'],
      ['turnEars', 'stage(formation, 0.15, 0.35) * (pi / 2)'],
      ['turnSides', 'stage(formation, 0.3, 0.5) * (pi / 2)'],
      ['turnIns', 'stage(formation, 0.45, 0.6) * pi'],
      ['resting', 'foldResting'],
      ['turnSleeve', 'stage(formation, 0.05, 0.35) * (pi / 2)'],
      ['turnGlue', 'stage(formation, 0.3, 0.45) * (pi / 2)'],
      ['turnTop', 'stage(formation, 0.4, 0.6) * (pi / 2)'],
      // The whole box stands on the floor, centred on the closed sleeve.
      ['floor', '-(innerH + 2 * foldT) / 2'],
      // The sleeve moves round behind the tray, then slides on over it; the
      // tray rises a board to rest on the sleeve's bottom.
      ['across', 'stage(formation, 0.62, 0.8)'],
      ['slideOn', 'stage(formation, 0.8, 1)'],
      ['trayLift', 'across * foldT * 1.05'],
      ['trayCx', 'bottom.x + bottom.width / 2'], ['trayCy', 'bottom.y + bottom.height / 2'],
      ['sleeveCx', 'sleeveBottom.x + sleeveBottom.width / 2'], ['sleeveCy', 'sleeveBottom.y + sleeveBottom.height / 2'],
      ['behind', '-(sleeveL + 15)'],
      ['sleeveX', '(1 - across) * (trayCx - sleeveCx)'],
      ['sleeveZ', '(1 - across) * (sleeveCy - trayCy) + across * (1 - slideOn) * behind'],
      // Opening pulls the drawer out of the sleeve's front.
      ['pull', 'stage(opening, 0, 1) * sleeveL * 0.6'],
    ],
    hinges: [
      ...trayHinges('base'),
      { child: 'sleeveLeft', parent: 'sleeveBottom', angle: 'turnSleeve' },
      { child: 'sleeveRight', parent: 'sleeveBottom', angle: 'turnSleeve' },
      { child: 'sleeveGlue', parent: 'sleeveLeft', angle: 'turnGlue', setback: 'foldT * 1.1' },
      ...top.hinges,
    ],
    pieces: [{ root: 'sleeveBottom', matrix: placed('sleeveCx', 'sleeveCy', 'sleeveX', 'floor', 'sleeveZ') }],
    modelPanels: top.panels,
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'lid_from_back',
    openingStage: 'always',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Drawer box cutting template: a tray with corner ears and turn-ins, and a sleeve with a glue flap and thumb notches. Your printer must approve the stock and allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the turn-ins.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/drawer-box.webp',
    version: 1,
    name: 'Drawer Box',
    shortName: 'Drawer',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Sliding drawer box: a tray that pulls out of a sleeve, like a matchbox. For jewellery, chocolates, tea, cosmetics and gift sets.',
    tags: ['drawer box', 'slide box', 'sleeve and tray', 'matchbox', 'gift box', 'tray', 'sleeve'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 30, max: 400, step: 1, defaultValue: 120 },
      { key: 'height', label: 'Height', unit: 'mm', min: 15, max: 200, step: 1, defaultValue: 40 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 30, max: 400, step: 1, defaultValue: 80 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: panelRegions(['Sleeve Top', 'Sleeve Bottom', 'Sleeve Left', 'Sleeve Right', 'Front', 'Back', 'Left', 'Right', 'Bottom']),
    defaultDimensions: { width: 120, height: 40, depth: 80, thickness: 0.5 },
    fixedOpeningMode: 'lid_from_back',
  },
} satisfies ParametricTemplate;
