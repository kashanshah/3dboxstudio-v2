import type { CartonDimensions, FoldStage } from '@/lib/packaging/reverse-tuck';
import type { TemplateCatalog } from '@/lib/packaging/parametric/format';
import { baseBoxDefinition } from '@/lib/packaging/parametric/definitions/base-box';
import { splitTopDefinition } from '@/lib/packaging/parametric/definitions/split-top';
import { reverseTuckDefinition } from '@/lib/packaging/parametric/definitions/reverse-tuck';
import { pizzaBoxDefinition } from '@/lib/packaging/parametric/definitions/pizza-box';
import { sleeveBoxDefinition } from '@/lib/packaging/parametric/definitions/sleeve-box';

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
};

export type ArtworkRegionDefinition = {
  id: string;
  label: string;
  surface: 'outside' | 'inside';
  panelId: string;
};

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
  fixedOpeningMode?: string;
  isDefault?: boolean;
  /** Render of the finished box for template cards (scripts/render-template-thumbnails.mjs). */
  thumbnail?: string;

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

  // Catalog seeds. These intentionally remain planned until their real
  // structure + geometry adapters are implemented and validated; a template
  // becomes ready by getting a parametric definition with a catalog entry.
  {
    id: 'mailer-box',
    version: 1,
    name: 'Mailer Box',
    shortName: 'Mailer',
    family: 'corrugated',
    category: 'Corrugated',
    description: 'Self-locking shipping and presentation mailer.',
    tags: ['mailer','shipping','corrugated','ecommerce'],
    rendererKey: 'mailer-v1',
    structureKey: 'mailer-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
  fromDefinition(pizzaBoxDefinition),
  fromDefinition(sleeveBoxDefinition),
  {
    id: 'rigid-lid-base',
    version: 1,
    name: 'Rigid Lid & Base Box',
    shortName: 'Rigid lid',
    family: 'rigid-box',
    category: 'Rigid',
    description: 'Two-piece premium rigid box.',
    tags: ['rigid','gift','lid','base','luxury'],
    rendererKey: 'rigid-lid-base-v1',
    structureKey: 'rigid-lid-base-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
  {
    id: 'drawer-box',
    version: 1,
    name: 'Drawer Box',
    shortName: 'Drawer',
    family: 'rigid-box',
    category: 'Rigid',
    description: 'Sliding tray and outer sleeve rigid package.',
    tags: ['drawer','rigid','sleeve','gift'],
    rendererKey: 'drawer-v1',
    structureKey: 'drawer-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
  {
    id: 'stand-up-pouch',
    version: 1,
    name: 'Stand-up Pouch',
    shortName: 'Pouch',
    family: 'pouch',
    category: 'Flexible',
    description: 'Flexible pouch with bottom gusset.',
    tags: ['pouch','flexible','food','coffee'],
    rendererKey: 'stand-up-pouch-v1',
    structureKey: 'stand-up-pouch-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
  {
    id: 'glass-bottle',
    version: 1,
    name: 'Glass Bottle',
    shortName: 'Bottle',
    family: 'bottle',
    category: 'Bottles & Jars',
    description: 'Round bottle with label and closure regions.',
    tags: ['bottle','glass','label','beverage'],
    rendererKey: 'glass-bottle-v1',
    structureKey: 'glass-bottle-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
  {
    id: 'round-jar',
    version: 1,
    name: 'Round Jar',
    shortName: 'Jar',
    family: 'jar',
    category: 'Bottles & Jars',
    description: 'Round jar with wrap label and lid.',
    tags: ['jar','cosmetics','food','label'],
    rendererKey: 'round-jar-v1',
    structureKey: 'round-jar-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
  {
    id: 'paper-cup',
    version: 1,
    name: 'Paper Cup',
    shortName: 'Cup',
    family: 'cup',
    category: 'Cups & Cans',
    description: 'Tapered cup with wrap artwork region.',
    tags: ['cup','coffee','beverage','paper'],
    rendererKey: 'paper-cup-v1',
    structureKey: 'paper-cup-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
  {
    id: 'beverage-can',
    version: 1,
    name: 'Beverage Can',
    shortName: 'Can',
    family: 'can',
    category: 'Cups & Cans',
    description: 'Cylindrical can with full wrap artwork.',
    tags: ['can','beverage','aluminum','wrap'],
    rendererKey: 'beverage-can-v1',
    structureKey: 'beverage-can-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
];

const templateMap = new Map(PACKAGING_TEMPLATES.map(template => [template.id, template]));

export function getPackagingTemplate(id: string) {
  return templateMap.get(id) ?? null;
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
