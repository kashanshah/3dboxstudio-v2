import type { Point } from '../geometry';
import type { DielineOutput, LineType } from '../types';

/**
 * The polylines in path data written by `pathData` (M, L and Z commands
 * only), closed runs ending on their first point.
 */
export function parsePath(d: string): Point[][] {
  const runs: Point[][] = [];
  const tokens = d.match(/[MLZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let run: Point[] = [];
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++].toUpperCase();
    if (command === 'M') {
      if (run.length > 1) runs.push(run);
      run = [[Number(tokens[i++]), Number(tokens[i++])]];
    } else if (command === 'L') {
      run.push([Number(tokens[i++]), Number(tokens[i++])]);
    } else if (command === 'Z') {
      if (run.length) run.push(run[0]);
      runs.push(run);
      run = [];
    } else {
      // A bare coordinate pair continues the previous command (an implicit L).
      run.push([Number(command), Number(tokens[i++])]);
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/** Every straight segment of one kind of line. */
export function segmentsOf(output: DielineOutput, type: LineType): [Point, Point][] {
  return output.paths.filter(path => path.type === type).flatMap(path => parsePath(path.d))
    .flatMap(run => run.slice(1).map((point, i): [Point, Point] => [run[i], point]));
}
