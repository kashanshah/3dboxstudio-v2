import type { ParametricTemplate, PanelSpec } from '../format';
import { panelRegions } from './artwork-regions';
import { dustFlapHinges, tongueCurl, TUCK_END_FOLD, tuckEndDie } from './tuck-end';

// The tuck top snap-lock bottom carton, also called a 1-2-3 bottom: the tuck
// end's top on the front, and a bottom closed by hand without glue. (1) The
// side flaps fold in, (2) the back flap folds over them, (3) the front flap
// folds over that and its tongue pushes in under the back flap's edge, where
// a half-moon notch lets it snap past. Built on the tuck end die (tuck-end.ts).
//
// Layers from the inside out: the side flaps, the back flap, the front flap.
// The die cuts the back wall a board short and the side walls two, so each
// flap creases above the ones that close after it.

const die = tuckEndDie({
  bottom: 'snap-lock',
  notes: [
    { text: 'Tuck top snap-lock (1-2-3) bottom: slit-locked top tuck, shouldered dust flaps, 15° glue flap and a thumb notch. No glue on the bottom.' },
    { text: 'To close the bottom: fold in the side flaps, then the back flap, then the front flap, and push its tongue in under the back flap\'s edge.' },
    { text: 'Width, depth and height are inside sizes; panels are creased one board ({t} mm) wider and the walls three boards taller for the bottom. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the closure flaps.' },
  ],
});

/** A side flap: a straight shoulder, then a taper, like a dust flap. */
const sideFlap = (wall: 'left' | 'right'): PanelSpec => {
  const W = wall === 'left' ? 'Left' : 'Right';
  const [y, l, r] = [`wallBottom${W}`, `x${W} + dustRelief`, `x${W} + wall${W} - dustRelief`];
  return {
    id: `bottom-${wall}`, label: `BOTTOM ${wall.toUpperCase()}`, kind: 'flap', layer: 0, closureFlap: true,
    outline: [[l, y], [r, y], [r, `${y} + snapSideShoulder`], [`${r} - snapSideTaper`, `${y} + snapSide`], [`${l} + snapSideTaper`, `${y} + snapSide`], [l, `${y} + snapSideShoulder`]],
    fold: [[l, y], [r, y], [`${r} - snapSideTaper`, `${y} + snapSide`], [`${l} + snapSideTaper`, `${y} + snapSide`]],
  };
};

