import type { CartonDimensions } from './reverse-tuck';
import type { DielineExportGeometry } from './export-geometry';
import { reverseTuckExportGeometry } from './templates/reverse-tuck/export';
import { pizzaBoxExportGeometry } from './templates/pizza-box/geometry';
import { splitTopExportGeometry } from './templates/split-top/geometry';
import { mailerBoxExportGeometry } from './templates/mailer-box/geometry';
import { rigidLidBaseExportGeometry } from './templates/rigid-lid-base/geometry';
import { baseBoxExportGeometry } from './templates/base-box/geometry';
import { sleeveBoxExportGeometry } from './templates/sleeve-box/geometry';
import { autoLockBottomExportGeometry } from './templates/auto-lock-bottom/geometry';
import { snapLockBottomExportGeometry } from './templates/snap-lock-bottom/geometry';
import { pillowBoxExportGeometry } from './templates/pillow-box/geometry';
import { gableBoxExportGeometry } from './templates/gable-box/geometry';
import { drawerBoxExportGeometry } from './templates/drawer-box/geometry';

/**
 * Flat dieline for the public template pages. Uses the same geometry as the
 * Studio's PDF export but avoids the template runtimes, which pull in the 3D
 * renderer.
 */
export const PREVIEW_TEMPLATE_IDS = ['reverse-tuck-carton', 'pizza-box', 'split-top-box', 'mailer-box', 'rigid-lid-base', 'base-box', 'sleeve-box', 'auto-lock-bottom-box', 'snap-lock-bottom-box', 'pillow-box', 'gable-box', 'drawer-box'] as const;
export type PreviewTemplateId = (typeof PREVIEW_TEMPLATE_IDS)[number];

export function templatePreviewGeometry(templateId: PreviewTemplateId, dimensions: CartonDimensions): DielineExportGeometry {
  switch (templateId) {
    case 'reverse-tuck-carton': return reverseTuckExportGeometry(dimensions);
    case 'pizza-box': return pizzaBoxExportGeometry(dimensions);
    case 'split-top-box': return splitTopExportGeometry(dimensions);
    case 'mailer-box': return mailerBoxExportGeometry(dimensions);
    case 'rigid-lid-base': return rigidLidBaseExportGeometry(dimensions);
    case 'base-box': return baseBoxExportGeometry(dimensions);
    case 'sleeve-box': return sleeveBoxExportGeometry(dimensions);
    case 'auto-lock-bottom-box': return autoLockBottomExportGeometry(dimensions);
    case 'snap-lock-bottom-box': return snapLockBottomExportGeometry(dimensions);
    case 'pillow-box': return pillowBoxExportGeometry(dimensions);
    case 'gable-box': return gableBoxExportGeometry(dimensions);
    case 'drawer-box': return drawerBoxExportGeometry(dimensions);
  }
}
