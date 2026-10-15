import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { telescopeBoxDefinition } from '@/lib/packaging/parametric/definitions/tray-box';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/tray-box.ts.
export const telescopeBoxRuntime: TemplateRuntime = compileParametricTemplate(telescopeBoxDefinition);
