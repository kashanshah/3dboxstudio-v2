import type { ParametricTemplate } from '../format';

// The split top box: a regular slotted container (FEFCO 0201) or, with every
// top flap meeting in the middle, a centre special slotted container (FEFCO
// 0204). The studio builds it from this definition. It replaced a
// hand-written template, kept frozen in scripts/reference, and
// scripts/parametric-templates.test.cjs checks the two still produce the same
// cutting template and 3D model.

const flap = (end: 'top' | 'bottom', x: string, width: string, length: string) => {
  const hinge = end === 'top' ? 'top' : 'bottom';
  const tip = end === 'top' ? `top - ${length}` : `bottom + ${length}`;
  return [[`${x} + slot / 2`, hinge], [`${x} + ${width} - slot / 2`, hinge], [`${x} + ${width} - slot / 2`, tip], [`${x} + slot / 2`, tip]] as [string, string][];
};

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
    { id: 'front', label: 'FRONT', kind: 'body', layer: 1, rect: ['xFront', 'top', 'long', 'wallHeight'] },
    { id: 'topFront', label: 'TOP FRONT', kind: 'flap', layer: 'outerTopIsEnd ? 2 : 3', outline: flap('top', 'xFront', 'long', 'end / 2') },
    { id: 'bottomFront', label: 'BOTTOM FRONT', kind: 'flap', layer: 3, outline: flap('bottom', 'xFront', 'long', 'end / 2'),
      artworkFallback: { name: 'Bottom', uv: [0, 0.5, 1, 0.5] } },
    { id: 'right', label: 'RIGHT', kind: 'body', layer: 1, rect: ['xRight', 'top', 'end', 'wallHeight'] },
    { id: 'topRight', label: 'TOP RIGHT', kind: 'flap', layer: 'outerTopIsEnd ? 3 : 2', outline: flap('top', 'xRight', 'end', 'endTopFlap') },
    { id: 'bottomRight', label: 'BOTTOM RIGHT', kind: 'flap', layer: 2, outline: flap('bottom', 'xRight', 'end', 'end / 2') },
    { id: 'back', label: 'BACK', kind: 'body', layer: 1, rect: ['xBack', 'top', 'long', 'wallHeight'] },
    { id: 'topBack', label: 'TOP BACK', kind: 'flap', layer: 'outerTopIsEnd ? 2 : 3', outline: flap('top', 'xBack', 'long', 'end / 2') },
    { id: 'bottomBack', label: 'BOTTOM BACK', kind: 'flap', layer: 3, outline: flap('bottom', 'xBack', 'long', 'end / 2'),
      artworkFallback: { name: 'Bottom', uv: [0, 0, 1, 0.5] } },
    { id: 'left', label: 'LEFT', kind: 'body', layer: 1, rect: ['xLeft', 'top', 'jointEnd', 'wallHeight'] },
    { id: 'topLeft', label: 'TOP LEFT', kind: 'flap', layer: 'outerTopIsEnd ? 3 : 2', outline: flap('top', 'xLeft', 'jointEnd', 'endTopFlap') },
    { id: 'bottomLeft', label: 'BOTTOM LEFT', kind: 'flap', layer: 2, outline: flap('bottom', 'xLeft', 'jointEnd', 'end / 2') },
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
      { child: 'bottomFront', parent: 'front', drive: 'formation', from: 0.9, to: 1, setback: '-1.5 * foldT' },
      { child: 'topFront', parent: 'front', drive: 'closing', from: 'outerTopIsEnd ? 0 : 0.5', to: 'outerTopIsEnd ? 0.5 : 1', setback: 'outerTopIsEnd ? -1.5 * foldT + foldT : -1.5 * foldT' },
      { child: 'bottomRight', parent: 'right', drive: 'formation', from: 0.8, to: 0.9, setback: '-1.5 * foldT + foldT' },
      { child: 'topRight', parent: 'right', drive: 'closing', from: 'outerTopIsEnd ? 0.5 : 0', to: 'outerTopIsEnd ? 1 : 0.5', setback: 'outerTopIsEnd ? -1.5 * foldT : -1.5 * foldT + foldT' },
      { child: 'bottomBack', parent: 'back', drive: 'formation', from: 0.9, to: 1, setback: '-1.5 * foldT' },
      { child: 'topBack', parent: 'back', drive: 'closing', from: 'outerTopIsEnd ? 0 : 0.5', to: 'outerTopIsEnd ? 0.5 : 1', setback: 'outerTopIsEnd ? -1.5 * foldT + foldT : -1.5 * foldT' },
      { child: 'bottomLeft', parent: 'left', drive: 'formation', from: 0.8, to: 0.9, setback: '-1.5 * foldT + foldT' },
      { child: 'topLeft', parent: 'left', drive: 'closing', from: 'outerTopIsEnd ? 0.5 : 0', to: 'outerTopIsEnd ? 1 : 0.5', setback: 'outerTopIsEnd ? -1.5 * foldT : -1.5 * foldT + foldT' },
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
} satisfies ParametricTemplate;
