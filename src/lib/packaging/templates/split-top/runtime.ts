import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { compileParametricTemplate } from '@/lib/packaging/parametric/compile';
import { splitTopDefinition } from '@/lib/packaging/parametric/definitions/split-top';

// The first template built from a parametric definition; see
// docs/parametric-templates.md. buildMeshes: compiled from the definition.
export const splitTopRuntime: TemplateRuntime = compileParametricTemplate(splitTopDefinition);
