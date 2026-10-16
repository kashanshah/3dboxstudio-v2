import type { Expr } from '../expression';
import type { HingeSpec, PanelSpec, ParametricTemplate } from '../format';
import { pairedPanelRegions, panelRegions } from './artwork-regions';

// A rigid set-up box with a separate lid: a base tray and a lid tray, each a
// bottom and four walls. The front and back walls carry ears that wrap the
// corners inside the side walls, and every wall's top edge has a turn-in that
// folds over into the tray, as the wrap does on a real rigid box. The two
// trays are cut side by side on one sheet; the lid is a piece of its own
// (fold.pieces) that turns over onto the base as the box is assembled and
// lifts off as it opens.
//
// Width, depth and height are the base's inside; the lid fits over the base
// with a little play and is lidHeight deep (a shoulder lid, or full depth).

type Corner = [Expr, Expr];

/** One tray: bottom, walls, ears and turn-ins, laid out as a cross from (x0, y0). */
export function tray(p: 'base' | 'lid'): PanelSpec[] {
  const v = (name: string) => `${p}${name}`;
  const [x0, y0, w, d, h, turn, ear] = [v('X0'), v('Y0'), v('W'), v('D'), v('H'), v('Turn'), v('Ear')];
  // The lid is turned over onto the base, so its front wall is cut on the
  // far side of its top from the base's.
  const [nearWall, farWall] = p === 'base' ? ['Front', 'Back'] : ['Back', 'Front'];
  const label = (name: string) => `${p === 'lid' ? 'LID ' : ''}${name}`.toUpperCase();
  const id = (name: string) => (p === 'base' ? name.charAt(0).toLowerCase() + name.slice(1) : `lid${name}`);
  const centre = p === 'base' ? 'bottom' : 'lidTop';
  const sideTurnIn = (panelId: string, panelLabel: string, x: string): PanelSpec => {
    const [from, to] = [`${y0} + ${v('Board')}`, `${y0} + ${d} - ${v('Board')}`];
    return {
      id: panelId, label: panelLabel, kind: 'flap',
      rect: [x, `${y0} + ${ear} + ${v('Board')}`, turn, `${d} - 2 * (${ear} + ${v('Board')})`],
      model: [[x, from], [`${x} + ${turn}`, from], [`${x} + ${turn}`, to], [x, to]],
    };
  };
  const earPanel = (wall: string, side: 'Left' | 'Right', top: boolean): PanelSpec => {
    const [edge, tip] = side === 'Left' ? [x0, `${x0} - ${ear}`] : [`${x0} + ${w}`, `${x0} + ${w} + ${ear}`];
    // Ears stop a board short of the bottom crease and taper towards the top.
    const [root, free] = top ? [`${y0} - ${v('Board')}`, `${y0} - ${h}`] : [`${y0} + ${d} + ${v('Board')}`, `${y0} + ${d} + ${h}`];
    const taper = top ? `+ ${v('EarTaper')}` : `- ${v('EarTaper')}`;
    const outline: Corner[] = [[edge, root], [edge, free], [tip, `${free} ${taper}`], [tip, root]];
    // In 3D the ear stops below the side turn-in, which covers its top.
    const reach = `max(1, ${h} - ${turn} - 4 * ${v('Board')} - 1)`;
    const short = top ? `${y0} - ${v('Board')} - ${reach}` : `${y0} + ${d} + ${v('Board')} + ${reach}`;
    const model: [Corner, Corner, Corner, Corner] = [[edge, root], [edge, short], [tip, short], [tip, root]];
    return { id: id(`${wall}${side}Ear`), label: label(`${wall} ${side} ear`), kind: 'flap', outline, model };
  };
  return [
    { id: centre, label: p === 'base' ? 'BOTTOM' : 'LID TOP', kind: 'body', rect: [x0, y0, w, d], ...(p === 'lid' ? { artworkRotation: 180 } : {}) },
    // Walls before and after the centre on the sheet; the lid's are swapped.
    { id: id(farWall), label: label(farWall), kind: 'body', rect: [x0, `${y0} - ${h}`, w, h], ...(p === 'base' ? {} : { artworkRotation: 180 }) },
    { id: id(nearWall), label: label(nearWall), kind: 'body', rect: [x0, `${y0} + ${d}`, w, h], ...(p === 'base' ? { artworkRotation: 180 } : {}) },
    { id: id('Left'), label: label('Left'), kind: 'body', rect: [`${x0} - ${h}`, y0, h, d] },
    { id: id('Right'), label: label('Right'), kind: 'body', rect: [`${x0} + ${w}`, y0, h, d] },
    earPanel(farWall, 'Left', true), earPanel(farWall, 'Right', true),
    earPanel(nearWall, 'Left', false), earPanel(nearWall, 'Right', false),
    // Turn-ins on every wall's free edge, stopping a board short of the corners.
    { id: id(`${farWall}TurnIn`), label: label(`${farWall} turn-in`), kind: 'flap', rect: [`${x0} + ${v('Board')}`, `${y0} - ${h} - ${turn}`, `${w} - 2 * ${v('Board')}`, turn] },
    { id: id(`${nearWall}TurnIn`), label: label(`${nearWall} turn-in`), kind: 'flap', rect: [`${x0} + ${v('Board')}`, `${y0} + ${d} + ${h}`, `${w} - 2 * ${v('Board')}`, turn] },
    // The side turn-ins are cut notched at the corners, clear of the ears
    // that wrap round inside the side walls; in 3D they run the wall's full
    // length, so the wall is trimmed where it folds over.
    sideTurnIn(id('LeftTurnIn'), label('Left turn-in'), `${x0} - ${h} - ${turn}`),
    sideTurnIn(id('RightTurnIn'), label('Right turn-in'), `${x0} + ${w} + ${h}`),
  ];
}

