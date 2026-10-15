import type { Expr } from '../expression';
import type { HingeSpec, LineSpec, ModelPanelSpec, ParametricTemplate, PanelSpec } from '../format';
import { panelRegions } from './artwork-regions';
import { lockFlap, sideFlap } from './auto-lock-bottom';

// A gable box: a carton with a pitched roof and a carry handle, closed at
// the bottom by the auto-lock bottom's pre-glued crash lock.
//
// On the sheet, as on the tuck end die: a glue flap, then the left, front,
// right and back walls. Above the front and back walls are the roof panels,
// which slope in to meet over the middle of the box, and above each roof a
// handle panel with a finger hole. The two handles stand back to back. Above
// each side wall is the gable end, a triangle that stays upright under the
// roof's edges, with a gusset flap on each slope. The gussets fold in under
// the roof panels; they are cut free from the roof beside them, so slits
// run along those edges.
//
// Width, depth and height are the inside of the body; the roof's rise and
// the handle's height can be changed. Panels are creased one board wider, as
// on the tuck end die, and the walls three boards taller for the bottom.

/** Points along each round end of a finger hole in the 3D model; odd, so no strip is cut down to a point. */
const HOLE_STEPS = 5;
const holeSteps = Array.from({ length: HOLE_STEPS }, (_, i) => i);

type Wall = { id: 'front' | 'back'; W: 'Front' | 'Back' };
const ROOFED: Wall[] = [{ id: 'front', W: 'Front' }, { id: 'back', W: 'Back' }];
type End = { id: 'left' | 'right'; W: 'Left' | 'Right' };
const ENDS: End[] = [{ id: 'left', W: 'Left' }, { id: 'right', W: 'Right' }];

/** The finger hole's centre on a handle panel. */
const holeX = (wall: Wall) => `x${wall.W} + wall${wall.W} / 2`;

/** The finger hole: two half circles joined by straight cuts. */
const holeCuts = (wall: Wall): LineSpec[] => {
  const x = holeX(wall);
  return [
    { arc: { center: [`${x} - holeL`, 'holeY'], radius: 'holeR', from: 90, to: 270, segments: 12 } },
    { arc: { center: [`${x} + holeL`, 'holeY'], radius: 'holeR', from: -90, to: 90, segments: 12 } },
    { from: [`${x} - holeL`, 'holeY - holeR'], to: [`${x} + holeL`, 'holeY - holeR'] },
    { from: [`${x} - holeL`, 'holeY + holeR'], to: [`${x} + holeL`, 'holeY + holeR'] },
  ];
};

/**
 * A handle in 3D, as pieces round its finger hole so the hole shows: a strip
 * below the hole, one either side, one above, and slices filling the round
 * ends. The design grid and the cutting template keep the handle whole.
 */
const handlePieces = (wall: Wall): { panels: ModelPanelSpec[]; hinges: HingeSpec[] } => {
  const id = `${wall.id}-handle`;
  const [x0, x1, x] = [`x${wall.W}`, `x${wall.W} + wall${wall.W}`, holeX(wall)];
  const [top, bottom] = ['holeY - holeR', 'holeY + holeR'];
  const [left, right] = [`${x} - holeL - holeR`, `${x} + holeL + holeR`];
  // Around each end's half circle, from the bottom of the hole to its top.
  const end = (side: -1 | 1, i: number): [Expr, Expr] => {
    const angle = `${side < 0 ? 90 + 180 * i / HOLE_STEPS : 90 - 180 * i / HOLE_STEPS} * pi / 180`;
    return [`${x} ${side < 0 ? '-' : '+'} holeL + holeR * cos(${angle})`, `holeY + holeR * sin(${angle})`];
  };
  const panels: ModelPanelSpec[] = [
    { id: `${id}-base`, of: id, outline: [[x0, bottom], [x1, bottom], [x1, 'handle'], [x0, 'handle']] },
    { id: `${id}-left`, of: id, outline: [[x0, top], [left, top], [left, bottom], [x0, bottom]] },
    { id: `${id}-right`, of: id, outline: [[right, top], [x1, top], [x1, bottom], [right, bottom]] },
    { id: `${id}-top`, of: id, outline: [[x0, 0], [x1, 0], [x1, top], [x0, top]] },
    ...([-1, 1] as const).flatMap(side => holeSteps.map((i): ModelPanelSpec => {
      const [a, b] = [end(side, i), end(side, i + 1)];
      const edge = side < 0 ? left : right;
      return { id: `${id}-${side < 0 ? 'l' : 'r'}${i}`, of: id, outline: [[edge, a[1]], a, b, [edge, b[1]]] };
    })),
  ];
  const hinges: HingeSpec[] = [
    // The handle stands straight up whatever the roof's angle.
    { child: `${id}-base`, parent: `${wall.id}-roof`, angle: '-turnRoof' },
    { child: `${id}-left`, parent: `${id}-base`, angle: 0, sharp: true },
    { child: `${id}-right`, parent: `${id}-base`, angle: 0, sharp: true },
    { child: `${id}-top`, parent: `${id}-left`, angle: 0, sharp: true },
    ...([-1, 1] as const).flatMap(side => holeSteps.map((i): HingeSpec => (
      { child: `${id}-${side < 0 ? 'l' : 'r'}${i}`, parent: `${id}-${side < 0 ? 'left' : 'right'}`, angle: 0, sharp: true }
    ))),
  ];
  return { panels, hinges };
};

