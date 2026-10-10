import type { ParametricTemplate } from '../format';
import { dustFlapHinges, tongueCurl, TUCK_END_FOLD, tuckEndDie } from './tuck-end';

// The reverse tuck end carton (ECMA A20.20): the top lid hinges on the front
// and the bottom lid on the back, so each tucks into the opposite wall.
// Hinged on the back, the bottom sits upside down on the sheet: artwork placed
// on it alone is turned half a turn to read upright on the box. The die is
// shared with every tuck end (tuck-end.ts).

const die = tuckEndDie({
  bottom: 'back',
  bottomRotation: 180,
  notes: [
    { text: 'Reverse tuck end (ECMA A20.20): slit-locked tucks, shouldered dust flaps, 15° glue flap and a thumb notch.' },
    { text: 'Width, depth and height are inside sizes; panels are creased one board ({t} mm) wider. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the closure flaps.' },
  ],
});

/** The studio's fold stages, eased in and out (cubic), from the formation slider. */
const foldStage = (name: string, start: number, end: number): [string, string][] => [
  [`${name}Local`, `clamp((formation - ${start}) / max(0.001, ${end} - ${start}), 0, 1)`],
  [name, `${name}Local < 0.5 ? 4 * ${name}Local * ${name}Local * ${name}Local : 1 - pow(-2 * ${name}Local + 2, 3) / 2`],
];

export const reverseTuckDefinition = {
  format: 'parametric-template/1',
  templateId: 'reverse-tuck-carton',
  structureKey: 'reverse-tuck-v1',
  rendererKey: 'reverse-tuck-v1',
  description: 'Reverse tuck end carton: top lid on the front, bottom lid on the back.',
  ...die,
  derived: [
    ['topOnFront', 1], ['topOnBack', 0], ['topOnLeft', 0], ['topOnRight', 0],
    ...die.derived,
  ],
  // Folded from the cutting template, every flap in the print file moving in
  // 3D. Each closure folds like a real carton: dust flaps in, the tuck tongue
  // pre-folded, then the lid swings down and the tongue slides in behind the
  // opposite panel. Flaps that end up behind another panel crease a little
  // lower, so they rest against that panel's inside.
  fold: {
    ...TUCK_END_FOLD,
    motions: [
      ...foldStage('foldWalls', 0.08, 0.52),
      ...foldStage('foldBack', 0.26, 0.68),
      ...foldStage('foldBottom', 0.54, 0.84),
      ...foldStage('foldTop', 0.70, 1.0),
      ['turnTop', 'stage(foldTop, 0.25, 1) * (pi / 2)'],
      ['turnBottom', 'stage(foldBottom, 0.25, 1) * (pi / 2)'],
      ['topPrefold', 'stage(foldTop, 0.1, 0.5) * (pi / 2)'],
      ['bottomPrefold', 'stage(foldBottom, 0.1, 0.5) * (pi / 2)'],
    ],
    hinges: [
      { child: 'left', parent: 'front', angle: 'foldWalls * (pi / 2)' },
      { child: 'right', parent: 'front', angle: 'foldWalls * (pi / 2)' },
      { child: 'glue', parent: 'left', angle: 'foldBack * (pi / 2)', setback: 'foldT * 1.1' },
      { child: 'back', parent: 'right', angle: 'foldBack * (pi / 2)' },
      { child: 'top', parent: 'front', angle: 'turnTop' },
      { child: 'bottom', parent: 'back', angle: 'turnBottom' },
      // The tip clears the opposite wall's board, and at the top the glue
      // flap stuck inside the back; both tongues are the top lid's size.
      { child: 'top-tuck', parent: 'top', angle: tongueCurl('topPrefold', 'turnTop', 'depth', 'topTongue', 'foldT * 2'), setback: 'foldT * 2.2' },
      { child: 'bottom-tuck', parent: 'bottom', angle: tongueCurl('bottomPrefold', 'turnBottom', 'depth', 'topTongue', 'foldT * 2'), setback: 'foldT * 1.1' },
      ...dustFlapHinges('back', end => (end === 'top' ? 'stage(foldTop, 0, 0.4) * (pi / 2)' : 'stage(foldBottom, 0, 0.4) * (pi / 2)'), 'foldT * 1.1'),
    ],
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'closed',
    legacyOpeningAsFormation: true,
    openingStage: 'never',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Cutting template with closure flaps. Your printer must approve the stock and crease allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the tuck and dust flaps.',
  },
} satisfies ParametricTemplate;
