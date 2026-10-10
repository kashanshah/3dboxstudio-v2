import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { mailerBoxDefinition } from '@/lib/packaging/parametric/definitions/mailer-box';

// Built from its parametric definition: the die, the 3D fold and the size
// checks all come from parametric/definitions/mailer-box.ts.
export const mailerBoxRuntime: TemplateRuntime = compileParametricTemplate(mailerBoxDefinition);
