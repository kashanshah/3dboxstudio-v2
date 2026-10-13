import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { autoLockBottomDefinition } from '@/lib/packaging/parametric/definitions/auto-lock-bottom';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/auto-lock-bottom.ts.
export const autoLockBottomRuntime: TemplateRuntime = compileParametricTemplate(autoLockBottomDefinition);
