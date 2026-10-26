import type { CartonDimensions, FoldStage } from '@/lib/packaging/reverse-tuck';
import type { TemplateCatalog } from '@/lib/packaging/parametric/format';
import { baseBoxDefinition } from '@/lib/packaging/parametric/definitions/base-box';
import { splitTopDefinition } from '@/lib/packaging/parametric/definitions/split-top';
import { reverseTuckDefinition } from '@/lib/packaging/parametric/definitions/reverse-tuck';
import { pizzaBoxDefinition } from '@/lib/packaging/parametric/definitions/pizza-box';
import { sleeveBoxDefinition } from '@/lib/packaging/parametric/definitions/sleeve-box';
import { mailerBoxDefinition } from '@/lib/packaging/parametric/definitions/mailer-box';
import { rigidLidBaseDefinition } from '@/lib/packaging/parametric/definitions/rigid-lid-base';
import { autoLockBottomDefinition } from '@/lib/packaging/parametric/definitions/auto-lock-bottom';
import { snapLockBottomDefinition } from '@/lib/packaging/parametric/definitions/snap-lock-bottom';
import { pillowBoxDefinition } from '@/lib/packaging/parametric/definitions/pillow-box';
import { gableBoxDefinition } from '@/lib/packaging/parametric/definitions/gable-box';
import { drawerBoxDefinition } from '@/lib/packaging/parametric/definitions/drawer-box';
import { trayBoxDefinition, telescopeBoxDefinition } from '@/lib/packaging/parametric/definitions/tray-box';
import { cakeBoxDefinition } from '@/lib/packaging/parametric/definitions/cake-box';
import { hexagonBoxDefinition } from '@/lib/packaging/parametric/definitions/hexagon-box';

export type PackagingFamily =
  | 'folding-carton'
  | 'corrugated'
  | 'rigid-box'
  | 'bottle'
  | 'jar'
  | 'can'
  | 'tube'
  | 'pouch'
  | 'cup'
  | 'other';

export type TemplateCapability =
  | 'dieline'
  | '3d'
  | 'fold'
  | 'interior-artwork'
  | 'full-dieline-artwork'
  | 'production-export';

export type TemplateParameterDefinition = {
  key: string;
  label: string;
  unit?: 'mm' | 'in' | '%';
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number;
  /**
   * The edge of the 3D box this size is drawn along when sizes are shown:
   * by default width along x, height along y and depth along z. Null when it
   * isn't one of the box's outside extents (a hexagon box's lid depth).
   */
  measuredAlong?: 'x' | 'y' | 'z' | null;
};

export type ArtworkRegionDefinition = {
  id: string;
  label: string;
  surface: 'outside' | 'inside';
  panelId: string;
};

/** The board and print finishes the Studio offers. */
export const STUDIO_MATERIALS = ['White board', 'Kraft', 'Soft touch', 'Matte coated', 'Gloss coated', 'Foil'] as const;
export type StudioMaterial = (typeof STUDIO_MATERIALS)[number];

export type PackagingTemplateDefinition = {
  id: string;
  version: number;
  name: string;
  shortName: string;
  family: PackagingFamily;
  category: string;
  description: string;
  tags: string[];

  rendererKey: string;
  structureKey: string;

  capabilities: TemplateCapability[];
  parameters: TemplateParameterDefinition[];
  artworkRegions: ArtworkRegionDefinition[];
  foldStages?: FoldStage[];

  defaultDimensions?: CartonDimensions;
  /**
   * The finish a new design of this box starts with, coloured by that
   * material, until the person picks another finish or colour.
   */
  defaultMaterial: StudioMaterial;
  fixedOpeningMode?: string;
  isDefault?: boolean;
  /** Render of the finished box for template cards (scripts/render-template-thumbnails.mjs). */
  thumbnail?: string;
  /**
   * Name, description or category an admin set (template-catalog.ts). They
   * replace the translated copy, which only knows the original wording.
   */
  customCopy?: Partial<Pick<PackagingTemplateDefinition, 'name' | 'shortName' | 'description' | 'category'>>;

  status: 'ready' | 'planned';
};

/**
 * A ready template's registry record, from its parametric definition: the
 * definition's catalog entry plus the keys the runtime matches on.
 */
function fromDefinition(definition: { templateId: string; rendererKey: string; structureKey: string; catalog?: TemplateCatalog }): PackagingTemplateDefinition {
  if (!definition.catalog) throw new Error(`Template ${definition.templateId} has no catalog entry`);
  return { ...definition.catalog, id: definition.templateId, rendererKey: definition.rendererKey, structureKey: definition.structureKey, status: 'ready' };
}

export const PACKAGING_TEMPLATES: PackagingTemplateDefinition[] = [
  fromDefinition(baseBoxDefinition),
  fromDefinition(splitTopDefinition),
  fromDefinition(reverseTuckDefinition),
  fromDefinition(autoLockBottomDefinition),
  fromDefinition(snapLockBottomDefinition),
  fromDefinition(pillowBoxDefinition),
  fromDefinition(gableBoxDefinition),

  // Every template with a parametric definition and catalog entry is ready.
  fromDefinition(mailerBoxDefinition),
  fromDefinition(pizzaBoxDefinition),
  fromDefinition(sleeveBoxDefinition),
  fromDefinition(drawerBoxDefinition),
  fromDefinition(trayBoxDefinition),
  fromDefinition(telescopeBoxDefinition),
  fromDefinition(cakeBoxDefinition),
  fromDefinition(hexagonBoxDefinition),
  fromDefinition(rigidLidBaseDefinition),
];

const templateMap = new Map(PACKAGING_TEMPLATES.map(template => [template.id, template]));

export function getPackagingTemplate(id: string) {
  return templateMap.get(id) ?? null;
}

/**
 * Adds a template that isn't built in (an uploaded JSON definition,
 * json-templates.ts). PACKAGING_TEMPLATES stays the built-in list; lookups
 * by id find both.
 */
export function registerPackagingTemplate(template: PackagingTemplateDefinition) {
  if (templateMap.has(template.id)) throw new Error(`Template already registered: ${template.id}`);
  templateMap.set(template.id, template);
}

export function isBuiltInTemplate(id: string) {
  return PACKAGING_TEMPLATES.some(template => template.id === id);
}

export function getDefaultPackagingTemplate() {
  return PACKAGING_TEMPLATES.find(template => template.status==='ready' && template.isDefault)
    ?? getReadyPackagingTemplates()[0]
    ?? null;
}

export function getReadyPackagingTemplates() {
  return PACKAGING_TEMPLATES.filter(template => template.status === 'ready');
}

export function getPackagingTemplateCategories() {
  return ['All', ...Array.from(new Set(PACKAGING_TEMPLATES.map(template => template.category)))] as const;
}

export function templateHasCapability(template: PackagingTemplateDefinition, capability: TemplateCapability) {
  return template.capabilities.includes(capability);
}
