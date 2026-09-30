import {
  reverseTuckBounds,
  reverseTuckFoldState,
  reverseTuckPanels,
  sanitizeCartonDimensions,
  type CartonDimensions,
} from '@/lib/packaging/reverse-tuck';
import { baseBoxBounds, baseBoxPanels, splitTopBoxBounds, splitTopBoxPanels, type DielinePanel } from '@/lib/packaging/box-structures';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';

export type TemplateGeometryOptions = {
  splitTopHingeSide?: 'side_a' | 'side_b';
};

export type TemplateRuntime = {
  templateId: string;
  structureKey: string;
  rendererKey: string;
  sanitizeParameters: (dimensions: CartonDimensions) => CartonDimensions;
  getDielinePanels: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => DielinePanel[];
  getDielineBounds: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => {width:number;height:number};
  getFoldState?: typeof reverseTuckFoldState;
};

const runtimeMap = new Map<string, TemplateRuntime>([
  ['base-box', {
    templateId: 'base-box',
    structureKey: 'base-box-v1',
    rendererKey: 'base-box-v1',
    sanitizeParameters: sanitizeCartonDimensions,
    getDielinePanels: dimensions => baseBoxPanels(dimensions),
    getDielineBounds: dimensions => baseBoxBounds(dimensions),
  }],
  ['split-top-box', {
    templateId: 'split-top-box',
    structureKey: 'split-top-box-v1',
    rendererKey: 'split-top-box-v1',
    sanitizeParameters: sanitizeCartonDimensions,
    getDielinePanels: (dimensions,options) => splitTopBoxPanels(dimensions,options?.splitTopHingeSide ?? 'side_a'),
    getDielineBounds: (dimensions,options) => splitTopBoxBounds(dimensions,options?.splitTopHingeSide ?? 'side_a'),
  }],
  ['reverse-tuck-carton', {
    templateId: 'reverse-tuck-carton',
    structureKey: 'reverse-tuck-v1',
    rendererKey: 'reverse-tuck-v1',
    sanitizeParameters: sanitizeCartonDimensions,
    getDielinePanels: dimensions => reverseTuckPanels(dimensions),
    getDielineBounds: dimensions => reverseTuckBounds(dimensions),
    getFoldState: reverseTuckFoldState,
  }],
]);

export function getTemplateRuntime(templateId: string) {
  const template = getPackagingTemplate(templateId);
  if (!template) return null;
  const runtime = runtimeMap.get(templateId) ?? null;
  if (!runtime) return null;
  if (runtime.structureKey !== template.structureKey || runtime.rendererKey !== template.rendererKey) {
    throw new Error(`Template runtime mismatch for ${templateId}`);
  }
  return runtime;
}

export function getTemplateGeometry(templateId:string,dimensions:CartonDimensions,options?:TemplateGeometryOptions){
  const runtime=getTemplateRuntime(templateId) ?? getTemplateRuntime('reverse-tuck-carton')!;
  return {
    panels:runtime.getDielinePanels(dimensions,options),
    bounds:runtime.getDielineBounds(dimensions,options),
  };
}

export function registerTemplateRuntime(runtime: TemplateRuntime) {
  if (runtimeMap.has(runtime.templateId)) throw new Error(`Template runtime already registered: ${runtime.templateId}`);
  runtimeMap.set(runtime.templateId, runtime);
}
