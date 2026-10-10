import type { ParametricTemplate } from '../format';
import { BOX_FACES, panelRegions } from './artwork-regions';
import { dustFlapHinges, tongueCurl, TUCK_END_FOLD, tuckEndDie } from './tuck-end';

// The base box is a straight tuck end carton (ECMA A15.20): both lids hinge on
// the front, so the top and bottom tuck into the back. A design may hinge its
// lid on another wall instead, or open the front as doors; the bottom always
// hinges on the front. The die is shared with every tuck end (tuck-end.ts).

const lidOn = (wall: 'Front' | 'Back' | 'Left' | 'Right', extra: Record<string, number> = {}) => ({
  topOnFront: 0, topOnBack: 0, topOnLeft: 0, topOnRight: 0, [`topOn${wall}`]: 1,
  hingedLid: 0, leftDoor: 0, rightDoor: 0, ...extra,
});

const NOTE_TAIL = 'slit-locked tucks, shouldered dust flaps, 15° glue flap and a thumb notch.';

const die = tuckEndDie({
  bottom: 'front',
  notes: [
    { when: 'topOnFront', text: `Straight tuck end (ECMA A15.20): ${NOTE_TAIL}` },
    { when: 'topOnBack', text: `Tuck end carton with the lid hinged on the back: ${NOTE_TAIL}` },
    { when: 'topOnLeft', text: `Tuck end carton with the lid hinged on the left: ${NOTE_TAIL}` },
    { when: 'topOnRight', text: `Tuck end carton with the lid hinged on the right: ${NOTE_TAIL}` },
    { text: 'Width, depth and height are inside sizes; panels are creased one board ({t} mm) wider. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the closure flaps.' },
  ],
});

export const baseBoxDefinition = {
  format: 'parametric-template/1',
  templateId: 'base-box',
  structureKey: 'base-box-v1',
  rendererKey: 'base-box-v1',
  description: 'Straight tuck end carton; the opening mode picks the wall the top lid hinges on, or opens the front as doors.',
  options: [{
    source: 'openingMode',
    default: 'closed',
    choices: {
      closed: lidOn('Front'),
      lid_from_front: lidOn('Front', { hingedLid: 1 }),
      lid_from_back: lidOn('Back', { hingedLid: 1 }),
      lid_from_left: lidOn('Left', { hingedLid: 1 }),
      lid_from_right: lidOn('Right', { hingedLid: 1 }),
      door_left: lidOn('Front', { leftDoor: 1 }),
      door_right: lidOn('Front', { rightDoor: 1 }),
      double_doors: lidOn('Front', { leftDoor: 1, rightDoor: 1 }),
    },
  }],
  ...die,
  // Folded from the cutting template: the body strip wraps round with the
  // glue flap stuck inside the back, then each end closes like a real carton:
  // dust flaps in, the tuck pre-folded, the lid down and the tuck in behind
  // the opposite wall. A hinged lid closes only once the carton has formed and
  // opens with the slider; doors swing open about the front's creases.
  fold: {
    ...TUCK_END_FOLD,
    motions: [
      ['turnWalls', 'stage(formation, 0, 0.6) * (pi / 2)'],
      ['turnBack', 'stage(formation, 0.15, 0.75) * (pi / 2)'],
      ['turnBottomDust', 'stage(formation, 0.45, 0.58) * (pi / 2)'],
      ['turnBottomPrefold', 'stage(formation, 0.58, 0.66) * (pi / 2)'],
      ['turnBottom', 'stage(formation, 0.62, 0.82) * (pi / 2)'],
      ['turnTopDust', 'stage(formation, 0.78, 0.88) * (pi / 2)'],
      ['turnTopPrefold', 'stage(formation, 0.88, 0.94) * (pi / 2)'],
      ['turnTop', '(hingedLid ? (1 - opening) * stage(formation, 0.9, 1) : stage(formation, 0.9, 1)) * (pi / 2)'],
      ['turnDoor', 'stage(formation, 0.8, 1) * opening * (pi / 2)'],
      // The tuck that slides into the back also passes the glue flap stuck there.
      ['topClear', 'topOnFront ? foldT * 2.2 : foldT * 1.1'],
      ['bottomClear', 'foldT * 2.2'],
      ['topReach', 'topOnFront || topOnBack ? depth : width'],
    ],
    hinges: [
      { child: 'left', parent: 'front', angle: 'turnWalls - (leftDoor ? turnDoor : 0)' },
      { child: 'right', parent: 'front', angle: 'turnWalls - (rightDoor ? turnDoor : 0)' },
      { child: 'back', parent: 'right', angle: 'turnBack' },
      // On a left door the glue flap keeps facing the same way as the door
      // starts to open, so its edge never sweeps through the back, and lies
      // back against the door once it is open.
      { child: 'glue', parent: 'left', angle: 'turnBack + (leftDoor ? turnDoor * (1 - 0.3 * pow(turnDoor / (pi / 2), 2)) : 0)', setback: 'foldT * 1.1' },
      { child: 'top', parent: 'front', when: 'topOnFront', angle: 'turnTop' },
      { child: 'top', parent: 'back', when: 'topOnBack', angle: 'turnTop' },
      { child: 'top', parent: 'left', when: 'topOnLeft', angle: 'turnTop' },
      { child: 'top', parent: 'right', when: 'topOnRight', angle: 'turnTop' },
      { child: 'bottom', parent: 'front', angle: 'turnBottom' },
      { child: 'top-tuck', parent: 'top', angle: tongueCurl('turnTopPrefold', 'turnTop', 'topReach', 'topTongue', 'topClear'), setback: 'topClear' },
      { child: 'bottom-tuck', parent: 'bottom', angle: tongueCurl('turnBottomPrefold', 'turnBottom', 'depth', 'bottomTongue', 'bottomClear'), setback: 'bottomClear' },
      ...dustFlapHinges('front', end => (end === 'top' ? 'turnTopDust' : 'turnBottomDust'), 'foldT * 1.1'),
    ],
  },
  assembly: {
    control: 'opening-mechanism',
    defaultOpeningMode: 'closed',
    openingStage: { except: ['closed'] },
  },
  export: {
    kind: 'cutting-template',
    summary: 'Straight tuck end cutting template with closure flaps. Your printer must approve the stock and crease allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the tuck and dust flaps.',
  },
  catalog: {
    thumbnail: '/images/templates/base-box.webp',
    version: 1,
    name: 'Straight Tuck End Box',
    shortName: 'Straight tuck',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Folding carton with both tuck lids on the front: slit-locked tucks, dust flaps and a tapered glue flap.',
    tags: ['carton', 'tuck', 'straight tuck', 'retail', 'paperboard', 'hinged lid', 'door'],
    capabilities: ['dieline', '3d', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 1, step: 1, defaultValue: 65 },
      { key: 'height', label: 'Height', unit: 'mm', min: 1, step: 1, defaultValue: 160 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 1, step: 1, defaultValue: 65 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: panelRegions(BOX_FACES),
    defaultDimensions: { width: 65, height: 160, depth: 65, thickness: 0.5 },
  },
} satisfies ParametricTemplate;
