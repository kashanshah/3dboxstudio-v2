import type { ParametricTemplate } from '../format';
import { panelRegions } from './artwork-regions';

// A sleeve: an open-ended folding-carton tube that slides over a tray or a
// product. One strip of glue flap, left, front, right and back, glued into a
// tube; both ends are cut flush and left open. Width and depth are the inside
// of the opening and height is the sleeve's length. As on the tuck end
// cartons, each wall is creased one board wider so the folded sleeve keeps
// that inside, and the back, which the glue flap is stuck to, takes half a
// board less.

export const sleeveBoxDefinition = {
  format: 'parametric-template/1',
  templateId: 'sleeve-box',
  structureKey: 'sleeve-v1',
  rendererKey: 'sleeve-v1',
  description: 'Open-ended folding-carton sleeve: four walls and a 15° glue flap, both ends cut flush.',
  parameters: {
    width: { fallback: 120, min: 1 },
    height: { fallback: 180, min: 1 },
    depth: { fallback: 55, min: 1 },
    thickness: { fallback: 0.5, min: 0.3, max: 2 },
  },
  derived: [
    ['t', 'thickness'],
    ['glue', 'clamp(0.3 * min(width, depth) + 4, 10, 15)'],
    ['wallFront', 'width + t'], ['wallBack', 'width + t / 2'], ['wallLeft', 'depth + t'], ['wallRight', 'depth + t'],
    // The glue flap stops short of the open ends and tapers 15° so it tucks
    // cleanly inside the back.
    ['glueCut', 't + 1'],
    ['glueTaper', 'glue * tan(15 * pi / 180)'],
    ['xLeft', 'glue'], ['xFront', 'xLeft + wallLeft'], ['xRight', 'xFront + wallFront'], ['xBack', 'xRight + wallRight'],
  ],
  panels: [
    { id: 'glue', label: 'GLUE', kind: 'glue', layer: 0, outline: [
      ['glue', 'glueCut'], ['glue', 'height - glueCut'],
      [0, 'height - glueCut - glueTaper'], [0, 'glueCut + glueTaper'],
    ] },
    {
      repeat: [
        { id: 'left', LABEL: 'LEFT', x: 'xLeft', width: 'wallLeft' },
        { id: 'front', LABEL: 'FRONT', x: 'xFront', width: 'wallFront' },
        { id: 'right', LABEL: 'RIGHT', x: 'xRight', width: 'wallRight' },
        { id: 'back', LABEL: 'BACK', x: 'xBack', width: 'wallBack' },
      ],
      each: [{ id: '{{id}}', label: '{{LABEL}}', kind: 'body', layer: 1, rect: ['{{x}}', 0, '{{width}}', 'height'] }],
    },
  ],
  validations: [
    { require: 'width >= 20', message: 'The width is too small for the glue flap. Use a width of at least 20 mm.' },
    { require: 'depth >= 10', message: 'The depth is too small for the glue flap. Use a depth of at least 10 mm.' },
    { require: 'height >= 10', message: 'The sleeve is too short to glue. Use a height of at least 10 mm.' },
  ],
  notes: [
    { text: 'Sleeve: an open-ended tube with a 15° glue flap; both ends are cut flush.' },
    { text: 'Width and depth are the inside of the opening and height is the sleeve length; panels are creased one board ({t} mm) wider. Ask your printer to confirm the allowances for the board you choose.' },
    { text: 'Artwork prints exactly as laid out on the design grid.' },
  ],
  // Folded like a tuck end carton's body: the side walls up from the front,
  // the back over from the right, and the glue flap in behind the back.
  fold: {
    root: 'front',
    thickness: 'max(0.05, min(thickness, min(width, depth) * 0.08))',
    offset: ['-(front.x + front.width / 2)', 'front.y + front.height / 2', 'depth / 2'],
    motions: [
      ['turnWalls', 'stage(formation, 0, 0.6) * (pi / 2)'],
      ['turnBack', 'stage(formation, 0.15, 0.75) * (pi / 2)'],
    ],
    hinges: [
      { child: 'left', parent: 'front', angle: 'turnWalls' },
      { child: 'right', parent: 'front', angle: 'turnWalls' },
      { child: 'back', parent: 'right', angle: 'turnBack' },
      { child: 'glue', parent: 'left', angle: 'turnBack', setback: 'foldT * 1.1' },
    ],
  },
  assembly: {
    control: 'none',
    defaultOpeningMode: 'closed',
    openingStage: 'never',
  },
  export: {
    kind: 'cutting-template',
    summary: 'Sleeve cutting template with a glue flap. Your printer must approve the stock and crease allowances.',
    artworkNote: 'Artwork prints exactly as laid out on the design grid.',
  },
  catalog: {
    thumbnail: '/images/templates/sleeve-box.webp',
    version: 1,
    name: 'Sleeve Box',
    shortName: 'Sleeve',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Open-ended sleeve for trays and product wraps.',
    tags: ['sleeve', 'carton', 'wrap', 'tray sleeve', 'belly band'],
    capabilities: ['dieline', '3d', 'interior-artwork', 'full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 1, step: 1, defaultValue: 180 },
      { key: 'height', label: 'Length', unit: 'mm', min: 1, step: 1, defaultValue: 120 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 1, step: 1, defaultValue: 60 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: panelRegions(['Front', 'Back', 'Left', 'Right']),
    defaultDimensions: { width: 180, height: 120, depth: 60, thickness: 0.5 },
  },
} satisfies ParametricTemplate;
