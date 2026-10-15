import type { DielineOutput } from '../types';
import { segmentsOf } from './paths';

// The dieline as DXF (R12, ASCII) for CAD programs, sample makers and
// cutting tables: millimetres, cut lines on CUT, creases on CREASE and
// perforations on PERF, each a layer of its own colour. The y axis is
// flipped, as CAD's points up where the sheet's points down.

const LAYERS = [
  { type: 'cut', name: 'CUT', color: 1 },
  { type: 'crease', name: 'CREASE', color: 5 },
  { type: 'perforation', name: 'PERF', color: 3 },
] as const;

const round = (value: number) => Number(value.toFixed(4));

export function dielineToDxf(output: DielineOutput): string {
  const height = output.bounds.height;
  const lines: string[] = [];
  const add = (...pairs: (string | number)[]) => { for (const value of pairs) lines.push(String(value)); };
  add(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 4,
    9, '$EXTMIN', 10, 0, 20, 0, 9, '$EXTMAX', 10, round(output.bounds.width), 20, round(height), 0, 'ENDSEC');
  add(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, LAYERS.length);
  for (const layer of LAYERS) add(0, 'LAYER', 2, layer.name, 70, 0, 62, layer.color, 6, layer.type === 'cut' ? 'CONTINUOUS' : 'DASHED');
  add(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  for (const layer of LAYERS) {
    for (const [a, b] of segmentsOf(output, layer.type)) {
      add(0, 'LINE', 8, layer.name, 10, round(a[0]), 20, round(height - a[1]), 30, 0, 11, round(b[0]), 21, round(height - b[1]), 31, 0);
    }
  }
  add(0, 'ENDSEC', 0, 'EOF');
  return lines.join('\n') + '\n';
}
