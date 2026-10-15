// The free dieline generator's engine: box styles, generation and file
// exports, with no UI. See types.ts for the model and styles.ts for the styles.
export * from './types';
export { DIELINE_STYLES, getDielineStyle, BLEED_MM, SAFE_MM } from './styles';

import { getDielineStyle } from './styles';
import type { DielineInput, DielineOutput } from './types';

/** Draws the dieline for `input`; throws a plain-language Error for an unknown style or impossible size. */
export function generateDieline(input: DielineInput): DielineOutput {
  const style = getDielineStyle(input.styleId);
  if (!style) throw new Error(`Unknown box style "${input.styleId}".`);
  return style.generate(input);
}
