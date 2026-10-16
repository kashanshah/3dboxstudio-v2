import type { Expr } from '../expression';
import type { HingeSpec, LineSpec, ModelPanelSpec, ParametricTemplate } from '../format';
import { BOX_FACES, pairedPanelRegions, panelRegions } from './artwork-regions';
import { mailerBoxDefinition } from './mailer-box';

// A one-piece bakery (cake) box in folding carton, assembled without glue.
// Its structure is the mailer's (mailer-box.ts): ears on the front and back
// walls fold in along the sides, and each side wall folds double over them,
// its inner layer locking into the base with two tabs, so the corners are
// locked rather than glued. The lid hinges on the back wall, its tuck slides
// down inside the front wall and its side flaps inside the side walls.
//
// Unlike the mailer, it's cut from card, its lid tuck is short (a cake box
// is opened often), and its lid may have a window: a rectangle cut out of
// the lid, `window` millimetres in from its edges (0 for none), to be backed
// with clear film. In 3D the lid is folded as a frame round the window, with
// the glass filled in when there is none.
//
// Width, depth and height are inside sizes; t is the board.
// VERIFY: lock-corner bakery boxes vary by maker; check this structure and
// its allowances against a converter's standard before production.

type Corner = [Expr, Expr];

const derived = mailerBoxDefinition.derived.map(([name, value]): [string, Expr] =>
  // A short tuck and side flaps: enough to hold the lid shut, quick to open.
  name === 'lidTuck' ? [name, 'min(height - 2 * t - 2, max(20, height / 3))']
    : name === 'lidFlap' ? [name, 'min(height - 3 * t - clearance, max(20, height / 3))'] : [name, value]);

// The window's frame on the sheet: the lid runs from lidTop (its front edge,
// where the tuck hinges) to backTop (its hinge on the back wall).
const [wx0, wx1, wy0, wy1] = ['x0 + frame', 'x0 + W - frame', 'lidTop + frame', 'backTop - frame'];
const windowCorners: Corner[] = [[wx0, wy0], [wx1, wy0], [wx1, wy1], [wx0, wy1]];
const windowCuts: LineSpec[] = windowCorners.map((from, i) => ({ from, to: windowCorners[(i + 1) % 4], when: 'window > 0' }));

const lidPieces: ModelPanelSpec[] = [
  { id: 'top-l', of: 'top', outline: [['x0', 'lidTop'], [wx0, 'lidTop'], [wx0, 'backTop'], ['x0', 'backTop']] },
  { id: 'top-r', of: 'top', outline: [[wx1, 'lidTop'], ['x0 + W', 'lidTop'], ['x0 + W', 'backTop'], [wx1, 'backTop']] },
  { id: 'top-f', of: 'top', outline: [[wx0, 'lidTop'], [wx1, 'lidTop'], [wx1, wy0], [wx0, wy0]] },
  { id: 'top-b', of: 'top', outline: [[wx0, wy1], [wx1, wy1], [wx1, 'backTop'], [wx0, 'backTop']] },
  // The middle of the lid, unless it is cut out for a window.
  { id: 'top-w', of: 'top', when: 'window == 0', outline: [[wx0, wy0], [wx1, wy0], [wx1, wy1], [wx0, wy1]] },
];

// The lid's hinges move to the frame's pieces: the back strip on the back
// wall, the rest held flat to it, the tuck and side flaps on their edges.
const lidParent: Record<string, string> = { top: 'top-b', lidFront: 'top-f', lidLeft: 'top-l', lidRight: 'top-r' };
const hinges: HingeSpec[] = [
  ...mailerBoxDefinition.fold.hinges.map(hinge => ('child' in hinge && hinge.child === 'top' ? { ...hinge, child: 'top-b' }
    : 'parent' in hinge && hinge.parent === 'top' ? { ...hinge, parent: lidParent[hinge.child] } : hinge)),
  { child: 'top-l', parent: 'top-b', angle: 0, sharp: true },
  { child: 'top-r', parent: 'top-b', angle: 0, sharp: true },
  { child: 'top-f', parent: 'top-l', angle: 0, sharp: true },
  { child: 'top-w', parent: 'top-b', angle: 0, sharp: true },
] as HingeSpec[];

export const cakeBoxDefinition = {
  ...mailerBoxDefinition,
  templateId: 'cake-box',
  structureKey: 'cake-v1',
  rendererKey: 'cake-v1',
  description: 'One-piece bakery box in folding carton: ears locked inside double side walls without glue, a lid with a short front tuck and side flaps, and an optional window in the lid.',
  parameters: {
    width: { fallback: 250, min: 1 },
    height: { fallback: 125, min: 1 },
    depth: { fallback: 250, min: 1 },
    thickness: { fallback: 0.5, min: 0.3, max: 2 },
  },
  derived: [
    ...derived,
    ['window', 0],
    // With no window, the frame is drawn at a typical size so the 3D lid has its pieces.
    ['frame', 'window > 0 ? window : clamp(min(W, lidDepth) / 5, 15, 40)'],
  ],
  adjustable: [
    ...mailerBoxDefinition.adjustable,
    { key: 'window', label: 'Window border (0 for none)', min: 0, max: 'max(0, min(W, lidDepth) / 2 - 15)' },
  ],
  cuts: [...mailerBoxDefinition.cuts, ...windowCuts],
  validations: [
    { require: 'height >= max(20, 6 * t)', message: 'The box is too shallow for this board. Use a height of at least {max(20, 6 * t)} mm.' },
    { require: 'width >= 60 && depth >= 60', message: "The box is too small for its locking tabs. Use a width and depth of at least 60 mm." },
    { require: 'window == 0 || window >= 10', message: 'Leave at least 10 mm of board round the window, or set it to 0 for no window.' },
  ],
  notes: [
    { text: 'Cake box: ears locked inside double side walls without glue, a lid with a front tuck and side flaps.' },
    { text: 'Window: a {window} mm border round a cut-out in the lid; back it with clear film, glued inside.', when: 'window > 0' },
    { text: 'Width, depth and height are inside sizes on {t} mm board. For food contact, ask your printer for food-safe board and inks.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the flaps.' },
  ],
  assembly: { ...mailerBoxDefinition.assembly, showsInside: 'window > 0' },
  fold: {
    ...mailerBoxDefinition.fold,
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.06))',
    hinges,
    modelPanels: lidPieces,
  },
  export: {
    kind: 'cutting-template',
    summary: 'One-piece cake box cutting template with locking side walls and an optional lid window. Your printer must approve the board and allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the flaps.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/cake-box.webp',
    version: 1,
    name: 'Cake Box',
    shortName: 'Cake box',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'One-piece bakery box with locking corners and an optional window: for cakes, pastries, cookies and cupcakes.',
    tags: ['cake box', 'bakery box', 'window box', 'pastry box', 'cupcake box', 'food packaging', 'lock corner'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 60, max: 600, step: 1, defaultValue: 250 },
      { key: 'height', label: 'Height', unit: 'mm', min: 20, max: 300, step: 1, defaultValue: 125 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 60, max: 600, step: 1, defaultValue: 250 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: [
      ...panelRegions(BOX_FACES),
      ...pairedPanelRegions(['Lid Front', 'Lid Left', 'Lid Right', 'Left Inner', 'Right Inner', 'Left Roll', 'Right Roll', 'Front Left Ear', 'Front Right Ear', 'Back Left Ear', 'Back Right Ear']),
    ],
    defaultDimensions: { width: 250, height: 125, depth: 250, thickness: 0.5 },
    fixedOpeningMode: 'lid_from_back',
  },
} satisfies ParametricTemplate;
