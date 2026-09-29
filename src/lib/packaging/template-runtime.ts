import {
  reverseTuckBounds,
  reverseTuckFoldState,
  reverseTuckPanels,
  sanitizeCartonDimensions,
  type CartonDimensions,
} from '@/lib/packaging/reverse-tuck';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';

export type TemplateRuntime = {
  templateId: string;
  structureKey: string;
  rendererKey: string;

  sanitizeParameters: (dimensions: CartonDimensions) => CartonDimensions;
  getDielinePanels: typeof reverseTuckPanels;
  getDielineBounds: typeof reverseTuckBounds;
  getFoldState: typeof reverseTuckFoldState;
};

const runtimeMap = new Map<string, TemplateRuntime>([
  ['reverse-tuck-carton', {
    templateId: 'reverse-tuck-carton',
    structureKey: 'reverse-tuck-v1',
    rendererKey: 'reverse-tuck-v1',
    sanitizeParameters: sanitizeCartonDimensions,
    getDielinePanels: reverseTuckPanels,
    getDielineBounds: reverseTuckBounds,
    getFoldState: reverseTuckFoldState,
  }],
]);

export function getTemplateRuntime(templateId: string) {
  const template = getPackagingTemplate(templateId);
  if (!template) return null;

  const runtime = runtimeMap.get(templateId) ?? null;
  if (!runtime) return null;

  if (
    runtime.structureKey !== template.structureKey
    || runtime.rendererKey !== template.rendererKey
  ) {
    throw new Error(`Template runtime mismatch for ${templateId}`);
  }

  return runtime;
}

export function registerTemplateRuntime(runtime: TemplateRuntime) {
  if (runtimeMap.has(runtime.templateId)) {
    throw new Error(`Template runtime already registered: ${runtime.templateId}`);
  }
  runtimeMap.set(runtime.templateId, runtime);
}
