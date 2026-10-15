import type { DielineOutput } from '../types';

// The dieline for cutting machines: Cricut Design Space and Silhouette Studio.
//
// Only cut and score lines, each in its own group and colour, so the
// machine software can tell them apart: cut lines black, score lines blue.
// There is no bleed, safe zone or label layer, which the machine would try
// to cut. The size is given in inches as well as by the mm viewBox: Design
// Space reads SVGs without units at 72 pixels per inch, which would import
// a dieline at the wrong size, but honours explicit inches.

const round = (value: number) => Number(value.toFixed(4));
const MM_PER_IN = 25.4;

/** How to use the file, shown beside the download. */
export const CRICUT_STEPS = [
  'Upload the SVG in Cricut Design Space (Upload > Upload Image) or open it in Silhouette Studio Designer Edition or above. Silhouette Studio Basic cannot open SVG: use the DXF file instead.',
  'Check the size before cutting: it should match the flat size shown here. If it does not, unlock the proportions and type the width in.',
  'In Design Space, ungroup the design, select the blue lines and set their operation to Score (or Draw with a scoring stylus), then attach everything so the scores stay in place.',
  'On a Cricut mat the largest cut is about 11.5 x 23.5 in (292 x 597 mm) on a 12 x 24 in mat. Larger boxes need splitting or a cutting table.',
];

export function dielineToCricutSvg(output: DielineOutput, title = 'Dieline'): string {
  const { width, height } = output.bounds;
  const group = (id: string, color: string, type: 'cut' | 'crease') => {
    const d = output.paths.filter(path => path.type === type).map(path => path.d).join('');
    return d ? `  <g id="${id}" fill="none" stroke="${color}" stroke-width="0.3">\n    <path d="${d}"/>\n  </g>` : '';
  };
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width / MM_PER_IN)}in" height="${round(height / MM_PER_IN)}in" viewBox="0 0 ${round(width)} ${round(height)}">`,
    `  <title>${title.replace(/[<>&]/g, '')}: cut black, score blue</title>`,
    group('Cut', '#000000', 'cut'),
    group('Score', '#1f6fd6', 'crease'),
    '</svg>',
    '',
  ].filter(Boolean).join('\n');
}
