import type { Expr } from '../expression';
import type { HingeSpec, LineSpec, PanelSpec, ParametricTemplate } from '../format';
import { BOX_FACES, pairedPanelRegions, panelRegions } from './artwork-regions';

// The e-commerce mailer (FEFCO 0427, roll end tuck top), one piece and no
// glue. The front and back walls carry ears that fold in along the sides.
// Each side wall is folded double over a narrow roll strip: its inner layer
// drops down inside and locks with two tabs into slots in the base, trapping
// the ears between the two layers. The lid hinges on the back wall; its front
// tuck slides down inside the front wall and its side flaps inside the
// double side walls. Structurally it is the pizza box (pizza-box.ts) with the
// double wall moved from the front to the sides.
//
// Width (across the front), depth (front to back) and height are inside
// sizes; t is the board thickness. The sheet's columns are the left inner
// wall, roll strip and outer wall | base | right outer wall, roll strip and
// inner wall; its rows the lid tuck, lid, back wall, base and front wall.

type Corner = [Expr, Expr];
type Quad = [Corner, Corner, Corner, Corner];

/** An ear on a front or back wall's side edge, tapered at its free top so it slides in. */
const ear = (wall: 'front' | 'back', side: 'left' | 'right'): PanelSpec => {
  const [edge, tip] = side === 'left' ? ['x0', 'x0 - ear'] : ['x0 + W', 'x0 + W + ear'];
  // The front wall's top is at the bottom of the sheet, the back wall's at the top.
  const [root, free, taper] = wall === 'front'
    ? ['frontTop + t', 'frontTop + height', '-earTaper']
    : ['y0 - t', 'y0 - height', 'earTaper'];
  const Side = side === 'left' ? 'Left' : 'Right';
  return {
    id: `${wall}${Side}Ear`, label: `${wall.toUpperCase()} ${side.toUpperCase()} EAR`, kind: 'flap',
    outline: [[edge, root], [edge, free], [tip, `${free} + ${taper}`], [tip, root]],
  };
};

/** A side wall's double layer: the roll strip and the inner wall with its locking tabs. */
const doubleWall = (side: 'left' | 'right'): PanelSpec[] => {
  const left = side === 'left';
  const [roll, inner] = [`${side}Roll`, `${side}Inner`];
  // The roll strip's crease on the outer wall, its crease on the inner wall,
  // and the inner wall's free edge, which carries the tabs.
  const [outerCrease, innerCrease, free] = left
    ? ['x0 - height', 'x0 - height - roll', 'x0 - height - roll - innerHeight']
    : ['x0 + W + height', 'x0 + W + height + roll', 'x0 + W + height + roll + innerHeight'];
  const tip = left ? `${free} - tabHeight` : `${free} + tabHeight`;
  // Tabs along the free edge, walked from the front end to the back end on
  // the right and back to front on the left, so the outline keeps one turning.
  const tabs = (left ? ['tabBack', 'tabFront'] : ['tabFront', 'tabBack']).flatMap((c): Corner[] => {
    const [a, b] = left ? [`${c} + half`, `${c} - half`] : [`${c} - half`, `${c} + half`];
    const [aIn, bIn] = left ? [`${c} + half - lead`, `${c} - half + lead`] : [`${c} - half + lead`, `${c} + half - lead`];
    return [[free, a], [tip, aIn], [tip, bIn], [free, b]];
  });
  const [x1, x2] = left ? [free, innerCrease] : [innerCrease, free];
  // A score bends through three boards, wider than the two-board strip: the
  // model draws it three boards wide and the inner wall one board shorter, so
  // the two layers sit apart by an ear's board.
  const rollModel: Quad = left
    ? [[`${outerCrease} - 3 * foldT`, 'inTop'], [outerCrease, 'inTop'], [outerCrease, 'inBottom'], [`${outerCrease} - 3 * foldT`, 'inBottom']]
    : [[outerCrease, 'inTop'], [`${outerCrease} + 3 * foldT`, 'inTop'], [`${outerCrease} + 3 * foldT`, 'inBottom'], [outerCrease, 'inBottom']];
  const innerModel: Quad = left
    ? [[free, 'inTop'], [`${outerCrease} - 3 * foldT`, 'inTop'], [`${outerCrease} - 3 * foldT`, 'inBottom'], [free, 'inBottom']]
    : [[`${outerCrease} + 3 * foldT`, 'inTop'], [free, 'inTop'], [free, 'inBottom'], [`${outerCrease} + 3 * foldT`, 'inBottom']];
  return [
    {
      id: roll, label: `${side.toUpperCase()} ROLL`, kind: 'flap',
      rect: [left ? innerCrease : outerCrease, 'inTop', 'roll', 'inBottom - inTop'],
      model: rollModel,
    },
    {
      id: inner, label: `${side.toUpperCase()} INNER`, kind: 'flap',
      outline: left
        ? [[x1, 'inTop'], [x2, 'inTop'], [x2, 'inBottom'], [x1, 'inBottom'], ...tabs]
        : [[x1, 'inTop'], [x2, 'inTop'], ...tabs, [x2, 'inBottom'], [x1, 'inBottom']],
      fold: [[x1, 'inTop'], [x2, 'inTop'], [x2, 'inBottom'], [x1, 'inBottom']],
      model: innerModel,
    },
  ];
};

