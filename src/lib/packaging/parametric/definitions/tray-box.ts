import type { Expr } from '../expression';
import type { HingeSpec, PanelSpec, ParametricTemplate } from '../format';
import type { TemplateParameterDefinition } from '../../template-registry';
import { pairedPanelRegions, panelRegions } from './artwork-regions';

// A four-corner folding-carton tray: a bottom and four walls, with a glue
// ear at each end of the front and back walls that folds in and is glued
// inside the side wall, as a four-corner gluer makes them. Width, depth and
// height are the tray's inside; t is the board.
//
// The telescope box is two of these trays cut on one sheet: the base, and a
// lid tray that fits over the base's outside with a little play and is
// lidHeight deep (a shallow lid, or a full telescope down to the bottom).
// The lid is a piece of its own (fold.pieces) that turns over onto the base
// as the box is assembled and lifts off as it opens, like the rigid box's.
//
// Laid out as the rigid box's trays are (rigid-lid-base.ts), without its
// turn-ins: card walls are single.

type Corner = [Expr, Expr];

/** One tray: bottom, walls and glue ears, laid out as a cross from (x0, y0). */
export function cornerTray(p: 'base' | 'lid'): PanelSpec[] {
  const v = (name: string) => `${p}${name}`;
  const [x0, y0, w, d, h, ear] = [v('X0'), v('Y0'), v('W'), v('D'), v('H'), v('Ear')];
  // The lid is turned over onto the base, so its front wall is cut on the
  // far side of its top from the base's.
  const [nearWall, farWall] = p === 'base' ? ['Front', 'Back'] : ['Back', 'Front'];
  const label = (name: string) => `${p === 'lid' ? 'LID ' : ''}${name}`.toUpperCase();
  const id = (name: string) => (p === 'base' ? name.charAt(0).toLowerCase() + name.slice(1) : `lid${name}`);
  const centre = p === 'base' ? 'bottom' : 'lidTop';
  const earPanel = (wall: string, side: 'Left' | 'Right', top: boolean): PanelSpec => {
    const [edge, tip] = side === 'Left' ? [x0, `${x0} - ${ear}`] : [`${x0} + ${w}`, `${x0} + ${w} + ${ear}`];
    // Ears stop a board short of the bottom crease and taper towards the top, so they slide in.
    const [root, free] = top ? [`${y0} - t`, `${y0} - ${h}`] : [`${y0} + ${d} + t`, `${y0} + ${d} + ${h}`];
    const taper = top ? `+ ${v('EarTaper')}` : `- ${v('EarTaper')}`;
    const outline: Corner[] = [[edge, root], [edge, free], [tip, `${free} ${taper}`], [tip, root]];
    return { id: id(`${wall}${side}Ear`), label: label(`${wall} ${side} ear`), kind: 'glue', outline };
  };
  const panels: PanelSpec[] = [
    { id: centre, label: p === 'base' ? 'BOTTOM' : 'LID TOP', kind: 'body', rect: [x0, y0, w, d], ...(p === 'lid' ? { artworkRotation: 180 } : {}) },
    { id: id(farWall), label: label(farWall), kind: 'body', rect: [x0, `${y0} - ${h}`, w, h], ...(p === 'base' ? {} : { artworkRotation: 180 }) },
    { id: id(nearWall), label: label(nearWall), kind: 'body', rect: [x0, `${y0} + ${d}`, w, h], ...(p === 'base' ? { artworkRotation: 180 } : {}) },
    { id: id('Left'), label: label('Left'), kind: 'body', rect: [`${x0} - ${h}`, y0, h, d] },
    { id: id('Right'), label: label('Right'), kind: 'body', rect: [`${x0} + ${w}`, y0, h, d] },
    earPanel(farWall, 'Left', true), earPanel(farWall, 'Right', true),
    earPanel(nearWall, 'Left', false), earPanel(nearWall, 'Right', false),
  ];
  return panels.map(spec => ({ ...spec, layer: /Left$|Right$/.test(spec.id) && spec.kind === 'body' ? 1.5 : spec.id.endsWith('Ear') ? 0 : spec.id === 'lidTop' ? 2 : 1 }));
}

export function cornerTrayHinges(p: 'base' | 'lid'): HingeSpec[] {
  const id = (name: string) => (p === 'base' ? name.charAt(0).toLowerCase() + name.slice(1) : `lid${name}`);
  const centre = p === 'base' ? 'bottom' : 'lidTop';
  const hinge = (child: string, parent: string, angle: Expr, setback?: Expr): HingeSpec => ({ child, parent, angle, ...(setback === undefined ? {} : { setback }) });
  return [
    hinge(id('Front'), centre, 'turnWalls'),
    hinge(id('Back'), centre, 'turnWalls'),
    ...(['Front', 'Back'] as const).flatMap(wall => (['Left', 'Right'] as const).map(side => hinge(id(`${wall}${side}Ear`), id(wall), 'turnEars', 'foldT * 0.5'))),
    // The side walls close over the ears, which are glued to their inside.
    hinge(id('Left'), centre, 'turnSides', 'resting'),
    hinge(id('Right'), centre, 'turnSides', 'resting'),
  ];
}

