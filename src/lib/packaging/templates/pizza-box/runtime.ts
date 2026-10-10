import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { pizzaBoxDefinition } from '@/lib/packaging/parametric/definitions/pizza-box';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/pizza-box.ts.
export const pizzaBoxRuntime: TemplateRuntime = compileParametricTemplate(pizzaBoxDefinition);