/** A lid side flap, hinged on the lid's edge and chamfered at both ends. */
const lidFlap = (id: 'lidLeft' | 'lidRight', edge: string, tip: string): PanelSpec => ({
  id, label: id === 'lidLeft' ? 'LID LEFT' : 'LID RIGHT', kind: 'flap',
  outline: [[edge, 'lidTop'], [edge, 'backTop'], [tip, 'backTop - flapChamfer'], [tip, 'lidTop + flapChamfer']],
});

/** A slot cut through the base for one of an inner wall's locking tabs. */
const slot = (x: string, centre: string): LineSpec[] => {
  const [x1, x2, y1, y2] = [`${x} - slotHalf`, `${x} + slotHalf`, `${centre} - half - 1`, `${centre} + half + 1`];
  const corners: Corner[] = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  return corners.map((from, i) => ({ from, to: corners[(i + 1) % 4] }));
};

const layer = (id: string) => (id === 'left' || id === 'right' ? 1.5 : id === 'top' ? 2 : id.endsWith('Ear') || id.startsWith('lid') ? 0 : 1);
const closure = (spec: PanelSpec) => spec.kind === 'flap' && !spec.id.endsWith('Roll') && !spec.id.endsWith('Inner');
const finish = (spec: PanelSpec): PanelSpec => ({ ...spec, layer: layer(spec.id), ...(closure(spec) ? { closureFlap: true } : {}) });

const hinge = (child: string, parent: string, angle: Expr, setback?: Expr): HingeSpec => ({ child, parent, angle, ...(setback === undefined ? {} : { setback }) });

