import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { pillowBoxDefinition } from '@/lib/packaging/parametric/definitions/pillow-box';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/pillow-box.ts.
export const pillowBoxRuntime: TemplateRuntime = compileParametricTemplate(pillowBoxDefinition);
