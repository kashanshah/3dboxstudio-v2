import type { Expr } from '../expression';
import type { HingeSpec, LineSpec, PanelSpec, ParametricTemplate } from '../format';
import { BOX_FACES, pairedPanelRegions, panelRegions } from './artwork-regions';

// A one-piece corrugated pizza box as made today: no glue. The front wall is
// folded double over a narrow roll strip; its inner layer drops down inside
// and locks with two tabs into slots in the base, trapping the side walls'
// front corner tabs between the two layers. The side walls' back corner tabs
// fold inside the back wall. The lid hinges on the back wall; its front tuck
// slides down inside the front, its side flaps inside the side walls. A
// finger hole across the roll strip lifts the lid.
//
// Width (across the front), depth (front to back) and wall height are inside
// sizes; t is the board thickness. The sheet's columns are left wall | base |
// right wall; its rows the lid tuck, lid, back wall, base, front wall, roll
// strip, and the inner front with its tabs.

type Corner = [Expr, Expr];

/** A side wall's corner tabs, tapered on the outer edge so they slide in. */
const cornerTabs = (side: 'left' | 'right'): PanelSpec[] => {
  const [r0, r1, a, b] = [`${side}Root0`, `${side}Root1`, `${side}TabA`, `${side}TabB`];
  return [
    { id: `${side}FrontTab`, label: `${side.toUpperCase()} FRONT TAB`, kind: 'flap', outline: [[r0, 'frontTop'], [r1, 'frontTop'], [b, 'frontTop + ear'], [a, 'frontTop + ear']] },
    { id: `${side}BackTab`, label: `${side.toUpperCase()} BACK TAB`, kind: 'flap', outline: [[a, 'y0 - ear'], [b, 'y0 - ear'], [r1, 'y0'], [r0, 'y0']] },
  ];
};

/** A lid side flap, hinged on the lid's edge and chamfered at both ends. */
const lidFlap = (id: 'lidLeft' | 'lidRight', edge: string, tip: string): PanelSpec => ({
  id, label: id === 'lidLeft' ? 'LID LEFT' : 'LID RIGHT', kind: 'flap',
  outline: [[edge, 'lidTop'], [edge, 'backTop'], [tip, 'backTop - flapChamfer'], [tip, 'lidTop + flapChamfer']],
});

/** A slot cut through the base for one of the inner front's locking tabs. */
const slot = (centre: string): LineSpec[] => {
  const [x1, x2, y1, y2] = [`${centre} - half - 1`, `${centre} + half + 1`, 'slotY - slotHalf', 'slotY + slotHalf'];
  const corners: Corner[] = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  return corners.map((from, i) => ({ from, to: corners[(i + 1) % 4] }));
};

/** The inner front's free edge, with a locking tab at each centre (right to left). */
const lockingTabs = (centres: string[]): Corner[] => centres.flatMap((c): Corner[] => [
  [`${c} + half`, 'innerBottom'], [`${c} + half - lead`, 'innerBottom + tabHeight'],
  [`${c} - half + lead`, 'innerBottom + tabHeight'], [`${c} - half`, 'innerBottom'],
]);

const layer = (id: string) => (id === 'front' || id === 'back' ? 1.5 : id === 'top' ? 2 : id.endsWith('Tab') || id.startsWith('lid') ? 0 : 1);
const closure = (spec: PanelSpec) => spec.kind === 'flap' && spec.id !== 'frontInner' && spec.id !== 'frontRoll';
const finish = (spec: PanelSpec): PanelSpec => ({ ...spec, layer: layer(spec.id), ...(closure(spec) ? { closureFlap: true } : {}) });

const hinge = (child: string, parent: string, angle: Expr, setback?: Expr): HingeSpec => ({ child, parent, angle, ...(setback === undefined ? {} : { setback }) });

