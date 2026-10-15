import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { gableBoxDefinition } from '@/lib/packaging/parametric/definitions/gable-box';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/gable-box.ts.
export const gableBoxRuntime: TemplateRuntime = compileParametricTemplate(gableBoxDefinition);
