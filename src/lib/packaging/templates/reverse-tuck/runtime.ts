import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import {
  getReverseTuckBounds,
  getReverseTuckPanels,
  reverseTuckFoldState,
  sanitizeCartonDimensions,
} from './geometry';
import { buildReverseTuckTemplateMeshes } from './renderer';

export const reverseTuckRuntime:TemplateRuntime={
  templateId:'reverse-tuck-carton',
  structureKey:'reverse-tuck-v1',
  rendererKey:'reverse-tuck-v1',
  sanitizeParameters:sanitizeCartonDimensions,
  getDielinePanels:dimensions=>getReverseTuckPanels(dimensions),
  getDielineBounds:dimensions=>getReverseTuckBounds(dimensions),
  buildMeshes:buildReverseTuckTemplateMeshes,
  assembly:{
    control:'none',
    defaultOpeningMode:'closed',
    legacyOpeningAsFormation:true,
    hasOpeningStage:()=>false,
  },
  getFoldState:reverseTuckFoldState,
};
