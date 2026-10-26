import type { Expr } from '../expression';
import type { HingeSpec, LineSpec, ModelPanelSpec, PanelSpec, ParametricTemplate } from '../format';
import { pairedPanelRegions, panelRegions } from './artwork-regions';

// A hexagon box: a regular hexagonal base and a lid that fits over it, cut
// on one sheet, as the telescope box is.
//
// Each piece is a straight-line hexagonal carton, the way hexagonal cartons
// are glued on a straight-line gluer: six walls in a row with a glue flap,
// glued into a tube, then closed by a hexagon panel hinged on the back wall.
// The other five walls each carry a flap that folds in under (or over, on the
// lid) the inside of that panel and is glued to it. Laid out this way every
// wall is upright on the sheet, so artwork reads the right way up on all six
// and can run round the box across the creases; the glue goes on one seam and
// five flaps rather than six corners.
//
// On the sheet the lid is on top: its hexagon top, then its walls; below
// them the base's walls and its hexagon bottom. Each row runs glue flap,
// back, back left, front left, front, front right, back right, and the glue
// flap is stuck inside the back right wall. Walls meet at 120°, so each wall
// turns 60° on the one before it, and the flaps are cut with 60° sides so
// they fit together inside the hexagon.
//
// Sizes: width is the base's inside across the flats (from the front wall to
// the back wall), height its inside height, and depth how far the lid comes
// down over the base. t is the board.

type Wall = { id: string; label: string };
const WALLS: Wall[] = [
  { id: 'back', label: 'BACK' },
  { id: 'backLeft', label: 'BACK LEFT' },
  { id: 'frontLeft', label: 'FRONT LEFT' },
  { id: 'front', label: 'FRONT' },
  { id: 'frontRight', label: 'FRONT RIGHT' },
  { id: 'backRight', label: 'BACK RIGHT' },
];

type Piece = 'base' | 'lid';
const id = (p: Piece, name: string) => (p === 'base' ? name : `lid${name.charAt(0).toUpperCase()}${name.slice(1)}`);
const label = (p: Piece, name: string) => (p === 'base' ? name : `LID ${name}`);
/** The hexagon panel: the base's bottom, the lid's top. */
const capOf = (p: Piece) => (p === 'base' ? 'bottom' : 'lidTop');

/**
 * One piece's panels. Its crease line runs along y = {p}C, with the walls on
 * one side of it and the hexagon and flaps on the other: below the base's
 * walls, above the lid's (dir is the way they go down the sheet).
 */
