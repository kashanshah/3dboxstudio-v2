import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { baseBoxDefinition } from '@/lib/packaging/parametric/definitions/base-box';

// Built from its parametric definition: the die, the 3D fold, the opening
// modes and the size checks all come from parametric/definitions/base-box.ts.
export const baseBoxRuntime: TemplateRuntime = compileParametricTemplate(baseBoxDefinition);