/** The base tray's sizes: crease to crease, a board more than the inside. */
const baseSizes: [string, Expr][] = [
  ['t', 'thickness'],
  ['baseW', 'width + t'], ['baseD', 'depth + t'], ['baseH', 'height + t / 2'],
  ['ear', 'min(max(10, depth / 4), 30, depth / 2 - t)'],
  ['baseEar', 'ear'], ['baseEarTaper', 'min((baseH - t) / 3, baseEar * 0.4)'],
];

const shared = {
  format: 'parametric-template/1',
  parameters: {
    width: { fallback: 160, min: 1 },
    height: { fallback: 50, min: 1 },
    depth: { fallback: 110, min: 1 },
    thickness: { fallback: 0.5, min: 0.3, max: 2 },
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'lid_from_back',
    openingStage: 'always',
  },
} as const;
/** An open tray: its inside is always in view. */
const openTop = { ...shared.assembly, showsInside: 1 };

const motions: [string, Expr][] = [
  ['turnWalls', 'stage(formation, 0, 0.35) * (pi / 2)'],
  ['turnEars', 'stage(formation, 0.25, 0.5) * (pi / 2)'],
  ['turnSides', 'stage(formation, 0.45, 0.75) * (pi / 2)'],
  ['resting', 'foldResting'],
];

/** The tray lies printed side down, so its walls fold up round the bottom. */
const baseMatrix: Expr[] = [-1, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, 'bottom.x + bottom.width / 2', '-height / 2', '-(bottom.y + bottom.height / 2)', 1];

const parameters = (width: number, height: number, depth: number): TemplateParameterDefinition[] => [
  { key: 'width', label: 'Width', unit: 'mm', min: 20, max: 600, step: 1, defaultValue: width },
  { key: 'height', label: 'Height', unit: 'mm', min: 10, max: 300, step: 1, defaultValue: height },
  { key: 'depth', label: 'Depth', unit: 'mm', min: 20, max: 600, step: 1, defaultValue: depth },
  { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
];

const validations = [
  { require: 'height >= max(10, 4 * t)', message: 'The tray is too shallow for this board. Use a height of at least {max(10, 4 * t)} mm.' },
  { require: 'width >= 20 && depth >= 20', message: 'The tray is too small for its corner ears. Use a width and depth of at least 20 mm.' },
];

export const trayBoxDefinition = {
  ...shared,
  templateId: 'tray-box',
  structureKey: 'tray-v1',
  rendererKey: 'tray-v1',
  description: 'Four-corner folding-carton tray: a bottom and four walls, with a glue ear at each corner glued inside the side walls.',
  assembly: openTop,
  derived: [
    ...baseSizes,
    ['baseX0', 'max(baseH, baseEar)'],
    ['baseY0', 'baseH'],
  ],
  adjustable: [
    { key: 'ear', label: 'Corner ears', min: 6, max: 'max(6, depth / 2 - t)' },
  ],
  panels: cornerTray('base'),
  validations,
  notes: [
    { text: 'Four-corner tray: glue each corner ear to the inside of its side wall.' },
    { text: 'Width, depth and height are the inside of the tray, on {t} mm board. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid.' },
  ],
  fold: {
    root: 'bottom',
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.06))',
    matrix: baseMatrix,
    motions,
    hinges: cornerTrayHinges('base'),
  },
  export: {
    kind: 'cutting-template',
    summary: 'Four-corner tray cutting template with glue ears. Your printer must approve the stock and allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/tray-box.webp',
    version: 1,
    name: 'Four-Corner Tray',
    shortName: 'Tray',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Open tray with glued corners: for display, bakery, fruit, gift sets and inserts.',
    tags: ['tray', 'four corner tray', 'display tray', 'open box', 'insert', 'bakery tray'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: parameters(160, 50, 110),
    artworkRegions: panelRegions(['Front', 'Back', 'Left', 'Right', 'Bottom']),
    defaultDimensions: { width: 160, height: 50, depth: 110, thickness: 0.5 },
    fixedOpeningMode: 'lid_from_back',
  },
} satisfies ParametricTemplate;

