import { reverseTuckFoldState, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { DielinePanel } from '@/lib/packaging/box-structures';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import type { TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { BUILT_IN_TEMPLATE_RUNTIMES } from '@/lib/packaging/templates';

export type TemplateGeometryOptions = {
  openingMode?: LegacyOpeningMode;
  splitTopHingeSide?: 'side_a' | 'side_b';
};

export type TemplateAssemblyControl = 'none' | 'opening-mechanism' | 'split-direction';

export type TemplateAssemblyRuntime = {
  control: TemplateAssemblyControl;
  defaultOpeningMode: LegacyOpeningMode;
  legacyOpeningAsFormation?: boolean;
  hasOpeningStage: (openingMode: LegacyOpeningMode) => boolean;
};

export type TemplateRuntime = {
  templateId: string;
  structureKey: string;
  rendererKey: string;
  sanitizeParameters: (dimensions: CartonDimensions) => CartonDimensions;
  getDielinePanels: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => DielinePanel[];
  getDielineBounds: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => {width:number;height:number};
  buildMeshes: TemplateMeshBuilder;
  assembly: TemplateAssemblyRuntime;
  getFoldState?: typeof reverseTuckFoldState;
};

const runtimeMap=new Map<string,TemplateRuntime>(
  BUILT_IN_TEMPLATE_RUNTIMES.map(runtime=>[runtime.templateId,runtime]),
);

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

export function requireTemplateRuntime(templateId:string){
  const runtime=getTemplateRuntime(templateId);
  if(!runtime)throw new Error(`No runtime is registered for template: ${templateId}`);
  return runtime;
}

export function getTemplateGeometry(templateId:string,dimensions:CartonDimensions,options?:TemplateGeometryOptions){
  const runtime=requireTemplateRuntime(templateId);
  const sanitized=runtime.sanitizeParameters(dimensions);
  return {
    panels:runtime.getDielinePanels(sanitized,options),
    bounds:runtime.getDielineBounds(sanitized,options),
  };
}

export function getTemplateAssemblyState(
  templateId:string,
  input:{formation:number;opening:number;openingMode:LegacyOpeningMode},
){
  const assembly=requireTemplateRuntime(templateId).assembly;
  const hasOpeningStage=assembly.hasOpeningStage(input.openingMode);
  const progress=!hasOpeningStage
    ? input.formation
    : input.formation < 99.999
      ? input.formation * 0.7
      : 70 + (100-input.opening) * 0.3;
  const stage=progress<=1
    ? 'Flat dieline'
    : hasOpeningStage && progress>=69 && progress<=71
      ? 'Assembled · open'
      : progress<70
        ? 'Forming box'
        : progress<99
          ? 'Closing package'
          : 'Closed package';
  return {progress,stage,hasOpeningStage,control:assembly.control};
}

export function templateAssemblyValuesForProgress(
  templateId:string,
  value:number,
  openingMode:LegacyOpeningMode,
){
  const next=Math.max(0,Math.min(100,value));
  const assembly=requireTemplateRuntime(templateId).assembly;
  const hasOpeningStage=assembly.hasOpeningStage(openingMode);
  if(!hasOpeningStage)return {formation:next,opening:0};
  if(next<=70)return {formation:next/70*100,opening:100};
  return {formation:100,opening:(100-next)/30*100};
}

export function registerTemplateRuntime(runtime: TemplateRuntime) {
  if (runtimeMap.has(runtime.templateId)) throw new Error(`Template runtime already registered: ${runtime.templateId}`);
  runtimeMap.set(runtime.templateId, runtime);
}