export const mailerBoxDefinition = {
  format: 'parametric-template/1',
  templateId: 'mailer-box',
  structureKey: 'mailer-v1',
  rendererKey: 'mailer-v1',
  description: 'One-piece corrugated mailer (FEFCO 0427): double side walls locked into the base over the ears, lid with front tuck and side flaps.',
  parameters: {
    width: { fallback: 220, min: 1 },
    height: { fallback: 80, min: 1 },
    depth: { fallback: 160, min: 1 },
    thickness: { fallback: 1.5, min: 0.3, max: 7 },
  },
  derived: [
    ['t', 'thickness'],
    ['clearance', 0.5],
    // The base is cut wider and deeper than the inside: each double side wall
    // takes up nearly three boards inside its crease, the front and back
    // walls over half a board, so the folded box keeps the entered inside.
    ['W', 'width + 5.5 * t'],
    ['D', 'depth + 1.2 * t'],
    // The roll strip lets the inner layer drop one board inside the outer
    // one, with an ear's board between them.
    ['roll', '2 * t'],
    ['innerHeight', 'height - t'],
    ['tabWidth', 'min(40, max(15, 0.12 * depth))'],
    ['tabHeight', 'max(4, 2 * t + 1)'],
    // Inner side walls fit between the front and back walls.
    ['innerInset', 't + clearance'],
    // Ears reach a good way along the sides, short of meeting in the middle.
    ['ear', 'min(height, depth / 3)'],
    ['earTaper', 'min((height - t) / 3, ear * 0.4)'],
    // Lid: rests on the walls; its flaps go down inside the double side
    // walls, and its front tuck stops short of the base, whatever the board.
    ['lidDepth', 'D'],
    ['lidTuck', 'height - 2 * t - 2'],
    ['lidFlap', 'height - 3 * t - clearance'],
    ['backHeight', 'height + t'],
    ['x0', 'height + roll + innerHeight + tabHeight'],
    ['lidTop', 'lidTuck'],
    ['backTop', 'lidTop + lidDepth'],
    ['y0', 'backTop + backHeight'],
    ['frontTop', 'y0 + D'],
    ['inTop', 'y0 + innerInset'],
    ['inBottom', 'frontTop - innerInset'],
    ['tabBack', 'y0 + D / 4'],
    ['tabFront', 'y0 + 3 * D / 4'],
    ['half', 'tabWidth / 2'],
    ['lead', 'min(1, tabHeight / 3)'],
    ['tuckChamfer', 'min(10, lidTuck / 2)'],
    ['flapChamfer', 'min(lidFlap, lidDepth / 4)'],
    // Slots for the inner walls' tabs sit one board and a little inside the
    // side creases, beyond the ears' board.
    ['slotLeft', 'x0 + 2.5 * t'],
    ['slotRight', 'x0 + W - 2.5 * t'],
    ['slotHalf', '(t + 1) / 2'],
  ],
  panels: ([
    { id: 'bottom', label: 'BOTTOM', kind: 'body', rect: ['x0', 'y0', 'W', 'D'] },
    // The front wall, lid and lid front sit upside down on the sheet relative
    // to the folded box: artwork placed on one of them alone is turned to
    // read upright on the box.
    { id: 'front', label: 'FRONT', kind: 'body', artworkRotation: 180, rect: ['x0', 'frontTop', 'W', 'height'] },
    { id: 'back', label: 'BACK', kind: 'body', rect: ['x0', 'backTop', 'W', 'backHeight'] },
    ear('front', 'left'),
    ear('front', 'right'),
    ear('back', 'left'),
    ear('back', 'right'),
    { id: 'left', label: 'LEFT', kind: 'body', rect: ['x0 - height', 'y0', 'height', 'D'] },
    { id: 'right', label: 'RIGHT', kind: 'body', rect: ['x0 + W', 'y0', 'height', 'D'] },
    ...doubleWall('left'),
    ...doubleWall('right'),
    // The lid, hinged on the back wall's top edge.
    { id: 'top', label: 'TOP', kind: 'body', artworkRotation: 180, rect: ['x0', 'lidTop', 'W', 'lidDepth'] },
    {
      id: 'lidFront', label: 'LID FRONT', kind: 'flap', artworkRotation: 180,
      outline: [['x0 + clearance', 'lidTop'], ['x0 + W - clearance', 'lidTop'], ['x0 + W - clearance - tuckChamfer', 0], ['x0 + clearance + tuckChamfer', 0]],
    },
    lidFlap('lidLeft', 'x0', 'x0 - lidFlap'),
    lidFlap('lidRight', 'x0 + W', 'x0 + W + lidFlap'),
  ] satisfies PanelSpec[]).map(finish),
  cuts: [
    ...slot('slotLeft', 'tabBack'),
    ...slot('slotLeft', 'tabFront'),
    ...slot('slotRight', 'tabBack'),
    ...slot('slotRight', 'tabFront'),
  ],
  validations: [
    { require: 'height >= max(20, 6 * t)', message: 'The height is too small for this board. Use a height of at least {max(20, 6 * t)} mm.' },
    { require: 'width >= 60 && depth >= 60', message: "The box is too small for a mailer's locking tabs. Use a width and depth of at least 60 mm." },
  ],
  notes: [
    { text: 'Mailer (FEFCO 0427): double side walls locked into the base over the ears, lid with front tuck and side flaps.' },
    { text: 'Width, depth and height are inside sizes on {t} mm board. Ask your box maker to confirm the allowances for the flute you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the flaps.' },
  ],
  // Folded the way a mailer is made: the front and back walls up, their ears
  // in, the side walls up outside the ears, then each side's inner layer
  // folds down over the ears and locks into the base; the lid's flaps fold
  // down and the lid closes over the tray, its tuck inside the front.
  fold: {
    root: 'bottom',
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.08))',
    // The sheet lies printed side down with the lid at the back.
    matrix: [-1, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, 'bottom.x + bottom.width / 2', '-height / 2', '-(bottom.y + bottom.height / 2)', 1],
    motions: [
      ['turnWalls', 'stage(formation, 0, 0.3) * (pi / 2)'],
      ['turnEars', 'stage(formation, 0.2, 0.45) * (pi / 2)'],
      ['turnSides', 'stage(formation, 0.4, 0.6) * (pi / 2)'],
      // The sides fold double: over the roll strip, then down inside.
      ['turnRoll', 'stage(formation, 0.6, 0.72) * (pi / 2)'],
      ['turnInner', 'stage(formation, 0.7, 0.85) * (pi / 2)'],
      ['turnSkirts', 'stage(formation, 0.7, 1) * (pi / 2)'],
      ['turnLid', '(1 - opening) * stage(formation, 0.6, 1) * (pi / 2)'],
      ['resting', '(6 / pi - 1.5) * foldT - foldT * 1.05'],
    ],
    hinges: [
      hinge('front', 'bottom', 'turnWalls'),
      hinge('back', 'bottom', 'turnWalls'),
      hinge('frontLeftEar', 'front', 'turnEars', 'foldT * 0.5'),
      hinge('frontRightEar', 'front', 'turnEars', 'foldT * 0.5'),
      hinge('backLeftEar', 'back', 'turnEars', 'foldT * 0.5'),
      hinge('backRightEar', 'back', 'turnEars', 'foldT * 0.5'),
      hinge('left', 'bottom', 'turnSides', 'resting'),
      hinge('right', 'bottom', 'turnSides', 'resting'),
      hinge('leftRoll', 'left', 'turnRoll'),
      hinge('rightRoll', 'right', 'turnRoll'),
      hinge('leftInner', 'leftRoll', 'turnInner'),
      hinge('rightInner', 'rightRoll', 'turnInner'),
      hinge('top', 'back', 'turnLid'),
      hinge('lidFront', 'top', 'skirtCurl(turnSkirts, turnLid, lidDepth, lidTuck, foldT * 1.1)', 'foldT * 1.1'),
      hinge('lidLeft', 'top', 'turnSkirts', 'foldT * 3.5'),
      hinge('lidRight', 'top', 'turnSkirts', 'foldT * 3.5'),
    ],
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'lid_from_back',
    openingStage: 'always',
  },
  export: {
    kind: 'cutting-template',
    summary: 'One-piece mailer cutting template with locking double side walls. Your box maker must approve the flute and allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the flaps.',
  },
  catalog: {
    thumbnail: '/images/templates/mailer-box.webp',
    version: 1,
    name: 'Mailer Box',
    shortName: 'Mailer',
    family: 'corrugated',
    category: 'Corrugated',
    description: 'Self-locking shipping and presentation mailer.',
    tags: ['mailer', 'shipping', 'corrugated', 'ecommerce', '0427', 'roll end'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 1, step: 1, defaultValue: 220 },
      { key: 'height', label: 'Height', unit: 'mm', min: 1, step: 1, defaultValue: 80 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 1, step: 1, defaultValue: 160 },
      // E flute is about 1.5 mm, B flute 3 mm.
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 7, step: 0.1, defaultValue: 1.5 },
    ],
    artworkRegions: [
      ...panelRegions(BOX_FACES),
      ...pairedPanelRegions(['Lid Front', 'Lid Left', 'Lid Right', 'Left Inner', 'Right Inner', 'Left Roll', 'Right Roll', 'Front Left Ear', 'Front Right Ear', 'Back Left Ear', 'Back Right Ear']),
    ],
    defaultDimensions: { width: 220, height: 80, depth: 160, thickness: 1.5 },
    fixedOpeningMode: 'lid_from_back',
  },
} satisfies ParametricTemplate;