function pieceSheet(p: Piece): { panels: PanelSpec[]; model: ModelPanelSpec[]; slits: LineSpec[] } {
  const v = (name: string) => `${p}${name}`;
  const [x0, c, s, a, h, flap] = [v('X0'), v('C'), v('S'), v('A'), v('H'), v('Flap')];
  const dir = p === 'base' ? 1 : -1;
  const out = (amount: string) => `${c} ${dir > 0 ? '+' : '-'} ${amount}`;
  // The row of walls, top to bottom on the sheet.
  const [top, bottom] = p === 'base' ? [`${c} - ${h}`, c] : [c, `${c} + ${h}`];
  const wallX = (k: number) => `${x0} + ${k} * ${s}`;
  // The back right wall takes the glue flap, so it is half a board narrower.
  const wallW = (k: number) => (k === 5 ? `${s} - t / 2` : s);
  const glueTaper = v('GlueTaper');
  const panels: PanelSpec[] = [
    {
      id: id(p, 'glue'), label: label(p, 'GLUE'), kind: 'glue', layer: 0,
      outline: [[x0, `${top} + glueCut`], [x0, `${bottom} - glueCut`], [`${x0} - glue`, `${bottom} - glueCut - ${glueTaper}`], [`${x0} - glue`, `${top} + glueCut + ${glueTaper}`]],
    },
    ...WALLS.map((wall, k): PanelSpec => ({
      id: id(p, wall.id), label: label(p, wall.label), kind: 'body', layer: 1, rect: [wallX(k), top, wallW(k), h],
      // In 3D its free end runs on over the glue flap's crease, which the
      // model bends round a radius, so the seam corner closes as it does in board.
      ...(k === 5 ? { model: [[wallX(k), top], [`${wallX(k)} + ${wallW(k)} + seamReach`, top], [`${wallX(k)} + ${wallW(k)} + seamReach`, bottom], [wallX(k), bottom]] } : {}),
    })),
    // A flap on every wall but the back, which the hexagon hinges on. Its
    // sides run at 60° to the crease, a relief in from each end against the
    // next flap. Beside the hexagon there is no relief: the back left flap's
    // side runs along the hexagon's edge, so one cut parts them rather than
    // two close together leaving a sliver.
    ...WALLS.slice(1).map((wall, i): PanelSpec => {
      const k = i + 1;
      const [xa, xb] = [wallX(k), `${wallX(k)} + ${wallW(k)}`];
      const start = k === 1 ? xa : `${xa} + relief`;
      return {
        id: id(p, `${wall.id}Flap`), label: label(p, `${wall.label} FLAP`), kind: 'flap', layer: 0, closureFlap: true,
        outline: [
          [start, c], [`${xb} - relief`, c],
          [`${xb} - relief - ${flap} / sqrt(3)`, out(flap)], [`${start} + ${flap} / sqrt(3)`, out(flap)],
        ],
      };
    }),
  ];
  // The hexagon, a flat edge on the back wall.
  const corners: [Expr, Expr][] = [
    [x0, c], [`${x0} + ${s}`, c], [`${x0} + 1.5 * ${s}`, out(a)],
    [`${x0} + ${s}`, out(`2 * ${a}`)], [x0, out(`2 * ${a}`)], [`${x0} - 0.5 * ${s}`, out(a)],
  ];
  // Where the back left flap's side ends on the hexagon's edge: a corner of
  // the cut outline, so the edge they share is one cut.
  const flapEnd: [Expr, Expr] = [`${x0} + ${s} + ${flap} / sqrt(3)`, out(flap)];
  panels.push({
    id: capOf(p), label: p === 'base' ? 'BOTTOM' : 'LID TOP', kind: 'body', layer: 2,
    outline: [corners[0], corners[1], flapEnd, ...corners.slice(2)],
    // The model folds it as two halves (below); this is only the shape the format asks for.
    fold: [corners[0], corners[1], corners[3], corners[4]],
    ...(p === 'lid' ? { artworkRotation: 180 as const } : {}),
  });
  // In 3D the hexagon is two four-corner halves joined flat across its middle:
  // the half on the back wall's crease, and the far half.
  const model: ModelPanelSpec[] = [
    { id: `${capOf(p)}Near`, of: capOf(p), outline: [corners[0], corners[1], corners[2], corners[5]] },
    { id: `${capOf(p)}Far`, of: capOf(p), outline: [corners[5], corners[2], corners[3], corners[4]] },
  ];
  // That shared edge is cut, not creased.
  return { panels, model, slits: [{ from: corners[1], to: flapEnd }] };
}

function pieceHinges(p: Piece): HingeSpec[] {
  const cap = capOf(p);
  return [
    { child: `${cap}Far`, parent: `${cap}Near`, angle: 0, sharp: true },
    { child: id(p, 'back'), parent: `${cap}Near`, angle: 'turnBack' },
    // Round the tube: each wall turns 60° on the one before it.
    ...WALLS.slice(1).map((wall, i): HingeSpec => ({ child: id(p, wall.id), parent: id(p, WALLS[i].id), angle: 'wrap' })),
    // The glue flap turns in behind the back right wall.
    { child: id(p, 'glue'), parent: id(p, 'back'), angle: 'turnGlue', setback: 'foldT * 1.2' },
    // The flaps fold in onto the inside of the hexagon.
    ...WALLS.slice(1).map((wall): HingeSpec => ({ child: id(p, `${wall.id}Flap`), parent: id(p, wall.id), angle: 'turnFlaps', setback: 'flapSetback' })),
  ];
}

const base = pieceSheet('base');
const lid = pieceSheet('lid');

/** A piece's crease-to-crease sizes across the flats `across` and up the walls `tall`. */
const sizes = (p: Piece, across: Expr, tall: Expr): [string, Expr][] => [
  [`${p}F`, across], [`${p}S`, `${p}F / sqrt(3)`], [`${p}A`, `${p}F / 2`], [`${p}H`, tall],
  [`${p}GlueTaper`, `min(glue * tan(15 * pi / 180), (${p}H - 2 * glueCut) / 3)`],
];
/** The most a flap can reach in before its 60° sides meet. */
const flapMax = (p: Piece) => `max(4, (${p}S - t / 2 - 2 * relief) * sqrt(3) / 2 - 1)`;

