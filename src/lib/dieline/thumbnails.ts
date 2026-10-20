import { DIELINE_STYLES, getDielineStyle } from './styles';
import { parsePath } from './export/paths';
import { defaultState, type GeneratorState } from './state';
import type { DielineOutput, DielineStyle, DimensionMode, Units } from './types';

// What the dieline generator needs from the server: the style picker's
// cards and the first box, already drawn. The browser loads the engine only
// once the visitor starts changing things, so the page stays light.

/** A style's card in the generator's picker: its cut outline at the default size. */
export type StyleThumb = { id: string; name: string; code?: string; templateId: string; modes: DimensionMode[]; measure?: DielineStyle['measure']; options?: DielineStyle['options']; viewBox: string; d: string };

export type GeneratorSetup = { styles: StyleThumb[]; initial: GeneratorState; output: DielineOutput };

/** Cut lines rounded to whole millimetres, small enough to send with the page. */
export function styleThumbnails(): StyleThumb[] {
  return DIELINE_STYLES.map(style => {
    const d = style.defaults;
    const output = style.generate({ styleId: style.id, ...d, units: 'mm', dimensionMode: style.modes[0] });
    const runs = output.paths.filter(path => path.type === 'cut').flatMap(path => parsePath(path.d));
    const path = runs.map(run => run.map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x)} ${Math.round(y)}`).join('')).join('');
    const pad = Math.max(output.bounds.width, output.bounds.height) * 0.04;
    return {
      id: style.id, name: style.name, ...(style.code ? { code: style.code } : {}), templateId: style.templateId, modes: style.modes, ...(style.measure ? { measure: style.measure } : {}), ...(style.options ? { options: style.options } : {}),
      viewBox: [-pad, -pad, output.bounds.width + 2 * pad, output.bounds.height + 2 * pad].map(value => Math.round(value)).join(' '),
      d: path,
    };
  });
}

/** The picker and the first box for a page: a style at its defaults, or at the page's first suggested size. */
export function generatorSetup(styleId: string, preset?: { length: number; width: number; depth: number; units: Units }): GeneratorSetup {
  const style = getDielineStyle(styleId) ?? DIELINE_STYLES[0];
  const initial = preset
    ? { ...defaultState(style, preset.units), length: preset.length, width: preset.width, depth: preset.depth }
    : defaultState(style);
  const output = style.generate({
    styleId: style.id, length: initial.length, width: initial.width, depth: initial.depth, units: initial.units,
    dimensionMode: initial.mode, thickness: initial.units === 'in' ? initial.thickness / 25.4 : initial.thickness, options: {},
  });
  return { styles: styleThumbnails(), initial, output };
}
