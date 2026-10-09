import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { reverseTuckFoldState, sanitizeCartonDimensions } from './geometry';
import { buildReverseTuckTemplateMeshes } from './renderer';
import { reverseTuckExportGeometry, reverseTuckSheet } from './export';

export const reverseTuckRuntime:TemplateRuntime={
  templateId:'reverse-tuck-carton',
  structureKey:'reverse-tuck-v1',
  rendererKey:'reverse-tuck-v1',
  sanitizeParameters:sanitizeCartonDimensions,
  // The design grid is the cutting template itself, flaps included.
  getDielinePanels:dimensions=>reverseTuckSheet(dimensions).panels,
  getDielineBounds:dimensions=>reverseTuckSheet(dimensions).bounds,
  buildMeshes:buildReverseTuckTemplateMeshes,
  getExportGeometry: reverseTuckExportGeometry,
  exportSummary: 'Cutting template with closure flaps. Your printer must approve the stock and crease allowances.',
  exportArtworkNote: 'Artwork prints exactly as laid out on the design grid, including the tuck and dust flaps.',
  assembly:{
    control:'none',
    defaultOpeningMode:'closed',
    legacyOpeningAsFormation:true,
    hasOpeningStage:()=>false,
  },
  getFoldState:reverseTuckFoldState,
};
