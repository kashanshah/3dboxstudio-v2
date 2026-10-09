import type { CartonDimensions } from './reverse-tuck';
import type { DielineExportGeometry } from './export-geometry';
import { reverseTuckExportGeometry } from './templates/reverse-tuck/export';
import { pizzaBoxExportGeometry } from './templates/pizza-box/geometry';
import { splitTopExportGeometry } from './templates/split-top/geometry';

/**
 * Flat dieline for the public template pages. Uses the same geometry as the
 * Studio's PDF export but avoids the template runtimes, which pull in the 3D
 * renderer.
 */
export const PREVIEW_TEMPLATE_IDS = ['reverse-tuck-carton', 'pizza-box', 'split-top-box'] as const;
export type PreviewTemplateId = (typeof PREVIEW_TEMPLATE_IDS)[number];

export function templatePreviewGeometry(templateId: PreviewTemplateId, dimensions: CartonDimensions): DielineExportGeometry {
  switch (templateId) {
    case 'reverse-tuck-carton': return reverseTuckExportGeometry(dimensions);
    case 'pizza-box': return pizzaBoxExportGeometry(dimensions);
    case 'split-top-box': return splitTopExportGeometry(dimensions);
  }
}
