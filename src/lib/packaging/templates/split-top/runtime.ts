import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { sanitizeSplitTopDimensions, splitTopExportGeometry, splitTopSheet } from './geometry';
import { buildSplitTopTemplateMeshes } from './renderer';

export const splitTopRuntime:TemplateRuntime={
  templateId:'split-top-box',
  structureKey:'split-top-box-v1',
  rendererKey:'split-top-box-v1',
  sanitizeParameters:sanitizeSplitTopDimensions,
  // The design grid is the cutting template itself, flaps included.
  getDielinePanels:(dimensions,options)=>splitTopSheet(dimensions,options?.splitTopHingeSide??'side_a').panels,
  getDielineBounds:(dimensions,options)=>splitTopSheet(dimensions,options?.splitTopHingeSide??'side_a').bounds,
  buildMeshes:buildSplitTopTemplateMeshes,
  getExportGeometry:(dimensions,options)=>splitTopExportGeometry(dimensions,options?.splitTopHingeSide??'side_a'),
  exportSummary:'Slotted shipping box cutting template. Your box maker must approve the flute and score allowances.',
  exportArtworkNote:'Artwork prints exactly as laid out on the design grid, including the flaps.',
  assembly:{
    control:'split-direction',
    defaultOpeningMode:'top_split_meet_center',
    hasOpeningStage:()=>true,
  },
};
