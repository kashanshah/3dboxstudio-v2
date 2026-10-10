// FROZEN REFERENCE. The tuck end cartons exactly as they were hand-written
// before they moved to the parametric definitions in
// src/lib/packaging/parametric/definitions. Nothing in the app imports this
// file: scripts/parametric-templates.test.cjs compares the definitions
// against it, so any change to a die or fold shows up as a test failure.
// Never edit it to make that test pass.

import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { reverseTuckFoldState, sanitizeCartonDimensions } from '@/lib/packaging/reverse-tuck';
import { buildReverseTuckTemplateMeshes } from './reverse-tuck-renderer';
import { reverseTuckExportGeometry, reverseTuckSheet } from './reverse-tuck-export';

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
