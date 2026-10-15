import type { Expr } from '../expression';
import type { HingeSpec, ModelPanelSpec, ParametricTemplate, PanelSpec, SurfaceSpec } from '../format';
import { panelRegions } from './artwork-regions';

// A pillow box: one piece of board, two faces and a glue flap, closed at
// each end by curved creases instead of glue or tucks. The faces bow out into
// a lens-shaped tube; at each end, pushing the two curved flaps in closes the
// box to a straight pinch across its width.
//
// On the sheet the box lies along x: the front face, then the back face below
// it, then the glue flap. Each face's ends are creased along circular arcs
// that dip into the face, and beyond each crease is a curved end flap.
// Width is the length tip to tip, depth the distance across and height the
// thickness at the middle, all outside sizes of the closed pillow.
//
// The faces bend rather than fold, which the fold engine's rigid panels can't
// do, so the 3D model folds each face as narrow strips along its length
// (model panels), bowed by small angles into the lens, and draws each end
// flap as a curved surface from the strips' ends to the pinch. The design
// grid and cutting template keep each face and flap whole.

/** Strips per face in the 3D model; odd, so the middle strip of the front stays still. */
const STRIPS = 9;
/** Points along each curved crease on the cutting template: two per strip. */
const SAMPLES = STRIPS * 2;
const samples = Array.from({ length: SAMPLES + 1 }, (_, i) => i);
const strips = Array.from({ length: STRIPS }, (_, k) => k);

type Face = { id: 'front' | 'back'; y: string };
const FACES: Face[] = [
  { id: 'front', y: 'yFront' },
  { id: 'back', y: 'yBack' },
];
type End = { id: 'left' | 'right'; End: 'LEFT' | 'RIGHT'; /** x of the crease at sample i, and of the flap's edge. */ crease: (i: number) => string; edge: (i: number, depth: string) => string };
const ENDS: End[] = [
  { id: 'right', End: 'RIGHT', crease: i => `xRight - e${i}`, edge: (i, depth) => `xRight - e${i} + ${depth}` },
  { id: 'left', End: 'LEFT', crease: i => `xLeft + e${i}`, edge: (i, depth) => `xLeft + e${i} - ${depth}` },
];
const across = (face: Face, i: number) => `${face.y} + u${i}`;
/** How far the end creases dip into a face at `u` across it. */
const dipAt = (u: string) => `max(0, sqrt(max(0, creaseR * creaseR - pow(${u} - faceW / 2, 2))) - (creaseR - endCurve))`;
/** Points along each end of the glue flap. */
const GLUE_STEPS = 4;
const glueSteps = Array.from({ length: GLUE_STEPS + 1 }, (_, j) => j);

/** A face: straight sides along the tips, curved creases at both ends. */
const facePanel = (face: Face): PanelSpec => ({
  id: face.id, label: face.id.toUpperCase(), kind: 'body', layer: 1,
  outline: [
    ...samples.map((i): [Expr, Expr] => [`xRight - e${i}`, across(face, i)]),
    ...[...samples].reverse().map((i): [Expr, Expr] => [`xLeft + e${i}`, across(face, i)]),
  ],
  fold: [['xLeft', face.y], ['xRight', face.y], ['xRight', `${face.y} + faceW`], ['xLeft', `${face.y} + faceW`]],
});

/** An end flap: the crease, then the curved cut, meeting it at both tips. */
const endPanel = (face: Face, end: End): PanelSpec => ({
  id: `${face.id}-${end.id}`, label: `${face.id.toUpperCase()} ${end.End} END`, kind: 'flap', layer: 2,
  outline: [
    ...samples.map((i): [Expr, Expr] => [end.crease(i), across(face, i)]),
    ...samples.slice(1, -1).reverse().map((i): [Expr, Expr] => [end.edge(i, `f${i}`), across(face, i)]),
  ],
  // The model draws the flap as a surface (endSurface), so these corners only satisfy the format.
  fold: [[end.crease(0), face.y], [end.edge(STRIPS, `f${STRIPS}`), across(face, STRIPS)], [end.crease(SAMPLES), `${face.y} + faceW`], [end.crease(STRIPS), across(face, STRIPS)]],
});

/** The 3D model's strips of a face. */
const modelPanels = (face: Face): ModelPanelSpec[] => strips.map(k => {
  const [a, b] = [2 * k, 2 * k + 2];
  return {
    id: `${face.id}-${k}`, of: face.id,
    outline: [[`xLeft + e${a}`, across(face, a)], [`xRight - e${a}`, across(face, a)], [`xRight - e${b}`, across(face, b)], [`xLeft + e${b}`, across(face, b)]],
  };
});

