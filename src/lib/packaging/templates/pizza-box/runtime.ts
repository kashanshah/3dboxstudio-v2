import type { TemplateRuntime } from '../../template-runtime';
import { pizzaBoxExportGeometry, pizzaBoxSheet, sanitizePizzaBoxDimensions } from './geometry';
import { buildPizzaBoxTemplateMeshes } from './renderer';

export const pizzaBoxRuntime: TemplateRuntime = {
  templateId: 'pizza-box',
  structureKey: 'pizza-box-v1',
  rendererKey: 'pizza-box-v1',
  sanitizeParameters: sanitizePizzaBoxDimensions,
  // The design grid is the cutting template itself, flaps included.
  getDielinePanels: dimensions => pizzaBoxSheet(dimensions).panels,
  getDielineBounds: dimensions => pizzaBoxSheet(dimensions).bounds,
  getExportGeometry: pizzaBoxExportGeometry,
  buildMeshes: buildPizzaBoxTemplateMeshes,
  assembly: {
    control: 'none',
    defaultOpeningMode: 'lid_from_back',
    hasOpeningStage: () => true,
  },
  exportSummary: 'One-piece pizza box cutting template with a locking double front. Your box maker must approve the flute and allowances.',
  exportArtworkNote: 'Artwork prints exactly as laid out on the design grid, including the flaps.',
};
