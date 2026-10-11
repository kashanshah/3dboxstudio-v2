import type { DielineExportGeometry, LineMm } from './export-geometry';

// The cutting template as plain vector files for printers and die makers:
// SVG (opens in Illustrator, Inkscape, Affinity) and DXF (CAD and cutting
// tables). Both are drawn at 1:1 in millimetres with the cut and crease
// lines on separate layers, the way a die maker expects them.

const round = (value: number) => Number(value.toFixed(3));
const escapeXml = (text: string) => text.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);

/** Cut lines red and solid, creases blue and dashed: the usual die-line convention. */
export const DIELINE_LAYERS = {
  cut: { name: 'CUT', svgColor: '#ff0000', dxfColor: 1 },
  crease: { name: 'CREASE', svgColor: '#0000ff', dxfColor: 5 },
} as const;

/**
 * An SVG of the cutting template at actual size (1 user unit = 1 mm). Each
 * kind of line is a named layer (Illustrator reads the group ids, Inkscape
 * the layer labels); panel names are on a hidden layer of their own.
 */
export function dielineSvg(geometry: DielineExportGeometry, title: string) {
  const { width, height } = geometry.bounds;
  const lines = (kind: 'cut' | 'crease', list: LineMm[]) => {
    const layer = DIELINE_LAYERS[kind];
    const dash = kind === 'crease' ? ' stroke-dasharray="3 1.5"' : '';
    const body = list.map(line => `    <line x1="${round(line.start.x)}" y1="${round(line.start.y)}" x2="${round(line.end.x)}" y2="${round(line.end.y)}"/>`).join('\n');
    return `  <g id="${layer.name}" inkscape:groupmode="layer" inkscape:label="${layer.name}" fill="none" stroke="${layer.svgColor}" stroke-width="0.25"${dash} stroke-linecap="round">\n${body}\n  </g>`;
  };
  const labels = geometry.panels.map(panel => `    <text x="${round(panel.x + panel.width / 2)}" y="${round(panel.y + panel.height / 2)}">${escapeXml(panel.label)}</text>`).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${round(width)}mm" height="${round(height)}mm" viewBox="0 0 ${round(width)} ${round(height)}">`,
    `  <title>${escapeXml(title)}</title>`,
    `  <desc>${escapeXml(['Cutting template at 1:1 in millimetres. Red: cut. Blue dashed: crease.', ...geometry.notes].join(' '))}</desc>`,
    lines('cut', geometry.cut),
    lines('crease', geometry.crease),
    `  <g id="LABELS" inkscape:groupmode="layer" inkscape:label="LABELS" style="display:none" font-family="Helvetica, Arial, sans-serif" font-size="4" fill="#666666" text-anchor="middle" dominant-baseline="middle">\n${labels}\n  </g>`,
    '</svg>',
    '',
  ].join('\n');
}

/**
 * A DXF (R12, the version every CAD program and cutting table reads) of the
 * cutting template in millimetres: one LINE per edge on a CUT or CREASE
 * layer. DXF's y axis points up, so the sheet is turned the right way up.
 */
export function dielineDxf(geometry: DielineExportGeometry) {
  const { width, height } = geometry.bounds;
  const out: (string | number)[] = [];
  const pair = (code: number, value: string | number) => out.push(code, typeof value === 'number' ? round(value) : value);
  const section = (name: string, body: () => void) => { pair(0, 'SECTION'); pair(2, name); body(); pair(0, 'ENDSEC'); };

  section('HEADER', () => {
    pair(9, '$ACADVER'); pair(1, 'AC1009');
    // Millimetres, metric.
    pair(9, '$INSUNITS'); pair(70, 4);
    pair(9, '$MEASUREMENT'); pair(70, 1);
    pair(9, '$EXTMIN'); pair(10, 0); pair(20, 0); pair(30, 0);
    pair(9, '$EXTMAX'); pair(10, width); pair(20, height); pair(30, 0);
  });
  section('TABLES', () => {
    pair(0, 'TABLE'); pair(2, 'LTYPE'); pair(70, 2);
    pair(0, 'LTYPE'); pair(2, 'CONTINUOUS'); pair(70, 0); pair(3, 'Solid line'); pair(72, 65); pair(73, 0); pair(40, 0);
    pair(0, 'LTYPE'); pair(2, 'DASHED'); pair(70, 0); pair(3, '__ __ __'); pair(72, 65); pair(73, 2); pair(40, 4.5); pair(49, 3); pair(49, -1.5);
    pair(0, 'ENDTAB');
    pair(0, 'TABLE'); pair(2, 'LAYER'); pair(70, 2);
    for (const [kind, layer] of Object.entries(DIELINE_LAYERS)) {
      pair(0, 'LAYER'); pair(2, layer.name); pair(70, 0); pair(62, layer.dxfColor); pair(6, kind === 'crease' ? 'DASHED' : 'CONTINUOUS');
    }
    pair(0, 'ENDTAB');
  });
  section('ENTITIES', () => {
    for (const kind of ['cut', 'crease'] as const) {
      for (const line of geometry[kind]) {
        pair(0, 'LINE'); pair(8, DIELINE_LAYERS[kind].name);
        pair(10, line.start.x); pair(20, height - line.start.y); pair(30, 0);
        pair(11, line.end.x); pair(21, height - line.end.y); pair(31, 0);
      }
    }
  });
  pair(0, 'EOF');
  return out.join('\n') + '\n';
}
