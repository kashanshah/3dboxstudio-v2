import type { PackagingTemplateDefinition } from '@/lib/packaging/template-registry';
import { createTranslator, type MessageKey } from './index';

type TemplateCopy = Pick<PackagingTemplateDefinition, 'name' | 'shortName' | 'category' | 'description'>;
const keys: Record<string, Record<keyof TemplateCopy, MessageKey>> = {
  "base-box": {
    "name": "templates.base-box.name",
    "shortName": "templates.base-box.shortName",
    "category": "templates.base-box.category",
    "description": "templates.base-box.description"
  },
  "split-top-box": {
    "name": "templates.split-top-box.name",
    "shortName": "templates.split-top-box.shortName",
    "category": "templates.split-top-box.category",
    "description": "templates.split-top-box.description"
  },
  "reverse-tuck-carton": {
    "name": "templates.reverse-tuck-carton.name",
    "shortName": "templates.reverse-tuck-carton.shortName",
    "category": "templates.reverse-tuck-carton.category",
    "description": "templates.reverse-tuck-carton.description"
  },
  "auto-lock-bottom-box": {
    "name": "templates.auto-lock-bottom-box.name",
    "shortName": "templates.auto-lock-bottom-box.shortName",
    "category": "templates.auto-lock-bottom-box.category",
    "description": "templates.auto-lock-bottom-box.description"
  },
  "snap-lock-bottom-box": {
    "name": "templates.snap-lock-bottom-box.name",
    "shortName": "templates.snap-lock-bottom-box.shortName",
    "category": "templates.snap-lock-bottom-box.category",
    "description": "templates.snap-lock-bottom-box.description"
  },
  "pillow-box": {
    "name": "templates.pillow-box.name",
    "shortName": "templates.pillow-box.shortName",
    "category": "templates.pillow-box.category",
    "description": "templates.pillow-box.description"
  },
  "gable-box": {
    "name": "templates.gable-box.name",
    "shortName": "templates.gable-box.shortName",
    "category": "templates.gable-box.category",
    "description": "templates.gable-box.description"
  },
  "mailer-box": {
    "name": "templates.mailer-box.name",
    "shortName": "templates.mailer-box.shortName",
    "category": "templates.mailer-box.category",
    "description": "templates.mailer-box.description"
  },
  "pizza-box": {
    "name": "templates.pizza-box.name",
    "shortName": "templates.pizza-box.shortName",
    "category": "templates.pizza-box.category",
    "description": "templates.pizza-box.description"
  },
  "sleeve-box": {
    "name": "templates.sleeve-box.name",
    "shortName": "templates.sleeve-box.shortName",
    "category": "templates.sleeve-box.category",
    "description": "templates.sleeve-box.description"
  },
  "rigid-lid-base": {
    "name": "templates.rigid-lid-base.name",
    "shortName": "templates.rigid-lid-base.shortName",
    "category": "templates.rigid-lid-base.category",
    "description": "templates.rigid-lid-base.description"
  },
  "drawer-box": {
    "name": "templates.drawer-box.name",
    "shortName": "templates.drawer-box.shortName",
    "category": "templates.drawer-box.category",
    "description": "templates.drawer-box.description"
  },
};

/** Localize display fields only. Geometry, panel names, category filters and persisted IDs remain stable. */
export function getPackagingTemplateCopy(template: PackagingTemplateDefinition, t = createTranslator()): TemplateCopy {
  const localized = keys[template.id];
  if (!localized) return { name: template.name, shortName: template.shortName, category: template.category, description: template.description };
  return { name: t(localized.name), shortName: t(localized.shortName), category: t(localized.category), description: t(localized.description) };
}
