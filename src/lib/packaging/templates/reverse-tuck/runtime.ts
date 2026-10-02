import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import {
  getReverseTuckBounds,
  getReverseTuckPanels,
  reverseTuckFoldState,
  sanitizeCartonDimensions,
} from './geometry';
import { buildReverseTuckTemplateMeshes } from './renderer';
import { reverseTuckExportGeometry } from './export';

export const reverseTuckRuntime:TemplateRuntime={
  templateId:'reverse-tuck-carton',
  structureKey:'reverse-tuck-v1',
  rendererKey:'reverse-tuck-v1',
  sanitizeParameters:sanitizeCartonDimensions,
  getDielinePanels:dimensions=>getReverseTuckPanels(dimensions),
  getDielineBounds:dimensions=>getReverseTuckBounds(dimensions),
  buildMeshes:buildReverseTuckTemplateMeshes,
  getExportGeometry: reverseTuckExportGeometry,
  exportSummary: 'Cutting template with closure flaps. Your printer must approve the stock and crease allowances.',
  exportArtworkNote: 'The cutting layout adds unprinted closure flaps and rotates the bottom artwork onto the opposite hinge.',
  assembly:{
    control:'none',
    defaultOpeningMode:'closed',
    legacyOpeningAsFormation:true,
    hasOpeningStage:()=>false,
  },
  getFoldState:reverseTuckFoldState,
};
