import { reverseTuckFoldState, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { DielinePanel } from '@/lib/packaging/box-structures';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import type { TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { BUILT_IN_TEMPLATE_RUNTIMES } from '@/lib/packaging/templates';
import { layoutProofGeometry, type DielineExportGeometry } from './export-geometry';
import type { AdjustableSize, PanelSizes } from './parametric/sheet';
import type { FoldStep } from './parametric/compile';

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
  /** Whether the inside of the closed box is in view (an open tray, a window), so it isn't shaded as shut. */
  showsInside?: (dimensions: CartonDimensions) => boolean;
};

export type TemplateRuntime = {
  templateId: string;
  structureKey: string;
  rendererKey: string;
  sanitizeParameters: (dimensions: CartonDimensions) => CartonDimensions;
  /** Flap and panel sizes the user may change, for templates that offer them. */
  getAdjustableSizes?: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => AdjustableSize[];
  /** The panel ids one adjustable size changes the shape of. */
  getAdjustedPanels?: (dimensions: CartonDimensions, key: string, options?: TemplateGeometryOptions) => string[];
  /** For each panel of the flat sheet, the box or flap size its width and height show. */
  getPanelSizes?: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => PanelSizes[];
  getDielinePanels: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => DielinePanel[];
  getDielineBounds: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => {width:number;height:number};
  buildMeshes: TemplateMeshBuilder;
  assembly: TemplateAssemblyRuntime;
  getFoldState?: typeof reverseTuckFoldState;
  getExportGeometry?: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => DielineExportGeometry;
  /** How the sheet folds into the closed box: each panel, the panel it hinges on and its angle. */
  getFoldPlan?: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => FoldStep[];
  /** The cutting template without the size checks, so a box that fails one can still be drawn. */
  getSheetGeometry?: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => DielineExportGeometry;
  /** The size checks the box fails, as messages. */
  getSizeProblems?: (dimensions: CartonDimensions, options?: TemplateGeometryOptions) => string[];
  exportSummary?: string;
  exportArtworkNote?: string;
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

/**
 * The first size check a box fails, in the template's own words ("Use a width
 * and depth of at least 60 mm."), or null when the size can be made. The
 * printable exports refuse such a size, so the Studio says so up front.
 */
export function templateSizeProblem(templateId: string, dimensions: CartonDimensions, options?: TemplateGeometryOptions): string | null {
  const runtime = getTemplateRuntime(templateId);
  if (!runtime?.getSizeProblems) return null;
  try {
    return runtime.getSizeProblems(runtime.sanitizeParameters(dimensions), options)[0] ?? null;
  } catch {
    return null;
  }
}

export function getTemplateExportGeometry(templateId: string, dimensions: CartonDimensions, options?: TemplateGeometryOptions) {
  const runtime = requireTemplateRuntime(templateId);
  const sanitized = runtime.sanitizeParameters(dimensions);
  return runtime.getExportGeometry?.(sanitized, options)
    ?? layoutProofGeometry(runtime.getDielinePanels(sanitized, options));
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