export const pizzaBoxDefinition = {
  format: 'parametric-template/1',
  templateId: 'pizza-box',
  structureKey: 'pizza-box-v1',
  rendererKey: 'pizza-box-v1',
  description: 'One-piece corrugated pizza box: double front wall locked into the base, corner tabs, lid with tuck and side flaps, finger hole.',
  parameters: {
    width: { fallback: 120, min: 1 },
    height: { fallback: 180, min: 1 },
    depth: { fallback: 55, min: 1 },
    thickness: { fallback: 1.5, min: 0.3, max: 7 },
  },
  derived: [
    ['t', 'thickness'],
    ['clearance', 0.5],
    // The roll strip lets the inner layer drop one board inside the outer
    // one, with a corner tab's board between them.
    ['roll', '2 * t'],
    ['innerHeight', 'height - t'],
    ['tabWidth', 'min(40, max(20, 0.12 * width))'],
    ['tabHeight', 'max(4, 2 * t + 1)'],
    // Inner front: clear of the side walls by a board and a little play.
    ['innerInset', 't + clearance'],
    // Corner tabs reach well into the front's double wall.
    ['ear', 'min(0.9 * height, width / 4)'],
    // Lid: rests on the walls; its flaps go down inside them, and its front
    // tuck stops short of the base, whatever the board.
    ['lidDepth', 'depth - 2 * t'],
    ['lidTuck', 'height - 2 * t - 2'],
    ['lidFlap', 'height - 2 * t - clearance'],
    ['backHeight', 'height + t'],
    ['fingerHole', 'min(12, height / 3, width / 10)'],
    ['x0', 'max(height, lidFlap)'],
    ['lidTop', 'lidTuck'],
    ['backTop', 'lidTop + lidDepth'],
    ['y0', 'backTop + backHeight'],
    ['frontTop', 'y0 + depth'],
    ['rollTop', 'frontTop + height'],
    ['innerTop', 'rollTop + roll'],
    ['inL', 'x0 + innerInset'],
    ['inR', 'x0 + width - innerInset'],
    ['innerBottom', 'innerTop + innerHeight'],
    ['tabLeft', 'x0 + width / 4'],
    ['tabRight', 'x0 + 3 * width / 4'],
    ['half', 'tabWidth / 2'],
    ['lead', 'min(1, tabHeight / 3)'],
    // Corner tabs are cut a board clear of the front and back walls beside them.
    ['leftRoot0', 'x0 - height'],
    ['leftRoot1', 'x0 - height + height - t'],
    ['leftTaper', 'min((leftRoot1 - leftRoot0) / 3, ear * 0.4)'],
    ['leftTabA', 'leftRoot0 + leftTaper'],
    ['leftTabB', 'leftRoot1'],
    ['rightRoot0', 'x0 + width + t'],
    ['rightRoot1', 'x0 + width + height'],
    ['rightTaper', 'min((rightRoot1 - rightRoot0) / 3, ear * 0.4)'],
    ['rightTabA', 'rightRoot0'],
    ['rightTabB', 'rightRoot1 - rightTaper'],
    ['tuckChamfer', 'min(10, lidTuck / 2)'],
    ['flapChamfer', 'min(lidFlap, lidDepth / 4)'],
    // Slots for the inner front's tabs sit one board and a little inside the
    // front crease, beyond the corner tab's board.
    ['slotY', 'frontTop - 2.5 * t'],
    ['slotHalf', '(t + 1) / 2'],
  ],
  // Corner tabs stop short of meeting inside the front and of the lid flaps
  // beside the back wall on the sheet; the lid's tuck and flaps stay clear
  // of the base.
  adjustable: [
    { key: 'ear', label: 'Corner tabs', min: 5, max: 'max(5, min(width / 2 - t, height))' },
    { key: 'lidTuck', label: 'Lid tuck', min: 5, max: 'max(5, height - 2 * t)' },
    { key: 'lidFlap', label: 'Lid side flaps', min: 5, max: 'max(5, height - 2 * t)' },
  ],
  panels: ([
    { id: 'bottom', label: 'BOTTOM', kind: 'body', rect: ['x0', 'y0', 'width', 'depth'] },
    // The front wall, lid and lid front sit upside down on the sheet relative
    // to the folded box: artwork placed on one of them alone is turned to
    // read upright on the box.
    { id: 'front', label: 'FRONT', kind: 'body', artworkRotation: 180, rect: ['x0', 'frontTop', 'width', 'height'] },
    {
      id: 'frontRoll', label: 'FRONT ROLL', kind: 'flap', rect: ['inL', 'rollTop', 'inR - inL', 'roll'],
      // A score bends through three boards, wider than the two-board strip:
      // the model draws it three boards wide and the inner front one board
      // shorter, so the two layers sit apart by a corner tab's board.
      model: [['frontRoll.x', 'frontRoll.y'], ['frontRoll.x + frontRoll.width', 'frontRoll.y'], ['frontRoll.x + frontRoll.width', 'frontRoll.y + 3 * foldT'], ['frontRoll.x', 'frontRoll.y + 3 * foldT']],
    },
    {
      id: 'frontInner', label: 'INNER FRONT', kind: 'flap',
      outline: [['inL', 'innerTop'], ['inR', 'innerTop'], ['inR', 'innerBottom'], ...lockingTabs(['tabRight', 'tabLeft']), ['inL', 'innerBottom']],
      fold: [['inL', 'innerTop'], ['inL + (inR - inL)', 'innerTop'], ['inL + (inR - inL)', 'innerTop + innerHeight'], ['inL', 'innerTop + innerHeight']],
      model: [
        ['frontRoll.x', 'frontRoll.y + 3 * foldT'], ['frontRoll.x + frontRoll.width', 'frontRoll.y + 3 * foldT'],
        ['frontRoll.x + frontRoll.width', 'frontRoll.y + frontRoll.height + innerHeight'], ['frontRoll.x', 'frontRoll.y + frontRoll.height + innerHeight'],
      ],
    },
    { id: 'back', label: 'BACK', kind: 'body', rect: ['x0', 'backTop', 'width', 'backHeight'] },
    { id: 'left', label: 'LEFT', kind: 'body', rect: ['x0 - height', 'y0', 'height', 'depth'] },
    { id: 'right', label: 'RIGHT', kind: 'body', rect: ['x0 + width', 'y0', 'height', 'depth'] },
    ...cornerTabs('left'),
    ...cornerTabs('right'),
    // The lid, hinged on the back wall's top edge.
    { id: 'top', label: 'TOP', kind: 'body', artworkRotation: 180, rect: ['x0', 'lidTop', 'width', 'lidDepth'] },
    {
      id: 'lidFront', label: 'LID FRONT', kind: 'flap', artworkRotation: 180,
      outline: [['x0 + clearance', 'lidTop'], ['x0 + width - clearance', 'lidTop'], ['x0 + width - clearance - tuckChamfer', 0], ['x0 + clearance + tuckChamfer', 0]],
    },
    lidFlap('lidLeft', 'x0', 'x0 - lidFlap'),
    lidFlap('lidRight', 'x0 + width', 'x0 + width + lidFlap'),
  ] satisfies PanelSpec[]).map(finish),
  cuts: [
    ...slot('tabLeft'),
    ...slot('tabRight'),
    // The finger hole across the roll strip, centred on the front.
    { arc: { center: ['x0 + width / 2', 'rollTop + roll / 2'], radius: 'fingerHole', from: 0, to: 360, segments: 24 } },
  ],
  validations: [
    { require: 'height >= max(20, 6 * t)', message: 'The wall height is too small for this board. Use a wall height of at least {max(20, 6 * t)} mm.' },
    { require: 'width >= 100 && depth >= 100', message: "The box is too small for a pizza box's locking tabs and finger hole. Use a width and depth of at least 100 mm." },
  ],
  notes: [
    { text: 'One-piece corrugated pizza box: double front wall locked into the base, corner tabs trapped in the fold, lid with tuck and side flaps, finger hole.' },
    { text: 'Width, depth and wall height are inside sizes on {t} mm board. Ask your box maker to confirm the allowances for the flute you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the flaps.' },
  ],
  // Folded the way a pizza box is made: the side walls up, their corner tabs
  // in, the front and back walls up outside the tabs, then the front's inner
  // layer folds down over the tabs and locks into the base; the lid's flaps
  // fold down and the lid closes over the tray. The front and back walls and
  // the lid rest on the edges they close over; the corner tabs lie flat
  // against the inside of the walls; the lid's flaps sit one board inside the
  // side walls and its front tuck inside the double front.
  fold: {
    root: 'bottom',
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.08))',
    // The sheet lies printed side down with the lid at the back. Turning it
    // over that way puts the dieline's left wall on the viewer's right.
    matrix: [-1, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, 'bottom.x + bottom.width / 2', '-height / 2', '-(bottom.y + bottom.height / 2)', 1],
    motions: [
      ['turnSides', 'stage(formation, 0, 0.3) * (pi / 2)'],
      ['turnTabs', 'stage(formation, 0.2, 0.45) * (pi / 2)'],
      ['turnWalls', 'stage(formation, 0.4, 0.6) * (pi / 2)'],
      // The front folds double: over the roll strip, then down inside.
      ['turnRoll', 'stage(formation, 0.6, 0.72) * (pi / 2)'],
      ['turnInner', 'stage(formation, 0.7, 0.85) * (pi / 2)'],
      ['turnSkirts', 'stage(formation, 0.7, 1) * (pi / 2)'],
      ['turnLid', '(1 - opening) * stage(formation, 0.6, 1) * (pi / 2)'],
      ['resting', '(6 / pi - 1.5) * foldT - foldT * 1.05'],
    ],
    hinges: [
      hinge('left', 'bottom', 'turnSides'),
      hinge('right', 'bottom', 'turnSides'),
      hinge('front', 'bottom', 'turnWalls', 'resting'),
      hinge('back', 'bottom', 'turnWalls', 'resting'),
      hinge('leftBackTab', 'left', 'turnTabs', 'foldT * 0.5'),
      hinge('leftFrontTab', 'left', 'turnTabs', 'foldT * 0.5'),
      hinge('rightBackTab', 'right', 'turnTabs', 'foldT * 0.5'),
      hinge('rightFrontTab', 'right', 'turnTabs', 'foldT * 0.5'),
      hinge('frontRoll', 'front', 'turnRoll'),
      hinge('frontInner', 'frontRoll', 'turnInner'),
      hinge('top', 'back', 'turnLid', 'resting'),
      hinge('lidFront', 'top', 'skirtCurl(turnSkirts, turnLid, lidDepth, lidTuck, foldT * 3.5)', 'foldT * 3.5'),
      hinge('lidLeft', 'top', 'turnSkirts', 'foldT * 1.1'),
      hinge('lidRight', 'top', 'turnSkirts', 'foldT * 1.1'),
    ],
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'lid_from_back',
    openingStage: 'always',
  },
  export: {
    kind: 'cutting-template',
    summary: 'One-piece pizza box cutting template with a locking double front. Your box maker must approve the flute and allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the flaps.',
  },
  catalog: {
    thumbnail: '/images/templates/pizza-box.webp',
    version: 1,
    name: 'Pizza Box',
    shortName: 'Pizza box',
    family: 'corrugated',
    category: 'Food',
    description: 'One-piece corrugated pizza box: double front locked into the base, corner tabs, lid with tuck and side flaps.',
    tags: ['pizza', 'food', 'corrugated', 'takeout'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 1, step: 1, defaultValue: 305 },
      { key: 'height', label: 'Height', unit: 'mm', min: 1, step: 1, defaultValue: 45 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 1, step: 1, defaultValue: 305 },
      // E flute is about 1.5 mm, B flute 3 mm.
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 7, step: 0.1, defaultValue: 1.5 },
    ],
    artworkRegions: [
      ...panelRegions(BOX_FACES),
      ...pairedPanelRegions(['Lid Front', 'Lid Left', 'Lid Right', 'Inner Front', 'Front Roll', 'Left Back Tab', 'Left Front Tab', 'Right Back Tab', 'Right Front Tab']),
    ],
    defaultDimensions: { width: 305, height: 45, depth: 305, thickness: 1.5 },
    fixedOpeningMode: 'lid_from_back',
  },
} satisfies ParametricTemplate;
