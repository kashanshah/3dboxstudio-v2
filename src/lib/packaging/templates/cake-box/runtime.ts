import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { cakeBoxDefinition } from '@/lib/packaging/parametric/definitions/cake-box';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/cake-box.ts.
export const cakeBoxRuntime: TemplateRuntime = compileParametricTemplate(cakeBoxDefinition);