export const hexagonBoxDefinition = {
  format: 'parametric-template/1',
  templateId: 'hexagon-box',
  structureKey: 'hexagon-v1',
  rendererKey: 'hexagon-v1',
  description: 'Two-piece hexagon box: a base and a lid, each a straight-line hexagonal carton (six walls glued into a tube, a hexagon panel on the back wall and five glued flaps), cut on one sheet; the lid fits over the base and turns over onto it.',
  parameters: {
    width: { fallback: 100, min: 1 },
    height: { fallback: 70, min: 1 },
    depth: { fallback: 25, min: 1 },
    thickness: { fallback: 0.5, min: 0.3, max: 2 },
  },
  derived: [
    ['t', 'thickness'],
    ['glue', 'clamp(0.3 * (width + t) / sqrt(3) + 4, 8, 15)'],
    ['glueCut', 't + 1'],
    ['relief', 't + 0.5'],
    // Crease to crease, a board more across the flats than the inside; the
    // walls are a board and a half taller, for the hexagon and the flaps
    // glued on it.
    ...sizes('base', 'width + t', 'height + 1.5 * t'),
    ['baseFlap', `min(clamp(baseA * 0.55, 8, 45), ${flapMax('base')})`],
    // The lid fits over the base's outside (crease plus a board) with play
    // each side, and is a board wider for its own glue flap, which lies
    // between its wall and the base's.
    ['clearance', 'max(0.5, t)'],
    ...sizes('lid', 'baseF + 3 * t + 2 * clearance', 'depth + 1.5 * t'),
    ['lidFlap', `min(clamp(lidA * 0.55, 8, 45), ${flapMax('lid')})`],
    // Sheet: the lid's top, then its walls; a gap; the base's walls, then its
    // bottom. Both rows start from the back wall.
    ['lidX0', 'max(lidS / 2, glue)'], ['baseX0', 'lidX0'],
    ['lidC', '2 * lidA'],
    ['baseC', 'lidC + lidH + 10 + baseH'],
  ],
  adjustable: [
    { key: 'clearance', label: 'Lid play', min: 0.2, max: 5 },
    { key: 'glue', label: 'Glue flap', min: 6, max: 'max(6, min(25, (width + t) / sqrt(3) / 2))' },
    { key: 'baseFlap', label: 'Bottom flaps', min: 4, max: flapMax('base') },
    { key: 'lidFlap', label: 'Lid flaps', min: 4, max: flapMax('lid') },
  ],
  panels: [...lid.panels, ...base.panels],
  slits: [...lid.slits, ...base.slits],
  validations: [
    { require: 'width >= 40', message: 'The hexagon is too small for its flaps and glue flap. Use a width across the flats of at least 40 mm.' },
    { require: 'height >= max(15, 6 * t)', message: 'The base is too shallow for its glue flap. Use a height of at least {max(15, 6 * t)} mm.' },
    { require: 'depth >= max(10, 4 * t)', message: 'The lid is too shallow for its glue flap. Use a lid depth of at least {max(10, 4 * t)} mm.' },
    { require: 'depth <= height', message: 'The lid is deeper than the base is tall. Use a lid depth of at most {height} mm.' },
  ],
  notes: [
    { text: 'Hexagon box: a base and a lid, each glued into a tube by its glue flap, with the five flaps glued to the inside of the hexagon. The lid fits over the base with {clearance} mm play each side.' },
    { text: 'Width is the inside across the flats and height the inside height, on {t} mm board; the lid comes {depth} mm down over the base. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid.' },
  ],
  fold: {
    root: 'bottomNear',
    thickness: 'max(0.05, min(thickness, width * 0.03))',
    // Printed side down, so the walls fold up round the bottom; the back wall
    // ends up at the back. The flat sheet is centred, and slides across to
    // centre the base as its walls rise.
    matrix: [-1, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, 'baseCx + shiftX', '-height / 2', '-baseCy + shiftZ', 1],
    motions: [
      ['baseCx', 'bottom.x + bottom.width / 2'], ['baseCy', 'bottom.y + bottom.height / 2'],
      ['spread', '1 - stage(formation, 0.12, 0.45)'],
      ['shiftX', 'spread * ((lidBackRight.x + lidBackRight.width) / 2 - baseCx)'],
      ['shiftZ', 'spread * (baseCy - (bottom.y + bottom.height) / 2)'],
      // The flaps and glue flaps stand up first, then the back wall rises and
      // the others wrap round to meet it, carrying the flaps in over the hexagon.
      ['turnFlaps', 'stage(formation, 0, 0.25) * (pi / 2)'],
      ['turnGlue', 'stage(formation, 0.05, 0.3) * (pi / 3)'],
      ['turnBack', 'stage(formation, 0.2, 0.5) * (pi / 2)'],
      ['wrap', 'stage(formation, 0.4, 0.78) * (pi / 3)'],
      ['seamReach', 'foldCrease'],
      ['flapSetback', 'foldT * 1.05'],
      // Then the lid turns over in an arc and lands on the base's rim;
      // opening lifts it off and moves it back.
      ['place', 'stage(formation, 0.8, 1)'],
      ['flipC', 'cos(pi * place)'], ['flipS', 'sin(pi * place)'],
      ['lidCx', 'lidTop.x + lidTop.width / 2'], ['lidCy', 'lidTop.y + lidTop.height / 2'],
      ['lift', 'stage(opening, 0, 1) * (lidH + height * 0.5)'],
      ['backOff', 'stage(opening, 0.3, 1) * width * 0.75'],
      ['seat', 'baseH - height / 2 + 2.4 * foldT'],
      // Where the lid top's centre goes: on the centred sheet while flat, then
      // waiting just behind the base while its walls wrap, then over it.
      ['restX', 'spread * ((lidBackRight.x + lidBackRight.width) / 2 - lidCx)'],
      ['restZ', 'spread * (lidCy - (bottom.y + bottom.height) / 2) - (1 - spread) * (baseA + lidA + 15)'],
      ['lidX', '(1 - place) * restX'],
      ['lidY', '(1 - place) * (-height / 2) + place * (seat + lift) + flipS * (lidH + height)'],
      ['lidZ', '(1 - place) * restZ - place * backOff'],
    ],
    hinges: [...pieceHinges('base'), ...pieceHinges('lid')],
    pieces: [{
      root: 'lidTopNear',
      // The base's placement turned about the x axis by pi * place, moved so
      // the lid top's centre lands at (lidX, lidY, lidZ).
      matrix: [
        -1, 0, 0, 0,
        0, 'flipS', '-flipC', 0,
        0, '-flipC', '-flipS', 0,
        'lidX + lidCx', 'lidY + flipS * lidCy', 'lidZ - flipC * lidCy', 1,
      ],
    }],
    modelPanels: [...base.model, ...lid.model],
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'lid_from_back',
    openingStage: 'always',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Hexagon box cutting template: a base and a lid, each with a glue flap and five flaps glued to its hexagon. Your printer must approve the stock and allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/hexagon-box.webp',
    version: 1,
    name: 'Hexagon Box (Lid & Base)',
    shortName: 'Hexagon',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Six-sided box with a lift-off lid: for candles, chocolates, tea, soap, cosmetics and gifts. Sized by the inside across the flats, the height and the lid depth.',
    tags: ['hexagon box', 'hexagonal box', 'six sided box', 'lid and base', 'gift box', 'candle box', 'chocolate box'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Across flats', unit: 'mm', min: 40, max: 400, step: 1, defaultValue: 100, measuredAlong: 'z' },
      { key: 'height', label: 'Height', unit: 'mm', min: 15, max: 300, step: 1, defaultValue: 70 },
      { key: 'depth', label: 'Lid depth', unit: 'mm', min: 10, max: 300, step: 1, defaultValue: 25, measuredAlong: null },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: [
      ...panelRegions(['Lid Top', 'Front', 'Front Left', 'Front Right', 'Back', 'Back Left', 'Back Right', 'Bottom']),
      ...pairedPanelRegions(['Lid Front', 'Lid Front Left', 'Lid Front Right', 'Lid Back', 'Lid Back Left', 'Lid Back Right']),
    ],
    defaultDimensions: { width: 100, height: 70, depth: 25, thickness: 0.5 },
    fixedOpeningMode: 'lid_from_back',
  },
} satisfies ParametricTemplate;