export function trayHinges(p: 'base' | 'lid'): HingeSpec[] {
  const id = (name: string) => (p === 'base' ? name.charAt(0).toLowerCase() + name.slice(1) : `lid${name}`);
  const centre = p === 'base' ? 'bottom' : 'lidTop';
  const hinge = (child: string, parent: string, angle: Expr, setback?: Expr): HingeSpec => ({ child, parent, angle, ...(setback === undefined ? {} : { setback }) });
  return [
    hinge(id('Front'), centre, 'turnWalls'),
    hinge(id('Back'), centre, 'turnWalls'),
    ...(['Front', 'Back'] as const).flatMap(wall => (['Left', 'Right'] as const).map(side => hinge(id(`${wall}${side}Ear`), id(wall), 'turnEars', 'foldT * 0.5'))),
    hinge(id('Left'), centre, 'turnSides', 'resting'),
    hinge(id('Right'), centre, 'turnSides', 'resting'),
    // Turn-ins fold down against the inside of their wall, over the ears' tops.
    ...(['Front', 'Back', 'Left', 'Right'] as const).map(wall => hinge(id(`${wall}TurnIn`), id(wall), 'turnIns', 'foldT * 1.1')),
  ];
}

const layer = (spec: PanelSpec) => (/Left$|Right$/.test(spec.id) && spec.kind === 'body' ? 1.5 : spec.id.endsWith('Ear') ? 0 : spec.id === 'lidTop' ? 2 : 1);
export const finish = (spec: PanelSpec): PanelSpec => ({ ...spec, layer: layer(spec), ...(spec.kind === 'flap' ? { closureFlap: true } : {}) });

