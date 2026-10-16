import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { drawerBoxDefinition } from '@/lib/packaging/parametric/definitions/drawer-box';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/drawer-box.ts.
export const drawerBoxRuntime: TemplateRuntime = compileParametricTemplate(drawerBoxDefinition);
