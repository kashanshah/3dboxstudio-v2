import type { ParametricTemplate } from '../format';

// The split top box: a regular slotted container (FEFCO 0201) or, with every
// top flap meeting in the middle, a centre special slotted container (FEFCO
// 0204). The studio builds it from this definition. It replaced a
// hand-written template, kept frozen in scripts/reference, and
// scripts/parametric-templates.test.cjs checks the two still produce the same
// cutting template and 3D model.

export const splitTopDefinition = {
  format: 'parametric-template/1',
  templateId: 'split-top-box',
  structureKey: 'split-top-box-v1',
  rendererKey: 'split-top-box-v1',
  description: 'One strip of joint, front, right, back and left with a slotted flap on every wall at each end. Width, depth and height are inside sizes.',
  parameters: {
    width: { fallback: 120, min: 1 },
    height: { fallback: 180, min: 1 },
    depth: { fallback: 55, min: 1 },
    // Single-wall corrugated is 1.5-4 mm, double wall up to 7 mm.
    thickness: { fallback: 3, min: 0.3, max: 7 },
  },
  options: [{
    source: 'splitTopHingeSide',
    default: 'side_a',
    choices: {
      // FEFCO 0204: the outer top flaps are on the end walls and every top flap meets in the middle.
      side_a: { outerTopIsEnd: 1 },
      // FEFCO 0201: the outer top flaps are on the long walls.
      side_b: { outerTopIsEnd: 0 },
    },
  }],
  derived: [
    ['t', 'thickness'],
    ['corrugated', 't >= 1.5'],
    // About 6 mm on single wall, wider on double wall; on folding board a
    // board and a millimetre, at least the 3 mm a score bends through.
    ['slot', 'corrugated ? max(6, 2 * t) : max(3, t + 1)'],
    // The manufacturer's joint: 30-40 mm on corrugated, 12-15 mm on board.
    ['joint', 'corrugated ? 35 : 14'],
    ['jointCutBack', 'slot / 2'],
    ['jointTaper', 'min(joint, 10)'],
    // Each panel is scored one board wider, the height two boards taller.
    ['long', 'width + t'],
    ['end', 'depth + t'],
    // The end wall the joint is stuck to takes half a board less.
    ['jointEnd', 'depth + t / 2'],
    ['wallHeight', 'height + 2 * t'],
    // Flaps are half the end wall long so the long walls' flaps meet; outer
    // flaps on the end walls are half the long wall and meet too.
    ['endTopFlap', 'outerTopIsEnd ? long / 2 : end / 2'],
    ['top', 'max(endTopFlap, end / 2)'],
    ['bottom', 'top + wallHeight'],
    ['xFront', 'joint'],
    ['xRight', 'xFront + long'],
    ['xBack', 'xRight + end'],
    ['xLeft', 'xBack + long'],
  ],
  panels: [
    { id: 'glue', label: 'GLUE', kind: 'glue', layer: 0, outline: [
      ['joint', 'top + jointCutBack'], ['joint', 'bottom - jointCutBack'],
      [0, 'bottom - jointCutBack - jointTaper'], [0, 'top + jointCutBack + jointTaper'],
    ] },
    // Each wall with a flap at each end. Slots either side of every flap, half
    // on each neighbour, let them fold past each other. Outer flaps draw over
    // inner ones; the outer top pair depends on the split direction.
    {
      repeat: [
        { wall: 'front', Wall: 'Front', WALL: 'FRONT', x: 'xFront', width: 'long', topFlap: 'end / 2', topLayer: 'outerTopIsEnd ? 2 : 3', bottomLayer: 3, fallback: { name: 'Bottom', uv: [0, 0.5, 1, 0.5] } },
        { wall: 'right', Wall: 'Right', WALL: 'RIGHT', x: 'xRight', width: 'end', topFlap: 'endTopFlap', topLayer: 'outerTopIsEnd ? 3 : 2', bottomLayer: 2, fallback: null },
        { wall: 'back', Wall: 'Back', WALL: 'BACK', x: 'xBack', width: 'long', topFlap: 'end / 2', topLayer: 'outerTopIsEnd ? 2 : 3', bottomLayer: 3, fallback: { name: 'Bottom', uv: [0, 0, 1, 0.5] } },
        { wall: 'left', Wall: 'Left', WALL: 'LEFT', x: 'xLeft', width: 'jointEnd', topFlap: 'endTopFlap', topLayer: 'outerTopIsEnd ? 3 : 2', bottomLayer: 2, fallback: null },
      ],
      each: [
        { id: '{{wall}}', label: '{{WALL}}', kind: 'body', layer: 1, rect: ['{{x}}', 'top', '{{width}}', 'wallHeight'] },
        { id: 'top{{Wall}}', label: 'TOP {{WALL}}', kind: 'flap', layer: '{{topLayer}}', outline: [
          ['{{x}} + slot / 2', 'top'], ['{{x}} + {{width}} - slot / 2', 'top'],
          ['{{x}} + {{width}} - slot / 2', 'top - {{topFlap}}'], ['{{x}} + slot / 2', 'top - {{topFlap}}'],
        ] },
        // Designs made before the bottom was split print one "Bottom" artwork
        // across both outer bottom flaps.
        { id: 'bottom{{Wall}}', label: 'BOTTOM {{WALL}}', kind: 'flap', layer: '{{bottomLayer}}', artworkFallback: '{{fallback}}', outline: [
          ['{{x}} + slot / 2', 'bottom'], ['{{x}} + {{width}} - slot / 2', 'bottom'],
          ['{{x}} + {{width}} - slot / 2', 'bottom + end / 2'], ['{{x}} + slot / 2', 'bottom + end / 2'],
        ] },
      ],
    },
  ],
  validations: [
    { require: 'depth >= joint + 5', message: 'The depth is too small for the glued joint. Use a depth of at least {joint + 5} mm on this board.' },
    { require: 'width >= joint + 5', message: 'The width is too small for the slotted flaps. Use a width of at least {joint + 5} mm on this board.' },
    { require: 'height >= 2 * slot + 10', message: 'The height is too small for this board. Use a height of at least {2 * slot + 10} mm.' },
  ],
  notes: [
    { when: '!outerTopIsEnd', text: "Regular slotted container (FEFCO 0201): four flaps at each end, slotted, with a glued manufacturer's joint." },
    { when: 'outerTopIsEnd', text: 'Centre special slotted container (FEFCO 0204): every top flap meets in the middle; regular slotted bottom.' },
    { text: 'Width, depth and height are inside sizes; panels are scored one board ({t} mm) wider and the height two boards taller. Ask your box maker to confirm the allowances for the flute you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid, including the flaps.' },
  ],
  // Folded as a slotted box is packed: the joint turns in and the walls wrap
  // round onto it, the bottom's end flaps fold in and its long flaps close
  // over them, then the top closes the same way, its outer flaps last.
  // Outer flaps fold as far out as a score allows (setback -1.5 boards), inner
  // ones a board further in so the outer pair lies on them. Inner top flaps
  // close over the first half of the slider, outer ones over the second.
  fold: {
    root: 'front',
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.08))',
    offset: ['-(front.x + front.width / 2)', 'front.y + front.height / 2', 'depth / 2'],
    hinges: [
      { child: 'glue', parent: 'front', drive: 'formation', from: 0, to: 0.5, setback: 'foldT * 1.1' },
      { child: 'right', parent: 'front', drive: 'formation', from: 0, to: 0.6 },
      { child: 'back', parent: 'right', drive: 'formation', from: 0.1, to: 0.7 },
      { child: 'left', parent: 'back', drive: 'formation', from: 0.2, to: 0.8 },
      // Bottom: end flaps in, then the long flaps over them. Top: the inner
      // pair closes over the first half of the slider, the outer pair over
      // the second, whichever walls carry them.
      {
        repeat: [
          { wall: 'front', Wall: 'Front', bottomFrom: 0.9, bottomTo: 1, bottomSetback: '-1.5 * foldT', topFrom: 'outerTopIsEnd ? 0 : 0.5', topTo: 'outerTopIsEnd ? 0.5 : 1', topSetback: 'outerTopIsEnd ? -1.5 * foldT + foldT : -1.5 * foldT' },
          { wall: 'right', Wall: 'Right', bottomFrom: 0.8, bottomTo: 0.9, bottomSetback: '-1.5 * foldT + foldT', topFrom: 'outerTopIsEnd ? 0.5 : 0', topTo: 'outerTopIsEnd ? 1 : 0.5', topSetback: 'outerTopIsEnd ? -1.5 * foldT : -1.5 * foldT + foldT' },
          { wall: 'back', Wall: 'Back', bottomFrom: 0.9, bottomTo: 1, bottomSetback: '-1.5 * foldT', topFrom: 'outerTopIsEnd ? 0 : 0.5', topTo: 'outerTopIsEnd ? 0.5 : 1', topSetback: 'outerTopIsEnd ? -1.5 * foldT + foldT : -1.5 * foldT' },
          { wall: 'left', Wall: 'Left', bottomFrom: 0.8, bottomTo: 0.9, bottomSetback: '-1.5 * foldT + foldT', topFrom: 'outerTopIsEnd ? 0.5 : 0', topTo: 'outerTopIsEnd ? 1 : 0.5', topSetback: 'outerTopIsEnd ? -1.5 * foldT : -1.5 * foldT + foldT' },
        ],
        each: [
          { child: 'bottom{{Wall}}', parent: '{{wall}}', drive: 'formation', from: '{{bottomFrom}}', to: '{{bottomTo}}', setback: '{{bottomSetback}}' },
          { child: 'top{{Wall}}', parent: '{{wall}}', drive: 'closing', from: '{{topFrom}}', to: '{{topTo}}', setback: '{{topSetback}}' },
        ],
      },
    ],
  },
  assembly: {
    control: 'split-direction',
    defaultOpeningMode: 'top_split_meet_center',
    openingStage: 'always',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Slotted shipping box cutting template. Your box maker must approve the flute and score allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid, including the flaps.',
  },
  catalog: {
    thumbnail: '/images/templates/split-top-box.webp',
    version: 1,
    name: 'Split Top Box',
    shortName: 'Split top',
    family: 'corrugated',
    category: 'Corrugated',
    description: 'Corrugated shipping box: four slotted flaps at each end, meeting in the middle (FEFCO 0204) or the outer pair only (FEFCO 0201).',
    tags: ['box', 'split top', 'shipping', 'corrugated', 'rsc', 'slotted', '0201', '0204'],
    capabilities: ['dieline', '3d', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 1, step: 1, defaultValue: 400 },
      { key: 'height', label: 'Height', unit: 'mm', min: 1, step: 1, defaultValue: 300 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 1, step: 1, defaultValue: 300 },
      // Single-wall corrugated is 1.5-4 mm, double wall up to 7 mm.
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 7, step: 0.1, defaultValue: 3 },
    ],
    artworkRegions: [
      { id: 'outside-front', label: 'Front', surface: 'outside', panelId: 'Front' },
      { id: 'outside-back', label: 'Back', surface: 'outside', panelId: 'Back' },
      { id: 'outside-left', label: 'Left', surface: 'outside', panelId: 'Left' },
      { id: 'outside-right', label: 'Right', surface: 'outside', panelId: 'Right' },
      { id: 'outside-top-front', label: 'Top front', surface: 'outside', panelId: 'Top Front' },
      { id: 'outside-top-back', label: 'Top back', surface: 'outside', panelId: 'Top Back' },
      { id: 'outside-bottom-front', label: 'Bottom front', surface: 'outside', panelId: 'Bottom Front' },
      { id: 'outside-bottom-back', label: 'Bottom back', surface: 'outside', panelId: 'Bottom Back' },
      { id: 'outside-top-left', label: 'Top left', surface: 'outside', panelId: 'Top Left' },
      { id: 'outside-top-right', label: 'Top right', surface: 'outside', panelId: 'Top Right' },
      { id: 'inside-front', label: 'Inside Front', surface: 'inside', panelId: 'Interior Front' },
      { id: 'inside-back', label: 'Inside Back', surface: 'inside', panelId: 'Interior Back' },
      { id: 'inside-left', label: 'Inside Left', surface: 'inside', panelId: 'Interior Left' },
      { id: 'inside-right', label: 'Inside Right', surface: 'inside', panelId: 'Interior Right' },
      { id: 'inside-bottom-front', label: 'Inside bottom front', surface: 'inside', panelId: 'Interior Bottom Front' },
      { id: 'inside-bottom-back', label: 'Inside bottom back', surface: 'inside', panelId: 'Interior Bottom Back' },
      { id: 'inside-top-left', label: 'Inside top left', surface: 'inside', panelId: 'Interior Top Left' },
      { id: 'inside-top-right', label: 'Inside top right', surface: 'inside', panelId: 'Interior Top Right' },
      { id: 'inside-top-front', label: 'Inside top front', surface: 'inside', panelId: 'Interior Top Front' },
      { id: 'inside-top-back', label: 'Inside top back', surface: 'inside', panelId: 'Interior Top Back' },
    ],
    defaultDimensions: { width: 400, height: 300, depth: 300, thickness: 3 },
    fixedOpeningMode: 'top_split_meet_center',
  },
} satisfies ParametricTemplate;
