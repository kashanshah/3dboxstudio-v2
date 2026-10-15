import type { DielineOutput, LineType } from '../types';

// The dieline as SVG files at real size (1 user unit = 1 mm), opened by
// Illustrator, CorelDRAW, Inkscape and Affinity. Each kind of line is its own
// named group, which those programs read as a layer.

export type LineStyle = { color: string; width: number; dash?: string };
export const LINE_STYLES: Record<LineType, LineStyle> = {
  cut: { color: '#e01e1e', width: 0.25 },
  crease: { color: '#1f6fd6', width: 0.25, dash: '3 1.5' },
  perforation: { color: '#14a37f', width: 0.25, dash: '1 1' },
  glue: { color: '#e8a317', width: 0.2, dash: '1.5 1' },
  bleed: { color: '#2ba84a', width: 0.2, dash: '4 2' },
  safe: { color: '#9b5bd8', width: 0.2, dash: '2 2' },
};
export const LINE_NAMES: Record<LineType, string> = {
  cut: 'Cut', crease: 'Crease (fold)', perforation: 'Perforation', glue: 'Glue area', bleed: 'Bleed (3 mm)', safe: 'Safe zone (3 mm)',
};

const round = (value: number) => Number(value.toFixed(3));
const escapeXml = (text: string) => text.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);

export type SvgOptions = {
  title?: string;
  /** Line kinds to include, in drawing order. Defaults to every kind the dieline has. */
  layers?: LineType[];
  colors?: Partial<Record<LineType, string>>;
  /** Panel names on a hidden layer (shown when `showLabels`). */
  labels?: boolean;
  showLabels?: boolean;
  /** The sheet's overall width and height drawn outside it. */
  annotations?: boolean;
};

const ORDER: LineType[] = ['bleed', 'safe', 'glue', 'perforation', 'crease', 'cut'];

/** A layered SVG of the dieline, sized in millimetres. */
export function dielineToSvg(output: DielineOutput, options: SvgOptions = {}): string {
  const layers = (options.layers ?? ORDER).filter(type => output.paths.some(path => path.type === type && path.d));
  // Room round the sheet for the bleed and, with annotations, the size labels.
  const margin = Math.max(layers.includes('bleed') ? 4 : 0, options.annotations ? 14 : 0);
  const width = output.bounds.width + 2 * margin, height = output.bounds.height + 2 * margin;
  const groups = layers.map(type => {
    const style = LINE_STYLES[type], color = options.colors?.[type] ?? style.color;
    const d = output.paths.filter(path => path.type === type).map(path => path.d).join('');
    return `  <g id="${type}" inkscape:groupmode="layer" inkscape:label="${LINE_NAMES[type]}" fill="none" stroke="${color}" stroke-width="${style.width}"${style.dash ? ` stroke-dasharray="${style.dash}"` : ''} stroke-linecap="round" stroke-linejoin="round">\n    <path d="${d}"/>\n  </g>`;
  });
  const labels = options.labels ?? true
    ? [`  <g id="labels" inkscape:groupmode="layer" inkscape:label="Panel names" font-family="Arial, Helvetica, sans-serif" font-size="4" fill="#5b6675" text-anchor="middle"${options.showLabels ? '' : ' style="display:none"'}>`,
      ...output.panels.map(panel => {
        const xs = panel.polygon.map(point => point[0]), ys = panel.polygon.map(point => point[1]);
        return `    <text x="${round((Math.min(...xs) + Math.max(...xs)) / 2)}" y="${round((Math.min(...ys) + Math.max(...ys)) / 2)}">${escapeXml(panel.label)}</text>`;
      }), '  </g>']
    : [];
  const annotations = options.annotations ? [annotation(output.bounds.width, output.bounds.height)] : [];
  const title = escapeXml(options.title ?? 'Dieline');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${round(width)}mm" height="${round(height)}mm" viewBox="${round(-margin)} ${round(-margin)} ${round(width)} ${round(height)}">`,
    `  <title>${title}</title>`,
    `  <desc>${escapeXml(`${title}. Flat size ${round(output.bounds.width)} x ${round(output.bounds.height)} mm. Print at 100% (actual size). Made with 3D Box Studio (3dboxstudio.com).`)}</desc>`,
    ...groups,
    ...labels,
    ...annotations,
    '</svg>',
    '',
  ].join('\n');
}

/** Width and height dimension lines just outside the sheet, in millimetres. */
function annotation(width: number, height: number) {
  const tick = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}"/>`;
  const y = -9, x = -9;
  return [
    '  <g id="dimensions" inkscape:groupmode="layer" inkscape:label="Dimensions" stroke="#5b6675" stroke-width="0.2" fill="#5b6675" font-family="Arial, Helvetica, sans-serif" font-size="3.5" text-anchor="middle">',
    `    ${tick(0, y, width, y)}${tick(0, y - 2, 0, y + 2)}${tick(width, y - 2, width, y + 2)}`,
    `    <text x="${round(width / 2)}" y="${y - 1.5}" stroke="none">${round(width)} mm</text>`,
    `    ${tick(x, 0, x, height)}${tick(x - 2, 0, x + 2, 0)}${tick(x - 2, height, x + 2, height)}`,
    `    <text x="${x - 1.5}" y="${round(height / 2)}" stroke="none" transform="rotate(-90 ${x - 1.5} ${round(height / 2)})">${round(height)} mm</text>`,
    '  </g>',
  ].join('\n');
}
