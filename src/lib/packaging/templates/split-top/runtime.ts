import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { sanitizeCartonDimensions } from '@/lib/packaging/reverse-tuck';
import { getSplitTopBounds, getSplitTopPanels } from './geometry';
import { buildSplitTopTemplateMeshes } from './renderer';

export const splitTopRuntime:TemplateRuntime={
  templateId:'split-top-box',
  structureKey:'split-top-box-v1',
  rendererKey:'split-top-box-v1',
  sanitizeParameters:sanitizeCartonDimensions,
  getDielinePanels:(dimensions,options)=>getSplitTopPanels(dimensions,options?.splitTopHingeSide??'side_a'),
  getDielineBounds:(dimensions,options)=>getSplitTopBounds(dimensions,options?.splitTopHingeSide??'side_a'),
  buildMeshes:buildSplitTopTemplateMeshes,
  assembly:{
    control:'split-direction',
    defaultOpeningMode:'top_split_meet_center',
    hasOpeningStage:()=>true,
  },
};
