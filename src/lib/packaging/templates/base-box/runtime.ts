import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { sanitizeCartonDimensions } from '@/lib/packaging/reverse-tuck';
import { getBaseBoxBounds, getBaseBoxPanels } from './geometry';
import { buildBaseBoxTemplateMeshes } from './renderer';

export const baseBoxRuntime:TemplateRuntime={
  templateId:'base-box',
  structureKey:'base-box-v1',
  rendererKey:'base-box-v1',
  sanitizeParameters:sanitizeCartonDimensions,
  getDielinePanels:(dimensions,options)=>getBaseBoxPanels(dimensions,options?.openingMode??'closed'),
  getDielineBounds:(dimensions,options)=>getBaseBoxBounds(dimensions,options?.openingMode??'closed'),
  buildMeshes:buildBaseBoxTemplateMeshes,
  assembly:{
    control:'opening-mechanism',
    defaultOpeningMode:'closed',
    hasOpeningStage:openingMode=>openingMode!=='closed',
  },
};
