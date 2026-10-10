// FROZEN REFERENCE. The tuck end cartons exactly as they were hand-written
// before they moved to the parametric definitions in
// src/lib/packaging/parametric/definitions. Nothing in the app imports this
// file: scripts/parametric-templates.test.cjs compares the definitions
// against it, so any change to a die or fold shows up as a test failure.
// Never edit it to make that test pass.

import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { sanitizeCartonDimensions } from '@/lib/packaging/reverse-tuck';
import { baseBoxExportGeometry, baseBoxSheet } from './base-box-geometry';
import { buildBaseBoxTemplateMeshes } from './base-box-renderer';

export const baseBoxRuntime:TemplateRuntime={
  templateId:'base-box',
  structureKey:'base-box-v1',
  rendererKey:'base-box-v1',
  sanitizeParameters:sanitizeCartonDimensions,
  // The design grid is the cutting template itself, flaps included.
  getDielinePanels:(dimensions,options)=>baseBoxSheet(dimensions,options?.openingMode??'closed').panels,
  getDielineBounds:(dimensions,options)=>baseBoxSheet(dimensions,options?.openingMode??'closed').bounds,
  buildMeshes:buildBaseBoxTemplateMeshes,
  getExportGeometry:(dimensions,options)=>baseBoxExportGeometry(dimensions,options?.openingMode??'closed'),
  exportSummary:'Straight tuck end cutting template with closure flaps. Your printer must approve the stock and crease allowances.',
  exportArtworkNote:'Artwork prints exactly as laid out on the design grid, including the tuck and dust flaps.',
  assembly:{
    control:'opening-mechanism',
    defaultOpeningMode:'closed',
    hasOpeningStage:openingMode=>openingMode!=='closed',
  },
};
