import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { hexagonBoxDefinition } from '@/lib/packaging/parametric/definitions/hexagon-box';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/hexagon-box.ts.
export const hexagonBoxRuntime: TemplateRuntime = compileParametricTemplate(hexagonBoxDefinition);
