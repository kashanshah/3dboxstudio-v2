import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { reverseTuckDefinition } from '@/lib/packaging/parametric/definitions/reverse-tuck';
import { reverseTuckFoldState } from './geometry';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/reverse-tuck.ts.
export const reverseTuckRuntime: TemplateRuntime = {
  ...compileParametricTemplate(reverseTuckDefinition),
  getFoldState: reverseTuckFoldState,
};