/**
 * An end flap in 3D: from its crease, carried by the face's strips, to its
 * edge. Open, the flap runs straight on from each strip; as the box closes,
 * the edge swings in to the pinch, a straight line across the box's end at
 * its middle, where it meets the other face's flap.
 */
const endSurface = (face: Face, end: End): SurfaceSpec => {
  const strip = (i: number) => `${face.id}-${Math.min(STRIPS - 1, Math.floor(i / 2))}`;
  // On the straight end of its strip, so the flap starts exactly where the strip stops.
  const crease = (i: number): [Expr, Expr] => [i % 2 ? `(${end.crease(i - 1)} + ${end.crease(i + 1)}) / 2` : end.crease(i), across(face, i)];
  const edge = (i: number): [Expr, Expr] => [end.edge(i, `f${i}`), across(face, i)];
  const pinchX = end.id === 'right' ? 'width / 2' : '-width / 2';
  return {
    of: `${face.id}-${end.id}`,
    rows: [
      samples.map(i => ({ place: { on: strip(i), at: crease(i) }, flat: crease(i) })),
      samples.map(i => ({
        place: { mix: [{ on: strip(i), at: edge(i) }, { from: { on: strip(i), at: crease(i) }, set: { x: pinchX, y: 0 } }], t: 'close' },
        flat: edge(i),
      })),
    ],
  };
};

/** The front bows out from its middle strip; the back hangs from the front's far tip. */
const hinges = (): HingeSpec[] => {
  const middle = (STRIPS - 1) / 2;
  const list: HingeSpec[] = [];
  for (let k = middle - 1; k >= 0; k--) list.push({ child: `front-${k}`, parent: `front-${k + 1}`, angle: 'bow' });
  for (let k = middle + 1; k < STRIPS; k++) list.push({ child: `front-${k}`, parent: `front-${k - 1}`, angle: 'bow' });
  // The sides are crisp folds, so the faces meet exactly at both tips.
  list.push({ child: 'back-0', parent: `front-${STRIPS - 1}`, angle: 'tip', sharp: true });
  for (let k = 1; k < STRIPS; k++) list.push({ child: `back-${k}`, parent: `back-${k - 1}`, angle: 'bow' });
  // Sharp too: a rounded bend would trim the last strip, whose slanted ends
  // would pull its corner back from the tip.
  list.push({ child: 'glue', parent: `back-${STRIPS - 1}`, angle: 'tip', setback: 'foldT * 1.1', sharp: true });
  return list;
};