export const telescopeBoxDefinition = {
  ...shared,
  parameters: { ...shared.parameters, width: { fallback: 220, min: 1 }, height: { fallback: 80, min: 1 }, depth: { fallback: 150, min: 1 } },
  templateId: 'telescope-box',
  structureKey: 'telescope-v1',
  rendererKey: 'telescope-v1',
  description: 'Two-piece telescope box: a four-corner base tray and a four-corner lid tray that fits over it, cut on one sheet; the lid is a separate piece that turns over onto the base.',
  derived: [
    ...baseSizes,
    // The lid fits over the base's outside (crease plus a board) with play each side.
    ['clearance', 'max(0.5, t)'],
    ['lidHeight', 'clamp(height / 3, 15, baseH + t)'],
    ['lidW', 'baseW + 2 * t + 2 * clearance'], ['lidD', 'baseD + 2 * t + 2 * clearance'], ['lidH', 'lidHeight'],
    ['lidEar', 'min(max(10, lidD / 4), 30, lidD / 2 - t, ear + t + clearance)'], ['lidEarTaper', 'min((lidH - t) / 3, lidEar * 0.4)'],
    // Sheet: base on the left, lid on the right, both from the top.
    ['baseX0', 'max(baseH, baseEar)'],
    ['baseY0', 'max(baseH, lidH)'],
    ['lidX0', 'baseX0 + baseW + max(baseH, baseEar) + 10 + max(lidH, lidEar)'],
    ['lidY0', 'baseY0'],
  ],
  adjustable: [
    { key: 'lidHeight', label: 'Lid height', min: 'min(10, baseH + t)', max: 'baseH + t' },
    { key: 'clearance', label: 'Lid play', min: 0.2, max: 5 },
    { key: 'ear', label: 'Corner ears', min: 6, max: 'max(6, depth / 2 - t)' },
  ],
  panels: [...cornerTray('base'), ...cornerTray('lid')],
  validations,
  notes: [
    { text: 'Telescope box: a base tray and a lid tray, each with four glued corners. The lid fits over the base with {clearance} mm play each side.' },
    { text: 'Width, depth and height are the inside of the base, on {t} mm board; the lid is {lidHeight} mm deep. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid.' },
  ],
  // Both trays fold up together; then the lid turns over in an arc and lands
  // on the base. Opening lifts it off and moves it back.
  fold: {
    root: 'bottom',
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.06))',
    matrix: baseMatrix,
    motions: [
      ...motions,
      ['place', 'stage(formation, 0.78, 1)'],
      ['flipC', 'cos(pi * place)'], ['flipS', 'sin(pi * place)'],
      ['lidCx', 'lidTop.x + lidTop.width / 2'], ['lidCy', 'lidTop.y + lidTop.height / 2'],
      ['baseCx', 'bottom.x + bottom.width / 2'], ['baseCy', 'bottom.y + bottom.height / 2'],
      ['lift', 'stage(opening, 0, 1) * (lidH + height * 0.5)'],
      ['backOff', 'stage(opening, 0.3, 1) * depth * 0.55'],
      // Where the lid top's centre goes: beside the base while flat, over it once placed.
      ['lidX', '(1 - place) * (baseCx - lidCx)'],
      ['lidY', '(1 - place) * (-height / 2) + place * (baseH - height / 2 + foldT + lift) + flipS * (lidH + height)'],
      ['lidZ', '(1 - place) * (lidCy - baseCy) - backOff'],
    ],
    hinges: [...cornerTrayHinges('base'), ...cornerTrayHinges('lid')],
    pieces: [{
      root: 'lidTop',
      // The base's placement turned about the x axis by pi * place, moved so
      // the lid top's centre lands at (lidX, lidY, lidZ).
      matrix: [
        -1, 0, 0, 0,
        0, 'flipS', '-flipC', 0,
        0, '-flipC', '-flipS', 0,
        'lidX + lidCx', 'lidY + flipS * lidCy', 'lidZ - flipC * lidCy', 1,
      ],
    }],
  },
  export: {
    kind: 'cutting-template',
    summary: 'Telescope box cutting template: base and lid trays with glue ears. Your printer must approve the stock and allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/telescope-box.webp',
    version: 1,
    name: 'Telescope Box (Lid & Base)',
    shortName: 'Telescope',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Two-piece folding-carton box with a lift-off lid: for apparel, shoes, gifts, stationery and subscription boxes.',
    tags: ['telescope box', 'lid and base', 'two piece box', 'shoe box', 'apparel box', 'gift box', 'tray'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: parameters(220, 80, 150),
    artworkRegions: [
      ...panelRegions(['Lid Top', 'Front', 'Back', 'Left', 'Right', 'Bottom']),
      ...pairedPanelRegions(['Lid Front', 'Lid Back', 'Lid Left', 'Lid Right']),
    ],
    defaultDimensions: { width: 220, height: 80, depth: 150, thickness: 0.5 },
    fixedOpeningMode: 'lid_from_back',
  },
} satisfies ParametricTemplate;
