import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { snapLockBottomDefinition } from '@/lib/packaging/parametric/definitions/snap-lock-bottom';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/snap-lock-bottom.ts.
export const snapLockBottomRuntime: TemplateRuntime = compileParametricTemplate(snapLockBottomDefinition);