export const pillowBoxDefinition = {
  format: 'parametric-template/1',
  templateId: 'pillow-box',
  structureKey: 'pillow-v1',
  rendererKey: 'pillow-v1',
  description: 'Pillow box: two bowed faces and a glue flap, closed at both ends by curved creases and flaps that push in.',
  parameters: {
    width: { fallback: 160, min: 1 },
    height: { fallback: 40, min: 1 },
    depth: { fallback: 90, min: 1 },
    thickness: { fallback: 0.4, min: 0.3, max: 1 },
  },
  derived: [
    ['t', 'thickness'],
    ['h', 'height / 2'],
    // Each face bows into a circular arc across the width, rising h at the middle.
    ['lensR', '(depth * depth / 4 + h * h) / (2 * h)'],
    ['lensA', 'asin(min(1, depth / (2 * lensR)))'],
    ['faceW', '2 * lensR * lensA'],
    // How far the end creases dip into each face at the middle: the deeper,
    // the longer and gentler the taper to the pinch.
    ['endCurve', 'max(1, min(1.4 * h, width / 4, faceW / 2))'],
    ['creaseR', '(faceW * faceW / 4 + endCurve * endCurve) / (2 * endCurve)'],
    ['glue', 'clamp(0.15 * depth, 8, 14)'],
    ['glueCut', 't + 1.5'],
    ['yFront', 0], ['yBack', 'faceW'], ['yGlue', '2 * faceW'],
    // Along each crease: the dip e, the face's height y above the middle of
    // the box and its tilt th there, and the end flap's depth f, which
    // reaches from the crease to the pinch.
    ...samples.flatMap((i): [string, Expr][] => [
      [`u${i}`, `${i} / ${SAMPLES} * faceW`],
      [`e${i}`, dipAt(`u${i}`)],
      [`th${i}`, `(u${i} - faceW / 2) / lensR`],
      [`y${i}`, `max(0, lensR * cos(th${i}) - (lensR - h))`],
      [`f${i}`, `max(0, sqrt(e${i} * e${i} + y${i} * y${i}) - t)`],
    ]),
    // The sheet starts where the end flaps reach furthest past the tips.
    ['xLeft', `max(${samples.map(i => `f${i} - e${i}`).join(', ')})`], ['xRight', 'xLeft + width'],
    // The 3D fold: each strip turns `bowAngle` from the next and the faces meet at the tips.
    ['bowAngle', `2 * lensA / ${STRIPS}`],
    ['glueModel', `min(glue, 0.9 * faceW / ${STRIPS})`],
    ['tipAngle', `pi - ${STRIPS - 1} * bowAngle`],
  ],
  adjustable: [
    { key: 'glue', label: 'Glue flap', min: 6, max: 'max(6, min(25, depth / 3))' },
  ],
  panels: [
    ...FACES.map(facePanel),
    ...FACES.flatMap(face => ENDS.map(end => endPanel(face, end))),
    // The glue flap lies inside the front along its edge, so its ends follow
    // the front's end creases there, set in a little.
    { id: 'glue', label: 'GLUE', kind: 'glue', layer: 0,
      outline: [
        ...glueSteps.map((j): [Expr, Expr] => [`xRight - glueCut - ${dipAt(`${j} / ${GLUE_STEPS} * glue`)}`, `yGlue + ${j} / ${GLUE_STEPS} * glue`]),
        ...[...glueSteps].reverse().map((j): [Expr, Expr] => [`xLeft + glueCut + ${dipAt(`${j} / ${GLUE_STEPS} * glue`)}`, `yGlue + ${j} / ${GLUE_STEPS} * glue`]),
      ],
      fold: [['xLeft + glueCut', 'yGlue'], ['xRight - glueCut', 'yGlue'], ['xRight - glueCut', 'yGlue + glue'], ['xLeft + glueCut', 'yGlue + glue']],
      // In 3D the flap is flat against the front's first strip, so it is
      // drawn no wider than that strip: any wider and it would run on
      // straight while the bowed front curves away, and show through it. It
      // is hidden inside, so the narrower model doesn't show. The corners
      // stay inside the end creases all the way across.
      model: [['xLeft + glueCut', 'yGlue'], ['xRight - glueCut', 'yGlue'], [`xRight - glueCut - ${dipAt('glueModel')}`, 'yGlue + glueModel'], [`xLeft + glueCut + ${dipAt('glueModel')}`, 'yGlue + glueModel']],
    },
  ],
  validations: [
    { require: 'height <= 0.7 * depth', message: 'The pillow is too thick for its depth. Use a height of at most {floor(0.7 * depth + 1e-6)} mm.' },
    { require: 'height >= 8', message: 'The pillow is too thin to close. Use a height of at least 8 mm.' },
    { require: 'width >= 3 * endCurve', message: 'The pillow is too short for its end curves. Use a width of at least {ceil(3 * endCurve - 1e-6)} mm.' },
    { require: 'depth >= 30', message: 'The pillow is too narrow for the glue flap. Use a depth of at least 30 mm.' },
  ],
  notes: [
    { text: 'Pillow box: two faces and a glue flap, closed at both ends by curved creases. No glue at the ends.' },
    { text: 'Width, depth and height are the outside of the closed pillow: tip to tip, across, and through the middle. Score the curved creases cleanly; ask your printer to confirm them for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the end flaps.' },
  ],
  fold: {
    root: `front-${(STRIPS - 1) / 2}`,
    thickness: 'max(0.05, min(thickness, height * 0.05))',
    // Lying flat, front up, the length running left to right.
    matrix: [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, '-(xLeft + width / 2)', 'h', '-faceW / 2', 1],
    motions: [
      ['form', 'stage(formation, 0, 0.55)'],
      ['bow', 'form * bowAngle'],
      ['tip', 'form * tipAngle'],
      ['close', 'stage(formation, 0.6, 1)'],
    ],
    hinges: hinges(),
    modelPanels: FACES.flatMap(modelPanels),
    surfaces: FACES.flatMap(face => ENDS.map(end => endSurface(face, end))),
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'closed',
    openingStage: 'never',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Pillow box cutting template with curved end creases and a glue flap. Your printer must approve the stock and the curved scores.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the end flaps.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/pillow-box.webp',
    version: 1,
    name: 'Pillow Box',
    shortName: 'Pillow box',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Curved pillow box that closes by pushing in its ends: for gifts, jewellery, favours and small accessories.',
    tags: ['pillow box', 'pillow pack', 'gift box', 'favour box', 'curved', 'paperboard'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 60, max: 400, step: 1, defaultValue: 160 },
      { key: 'height', label: 'Height', unit: 'mm', min: 8, max: 150, step: 1, defaultValue: 40 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 30, max: 300, step: 1, defaultValue: 90 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 1, step: 0.1, defaultValue: 0.4 },
    ],
    artworkRegions: panelRegions(['Front', 'Back', 'Front Right End', 'Front Left End', 'Back Right End', 'Back Left End']),
    defaultDimensions: { width: 160, height: 40, depth: 90, thickness: 0.4 },
  },
} satisfies ParametricTemplate;
