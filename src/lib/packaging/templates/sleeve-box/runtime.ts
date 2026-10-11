import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { sleeveBoxDefinition } from '@/lib/packaging/parametric/definitions/sleeve-box';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/sleeve-box.ts.
export const sleeveBoxRuntime: TemplateRuntime = compileParametricTemplate(sleeveBoxDefinition);