const handles = ROOFED.map(handlePieces);

/** A gable end over a side wall, and a gusset flap on each of its slopes. */
const gable = (end: End): PanelSpec[] => {
  const [x0, x1, peak] = [`x${end.W}`, `x${end.W} + wall${end.W}`, `x${end.W} + wall${end.W} / 2`];
  const label = end.id.toUpperCase();
  return [
    // Triangles: the fold engine takes four corners, so each repeats one.
    { id: `${end.id}-gable`, label: `${label} GABLE`, kind: 'flap', layer: 1, outline: [[x0, 'top'], [peak, 'top - gableH'], [x1, 'top']], fold: [[x0, 'top'], [peak, 'top - gableH'], [peak, 'top - gableH'], [x1, 'top']] },
    { id: `${end.id}-gusset-a`, label: `${label} GUSSET`, name: `${end.W} Gusset A`, kind: 'flap', layer: 0, closureFlap: true, outline: [[x0, 'top'], [x0, 'top - gableH'], [peak, 'top - gableH']], fold: [[x0, 'top'], [x0, 'top - gableH'], [peak, 'top - gableH'], [peak, 'top - gableH']] },
    { id: `${end.id}-gusset-b`, label: `${label} GUSSET`, name: `${end.W} Gusset B`, kind: 'flap', layer: 0, closureFlap: true, outline: [[x1, 'top'], [peak, 'top - gableH'], [x1, 'top - gableH']], fold: [[x1, 'top'], [peak, 'top - gableH'], [x1, 'top - gableH'], [x1, 'top - gableH']] },
  ];
};