export const snapLockBottomDefinition = {
  format: 'parametric-template/1',
  templateId: 'snap-lock-bottom-box',
  structureKey: 'snap-lock-bottom-v1',
  rendererKey: 'snap-lock-bottom-v1',
  description: 'Tuck top snap-lock (1-2-3) bottom carton: top tuck on the front, a bottom of four flaps closed by hand without glue.',
  ...die,
  derived: [
    ['topOnFront', 1], ['topOnBack', 0], ['topOnLeft', 0], ['topOnRight', 0],
    ...die.derived,
    // Side flaps reach across most of the width without meeting, like dust flaps.
    ['snapSide', 'max(6, min(width / 2 - t - 1.5, max(0.6 * depth, 12)))'],
    ['snapSideShoulder', 'min(3, snapSide / 3)'],
    ['snapSideTaper', 'max(0, min((snapSide - snapSideShoulder) * tan(20 * pi / 180), (wallLeft - 2 * dustRelief) / 2 - 2))'],
    // The back flap covers two thirds of the depth; the front flap overlaps it
    // and its tongue reaches on under it, stopping short of the back wall.
    ['snapBack', '0.65 * depth'],
    ['snapOverlap', 'clamp(0.1 * depth, 4, 12)'],
    ['snapFront', 'depth - snapBack + snapOverlap'],
    ['snapTongue', 'max(4, min(0.25 * depth, depth - snapFront - 2 * t))'],
    ['snapTongueWidth', 'max(10, min(wallFront / 3, wallFront - 2 * dustRelief - 8))'],
    ['snapTongueRadius', 'max(1, min(snapTongue / 2, snapTongueWidth / 4, 8))'],
    // A half-moon notch in the back flap's edge, where the tongue snaps in.
    ['snapNotch', 'max(2, min(8, snapTongueWidth / 4, snapBack / 4))'],
  ],
  adjustable: [
    ...die.adjustable!,
    { key: 'snapSide', label: 'Bottom side flaps', min: 6, max: 'max(6, width / 2 - t - 1.5)' },
    { key: 'snapTongue', label: 'Bottom lock tongue', min: 4, max: 'max(4, depth - snapFront - 2 * t)' },
  ],
  panels: [
    ...die.panels,
    // (3) The front flap, outermost, with the lock tongue in the middle.
    {
      id: 'bottom-front', label: 'BOTTOM FRONT', kind: 'flap', layer: 3,
      outline: [
        ['xFront', 'wallBottomFront'], ['xFront + wallFront', 'wallBottomFront'],
        ['xFront + wallFront', 'wallBottomFront + snapFront'],
        ['xFront + wallFront / 2 + snapTongueWidth / 2', 'wallBottomFront + snapFront'],
        { arc: { center: ['xFront + wallFront / 2 + snapTongueWidth / 2 - snapTongueRadius', 'wallBottomFront + snapFront + snapTongue - snapTongueRadius'], radius: 'snapTongueRadius', from: 0, to: 90, segments: 6 } },
        { arc: { center: ['xFront + wallFront / 2 - snapTongueWidth / 2 + snapTongueRadius', 'wallBottomFront + snapFront + snapTongue - snapTongueRadius'], radius: 'snapTongueRadius', from: 90, to: 180, segments: 6 } },
        ['xFront + wallFront / 2 - snapTongueWidth / 2', 'wallBottomFront + snapFront'],
        ['xFront', 'wallBottomFront + snapFront'],
      ],
      // The tongue tucks out of sight under the back flap; the model keeps the shoulders.
      fold: [['xFront', 'wallBottomFront'], ['xFront + wallFront', 'wallBottomFront'], ['xFront + wallFront', 'wallBottomFront + snapFront'], ['xFront', 'wallBottomFront + snapFront']],
    },
    // (2) The back flap, with the half-moon notch the tongue snaps past.
    {
      id: 'bottom-back', label: 'BOTTOM BACK', kind: 'flap', layer: 2,
      outline: [
        ['xBack', 'wallBottomBack'], ['xBack + wallBack', 'wallBottomBack'],
        ['xBack + wallBack', 'wallBottomBack + snapBack'],
        { arc: { center: ['xBack + wallBack / 2', 'wallBottomBack + snapBack'], radius: 'snapNotch', from: 0, to: -180, segments: 8 } },
        ['xBack', 'wallBottomBack + snapBack'],
      ],
      fold: [['xBack', 'wallBottomBack'], ['xBack + wallBack', 'wallBottomBack'], ['xBack + wallBack', 'wallBottomBack + snapBack'], ['xBack', 'wallBottomBack + snapBack']],
    },
    // (1) The side flaps, innermost.
    sideFlap('left'),
    sideFlap('right'),
  ],
  validations: [
    ...die.validations!,
    { require: 'depth >= 20', message: 'The depth is too small for the bottom flaps to lock. Use a depth of at least 20 mm.' },
    { require: 'width >= 30', message: 'The width is too small for the bottom\'s lock tongue. Use a width of at least 30 mm.' },
  ],
  // Folded from the cutting template: the body wraps round with the glue flap
  // stuck inside the back. The bottom closes in its 1-2-3 order, every flap
  // swinging up from below: the side flaps, the back flap, then the front
  // flap. The top closes like the straight tuck end's.
  fold: {
    ...TUCK_END_FOLD,
    motions: [
      ['turnWalls', 'stage(formation, 0, 0.6) * (pi / 2)'],
      ['turnBack', 'stage(formation, 0.15, 0.75) * (pi / 2)'],
      ['turnSides', 'stage(formation, 0.45, 0.62) * (pi / 2)'],
      ['turnBackFlap', 'stage(formation, 0.56, 0.74) * (pi / 2)'],
      ['turnFront', 'stage(formation, 0.66, 0.84) * (pi / 2)'],
      ['turnTopDust', 'stage(formation, 0.8, 0.88) * (pi / 2)'],
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
      ...dustFlapHinges('snap-lock', () => 'turnTopDust', 'foldT * 1.1'),
      { child: 'bottom-left', parent: 'left', angle: 'turnSides' },
      { child: 'bottom-right', parent: 'right', angle: 'turnSides' },
      { child: 'bottom-back', parent: 'back', angle: 'turnBackFlap' },
      { child: 'bottom-front', parent: 'front', angle: 'turnFront' },
    ],
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'closed',
    openingStage: 'never',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Tuck top snap-lock (1-2-3) bottom cutting template. Your printer must approve the stock and crease allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the bottom and closure flaps.',
  },
  catalog: {
    defaultMaterial: 'White board',
    thumbnail: '/images/templates/snap-lock-bottom-box.webp',
    version: 1,
    name: 'Snap Lock Bottom Box',
    shortName: 'Snap-lock bottom',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Tuck top carton with a 1-2-3 snap-lock bottom that folds closed by hand with no glue: stronger than a tuck, cheaper than a crash lock.',
    tags: ['carton', 'snap lock bottom', '1-2-3 bottom', 'lock bottom', 'tuck top', 'retail', 'paperboard'],
    capabilities: ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 30, max: 400, step: 1, defaultValue: 90 },
      { key: 'height', label: 'Height', unit: 'mm', min: 40, max: 500, step: 1, defaultValue: 130 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 20, max: 250, step: 1, defaultValue: 60 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: panelRegions(['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom Front', 'Bottom Back']),
    defaultDimensions: { width: 90, height: 130, depth: 60, thickness: 0.5 },
  },
} satisfies ParametricTemplate;