export const rigidLidBaseDefinition = {
  format: 'parametric-template/1',
  templateId: 'rigid-lid-base',
  structureKey: 'rigid-lid-base-v1',
  rendererKey: 'rigid-lid-base-v1',
  description: 'Two-piece rigid set-up box: a base tray and a lid tray, each with corner ears and turn-ins; the lid is a separate piece that turns over onto the base.',
  parameters: {
    width: { fallback: 200, min: 1 },
    height: { fallback: 60, min: 1 },
    depth: { fallback: 150, min: 1 },
    thickness: { fallback: 2, min: 0.5, max: 4 },
  },
  derived: [
    ['t', 'thickness'],
    ['clearance', 1],
    ['lidHeight', 'clamp(height / 3, 15, height + t)'],
    // Turn-ins fold a board's worth inside every wall, and fit inside the lid's.
    ['turnIn', 'min(clamp(0.3 * height, 8, 18), max(4, lidHeight - 3 * t - 2))'],
    // Base: its bottom and walls are cut a board wider than the inside on
    // each side, for the turn-ins lying inside the walls.
    ['baseBoard', 't'],
    ['baseW', 'width + 2 * t'], ['baseD', 'depth + 3 * t'], ['baseH', 'height + t'],
    // A turn-in fits inside its wall, below the lid or base board.
    ['baseTurn', 'max(4, min(turnIn, baseH - 3 * t - 2))'],
    ['baseEar', 'min(depth / 3, 20)'], ['baseEarTaper', 'min((baseH - t) / 3, baseEar * 0.4)'],
    // Lid: fits over the base's outside (its walls and their wrap) with play.
    ['lidBoard', 't'],
    ['lidW', 'baseW + 2 * t + 2 * clearance'], ['lidD', 'baseD + 2 * t + 2 * clearance'], ['lidH', 'lidHeight'],
    ['lidTurn', 'max(4, min(turnIn, lidH - 3 * t - 2))'],
    ['lidEar', 'min(lidD / 3, 20)'], ['lidEarTaper', 'min((lidH - t) / 3, lidEar * 0.4)'],
    // Sheet: base on the left, lid on the right, both rows from the top.
    ['baseX0', 'max(baseH + baseTurn, baseEar)'],
    ['baseY0', 'max(baseH + baseTurn, lidH + lidTurn)'],
    ['lidX0', 'baseX0 + baseW + max(baseH + baseTurn, baseEar) + 10 + max(lidH + lidTurn, lidEar)'],
    ['lidY0', 'baseY0'],
  ],
  // Sizes the studio lets people change.
  adjustable: [
    { key: 'lidHeight', label: 'Lid height', min: 'min(10, height + t)', max: 'height + t' },
    { key: 'turnIn', label: 'Turn-ins', min: 4, max: 'max(4, min(30, lidHeight - 3 * t - 2))' },
  ],
  panels: [...tray('base'), ...tray('lid')].map(finish),
  validations: [
    { require: 'height >= max(15, 6 * t)', message: 'The box is too shallow for this board. Use a height of at least {max(15, 6 * t)} mm.' },
    { require: 'width >= 30 && depth >= 30', message: 'The box is too small for a rigid box. Use a width and depth of at least 30 mm.' },
  ],
  notes: [
    { text: 'Rigid lid and base box: base tray and lid tray, each with corner ears and turn-ins. The lid fits over the base with {clearance} mm play each side.' },
    { text: 'Width, depth and height are the inside of the base, on {t} mm board. Rigid boxes are made from greyboard wrapped in printed paper; ask your box maker to confirm the board, the wrap and its allowances.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the turn-ins.' },
  ],
  // Both trays fold up together; then the lid turns over in an arc and lands
  // on the base. Opening lifts it off and moves it back.
  fold: {
    root: 'bottom',
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.06))',
    // The base lies printed side down, so its walls fold up around the bottom.
    matrix: [-1, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, 'bottom.x + bottom.width / 2', '-height / 2', '-(bottom.y + bottom.height / 2)', 1],
    motions: [
      ['turnWalls', 'stage(formation, 0, 0.3) * (pi / 2)'],
      ['turnEars', 'stage(formation, 0.2, 0.45) * (pi / 2)'],
      ['turnSides', 'stage(formation, 0.4, 0.65) * (pi / 2)'],
      ['turnIns', 'stage(formation, 0.6, 0.8) * pi'],
      ['resting', 'foldResting'],
      // The lid turns over onto the base, then lifts off as the box opens.
      ['place', 'stage(formation, 0.8, 1)'],
      ['flipC', 'cos(pi * place)'], ['flipS', 'sin(pi * place)'],
      ['lidCx', 'lidTop.x + lidTop.width / 2'], ['lidCy', 'lidTop.y + lidTop.height / 2'],
      ['baseCx', 'bottom.x + bottom.width / 2'], ['baseCy', 'bottom.y + bottom.height / 2'],
      ['lift', 'stage(opening, 0, 1) * (lidH + height * 0.5)'],
      ['backOff', 'stage(opening, 0.3, 1) * depth * 0.55'],
      // Where the lid top's centre goes: beside the base while flat, over it once placed.
      ['lidX', '(1 - place) * (baseCx - lidCx)'],
      ['lidY', '(1 - place) * (-height / 2) + place * (height / 2 + foldT + lift) + flipS * (lidH + height)'],
      ['lidZ', '(1 - place) * (lidCy - baseCy) - backOff'],
    ],
    hinges: [...trayHinges('base'), ...trayHinges('lid')],
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
  assembly: {
    control: 'none',
    defaultOpeningMode: 'lid_from_back',
    openingStage: 'always',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Rigid box wrap layout: base and lid trays with ears and turn-ins. Your box maker must confirm the greyboard and wrap allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the turn-ins.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/rigid-lid-base.webp',
    version: 1,
    name: 'Rigid Lid & Base Box',
    shortName: 'Rigid lid',
    family: 'rigid-box',
    category: 'Rigid',
    description: 'Two-piece premium rigid box.',
    tags: ['rigid', 'gift', 'lid', 'base', 'luxury', 'telescope', 'set-up box'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 1, step: 1, defaultValue: 200 },
      { key: 'height', label: 'Height', unit: 'mm', min: 1, step: 1, defaultValue: 60 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 1, step: 1, defaultValue: 150 },
      // Greyboard is usually 1.5–3 mm.
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.5, max: 4, step: 0.1, defaultValue: 2 },
    ],
    artworkRegions: [
      ...panelRegions(['Lid Top', 'Front', 'Back', 'Left', 'Right', 'Bottom']),
      ...pairedPanelRegions(['Lid Front', 'Lid Back', 'Lid Left', 'Lid Right']),
    ],
    defaultDimensions: { width: 200, height: 60, depth: 150, thickness: 2 },
    fixedOpeningMode: 'lid_from_back',
  },
} satisfies ParametricTemplate;