export const gableBoxDefinition = {
  format: 'parametric-template/1',
  templateId: 'gable-box',
  structureKey: 'gable-v1',
  rendererKey: 'gable-v1',
  description: 'Gable box: a carton with a pitched roof, a carry handle with finger holes, gusseted gable ends and an auto-lock bottom.',
  parameters: {
    width: { fallback: 120, min: 1 },
    height: { fallback: 90, min: 1 },
    depth: { fallback: 70, min: 1 },
    thickness: { fallback: 0.5, min: 0.3, max: 2 },
  },
  derived: [
    ['t', 'thickness'],
    ['glue', 'clamp(0.3 * min(width, depth) + 4, 10, 15)'],
    // Crease to crease; the back, which the glue flap is stuck to, takes half a board less.
    ['wallFront', 'width + t'], ['wallBack', 'width + t / 2'], ['wallLeft', 'depth + t'], ['wallRight', 'depth + t'],
    ['bodyHeight', 'height + 3 * t'],
    ['glueSetback', 't + 1'],
    ['glueTaper', 'glue * tan(15 * pi / 180)'],
    ['dustRelief', 't + 0.5'],
    ['tuckInset', 't + 0.5'],
    // The roof rises `roof` from the walls to the ridge over the middle of
    // the box; the gable ends rise two boards less, to stay under it.
    ['roof', 'clamp(0.5 * depth, 10, 60)'],
    ['roofLen', 'sqrt(roof * roof + wallLeft * wallLeft / 4)'],
    ['gableH', 'max(1, roof - 2 * t)'],
    // The handle, and its finger hole a little above its middle.
    ['handle', 'clamp(0.35 * width, 30, 50)'],
    ['holeR', 'clamp(0.2 * handle, 5, 11)'],
    ['holeW', 'max(2 * holeR, min(80, 0.6 * width - 10))'],
    ['holeL', 'holeW / 2 - holeR'],
    ['holeY', '0.45 * handle'],
    ['top', 'handle + roofLen'],
    ['bottomCrease', 'top + bodyHeight'],
    ['xLeft', 'glue'], ['xFront', 'xLeft + wallLeft'], ['xRight', 'xFront + wallFront'], ['xBack', 'xRight + wallRight'],
    // At the bottom, the side walls stop two boards short so their flaps
    // crease above the front and back flaps and the glue tabs.
    ['wallBottomFront', 'bottomCrease'], ['wallBottomBack', 'bottomCrease'],
    ['wallBottomLeft', 'bottomCrease - 2 * t'], ['wallBottomRight', 'bottomCrease - 2 * t'],
    ['glueTop', 'top + glueSetback'],
    ['glueBottom', 'wallBottomLeft - glueSetback'],
    // The auto-lock bottom's flaps, as on that template.
    ['lockOverlap', 'clamp(0.2 * depth, 5, 15)'],
    ['lockStep', '0.15 * depth'],
    ['lockTall', '(depth + lockOverlap) / 2 + lockStep'],
    ['lockShort', '(depth + lockOverlap) / 2 - lockStep'],
    ['lockReach', '(lockTall + lockShort) / 2'],
    ['lockRelief', 'tuckInset'],
    ['sideFlap', 'max(6, min(0.45 * width, width / 2 - t - 1.5, wallLeft - dustRelief - 5, lockTall, wallFront / 2 - lockRelief))'],
    ['sideTaper', 'min(4, 0.15 * sideFlap)'],
    ['tabChamfer', 'min(4, 0.2 * sideFlap)'],
  ],
  adjustable: [
    { key: 'glue', label: 'Glue flap', min: 6, max: 'max(6, min(30, width / 2))' },
    { key: 'roof', label: 'Roof height', min: 5, max: 'max(5, min(150, 1.5 * depth))' },
    { key: 'handle', label: 'Handle height', min: 22, max: 'max(22, min(120, height))' },
    { key: 'sideFlap', label: 'Bottom side flaps', min: 6, max: 'max(6, min(width / 2 - t - 1.5, wallLeft - dustRelief - 5, lockTall, wallFront / 2 - lockRelief))' },
  ],
  panels: [
    { id: 'glue', label: 'GLUE', kind: 'glue', layer: 0, outline: [['glue', 'glueTop'], ['glue', 'glueBottom'], [0, 'glueBottom - glueTaper'], [0, 'glueTop + glueTaper']] },
    { id: 'left', label: 'LEFT', kind: 'body', layer: 1, rect: ['xLeft', 'top', 'wallLeft', 'wallBottomLeft - top'] },
    { id: 'front', label: 'FRONT', kind: 'body', layer: 1, rect: ['xFront', 'top', 'wallFront', 'wallBottomFront - top'] },
    { id: 'right', label: 'RIGHT', kind: 'body', layer: 1, rect: ['xRight', 'top', 'wallRight', 'wallBottomRight - top'] },
    { id: 'back', label: 'BACK', kind: 'body', layer: 1, rect: ['xBack', 'top', 'wallBack', 'wallBottomBack - top'] },
    ...ROOFED.flatMap((wall): PanelSpec[] => [
      { id: `${wall.id}-roof`, label: `${wall.id.toUpperCase()} ROOF`, kind: 'flap', layer: 2, rect: [`x${wall.W}`, 'handle', `wall${wall.W}`, 'roofLen'] },
      { id: `${wall.id}-handle`, label: `${wall.id.toUpperCase()} HANDLE`, kind: 'flap', layer: 2, rect: [`x${wall.W}`, 0, `wall${wall.W}`, 'handle'] },
    ]),
    ...ENDS.flatMap(gable),
    lockFlap('front'),
    lockFlap('back'),
    ...sideFlap('left'),
    ...sideFlap('right'),
  ],
  // Each gusset is cut free from the roof panel beside it.
  slits: [
    { from: ['xFront', 'top'], to: ['xFront', 'top - gableH'] },
    { from: ['xRight', 'top'], to: ['xRight', 'top - gableH'] },
    { from: ['xBack', 'top'], to: ['xBack', 'top - gableH'] },
  ],
  cuts: ROOFED.flatMap(holeCuts),
  validations: [
    { require: 'depth >= 20', message: 'The depth is too small for the bottom flaps to lock. Use a depth of at least 20 mm.' },
    { require: 'width >= 30', message: 'The width is too small for the bottom\'s side flaps and glue tabs. Use a width of at least 30 mm.' },
    { require: 'height >= 30', message: 'The height is too small for the glue flap and the bottom. Use a height of at least 30 mm.' },
  ],
  notes: [
    { text: 'Gable box: pitched roof with a carry handle, gusseted gable ends and an auto-lock (crash-lock) bottom.' },
    { text: 'Glue each bottom side flap\'s triangular tab to the front or back flap beside it, on the inside, so the bottom forms when the carton is opened. Fold the gussets in, close the roof and put the handles together.' },
    { text: 'Width, depth and height are inside sizes of the body; panels are creased one board ({t} mm) wider and the walls three boards taller for the bottom. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the roof and handles.' },
  ],
  // Folded from the cutting template: the body wraps round with the glue
  // flap stuck inside the back, and the bottom closes as the auto-lock
  // bottom's does. Then the gussets fold in, and last the roof panels come
  // down onto them, each handle staying upright until the two meet.
  fold: {
    root: 'front',
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.08))',
    // Centred on the whole box, roof and handle included, so the camera frames it all.
    offset: ['-(front.x + front.width / 2)', 'front.y + front.height / 2 - (roof + handle) / 2', 'depth / 2'],
    motions: [
      ['turnWalls', 'stage(formation, 0, 0.5) * (pi / 2)'],
      ['turnBack', 'stage(formation, 0.12, 0.6) * (pi / 2)'],
      ['turnTabs', 'stage(formation, 0.32, 0.46) * pi'],
      ['turnSides', 'stage(formation, 0.42, 0.56) * (pi / 2)'],
      ['turnFront', 'stage(formation, 0.5, 0.64) * (pi / 2)'],
      ['turnBackFlap', 'stage(formation, 0.56, 0.7) * (pi / 2)'],
      ['turnGusset', 'stage(formation, 0.68, 0.8) * (pi / 2)'],
      // Each roof leans in until its handle meets the other's over the middle.
      ['roofAngle', 'asin(clamp((wallLeft - foldT) / (2 * roofLen), 0, 1))'],
      ['turnRoof', 'stage(formation, 0.78, 1) * roofAngle'],
    ],
    hinges: [
      { child: 'left', parent: 'front', angle: 'turnWalls' },
      { child: 'right', parent: 'front', angle: 'turnWalls' },
      { child: 'back', parent: 'right', angle: 'turnBack' },
      { child: 'glue', parent: 'left', angle: 'turnBack', setback: 'foldT * 1.1' },
      { child: 'bottom-front', parent: 'front', angle: 'turnFront', setback: 'foldT' },
      { child: 'bottom-back', parent: 'back', angle: 'turnBackFlap' },
      { child: 'bottom-left', parent: 'left', angle: 'turnSides', setback: 'foldT * 2.6' },
      { child: 'bottom-right', parent: 'right', angle: 'turnSides', setback: 'foldT * 2.6' },
      { child: 'bottom-left-tab', parent: 'bottom-left', angle: '-turnTabs' },
      { child: 'bottom-right-tab', parent: 'bottom-right', angle: '-turnTabs' },
      ...ENDS.flatMap((end): HingeSpec[] => [
        { child: `${end.id}-gable`, parent: end.id, angle: 0, sharp: true },
        { child: `${end.id}-gusset-a`, parent: `${end.id}-gable`, angle: 'turnGusset', sharp: true },
        { child: `${end.id}-gusset-b`, parent: `${end.id}-gable`, angle: 'turnGusset', sharp: true },
      ]),
      { child: 'front-roof', parent: 'front', angle: 'turnRoof' },
      { child: 'back-roof', parent: 'back', angle: 'turnRoof' },
      ...handles.flatMap(handle => handle.hinges),
    ],
    modelPanels: handles.flatMap(handle => handle.panels),
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'closed',
    openingStage: 'never',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Gable box cutting template with a handle, gusseted gable ends and an auto-lock bottom. Your printer must approve the stock, crease allowances and glue tabs.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the roof, handles and bottom flaps.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/gable-box.webp',
    version: 1,
    name: 'Gable Box',
    shortName: 'Gable box',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Gable top carton with a carry handle and an auto-lock bottom: for gifts, bakery, takeaway food and party favours.',
    tags: ['gable box', 'gable top', 'handle box', 'carry box', 'gift box', 'favour box', 'auto lock bottom', 'paperboard'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 30, max: 400, step: 1, defaultValue: 120 },
      { key: 'height', label: 'Height', unit: 'mm', min: 30, max: 400, step: 1, defaultValue: 90 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 20, max: 250, step: 1, defaultValue: 70 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: panelRegions(['Front', 'Back', 'Left', 'Right', 'Front Roof', 'Back Roof', 'Front Handle', 'Back Handle', 'Left Gable', 'Right Gable', 'Bottom Front', 'Bottom Back']),
    defaultDimensions: { width: 120, height: 90, depth: 70, thickness: 0.5 },
  },
} satisfies ParametricTemplate;
