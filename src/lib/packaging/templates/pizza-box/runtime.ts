import type { TemplateRuntime } from '../../template-runtime';
import { sanitizeCartonDimensions } from '../../reverse-tuck';
import { getPizzaBoxBounds, getPizzaBoxPanels } from './geometry';
import { buildPizzaBoxTemplateMeshes } from './renderer';

export const pizzaBoxRuntime: TemplateRuntime = {
  templateId: 'pizza-box',
  structureKey: 'pizza-box-v1',
  rendererKey: 'pizza-box-v1',
  sanitizeParameters: sanitizeCartonDimensions,
  getDielinePanels: getPizzaBoxPanels,
  getDielineBounds: getPizzaBoxBounds,
  buildMeshes: buildPizzaBoxTemplateMeshes,
  assembly: {
    control: 'none',
    defaultOpeningMode: 'lid_from_back',
    hasOpeningStage: () => true,
  },
  exportSummary: 'Pizza box layout proof with tray walls, corner tabs and a rear-hinged lid.',
  exportArtworkNote: 'Nominal panel layout; locking slots and manufacturing allowances are not included.',
};
