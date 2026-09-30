import type { CartonDimensions, FoldStage } from '@/lib/packaging/reverse-tuck';

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

  status: 'ready' | 'planned';
};

const exteriorRegions = ['Front','Back','Left','Right','Top','Bottom'].map(label => ({
  id: `outside-${label.toLowerCase()}`,
  label,
  surface: 'outside' as const,
  panelId: label,
}));

const interiorRegions = ['Front','Back','Left','Right','Top','Bottom'].map(label => ({
  id: `inside-${label.toLowerCase()}`,
  label: `Inside ${label}`,
  surface: 'inside' as const,
  panelId: `Interior ${label}`,
}));

export const PACKAGING_TEMPLATES: PackagingTemplateDefinition[] = [
  {
    id: 'base-box',
    version: 1,
    name: 'Base Box',
    shortName: 'Base box',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'General six-face box used by legacy designs, with configurable hinged-face opening behavior.',
    tags: ['box','legacy','generic','hinged lid','door'],
    rendererKey: 'base-box-v1',
    structureKey: 'base-box-v1',
    capabilities: ['dieline','3d','interior-artwork','full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 1, step: 1, defaultValue: 240 },
      { key: 'height', label: 'Height', unit: 'mm', min: 1, step: 1, defaultValue: 100 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 1, step: 1, defaultValue: 160 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: [...exteriorRegions, ...interiorRegions],
    defaultDimensions: { width: 240, height: 100, depth: 160, thickness: 0.5 },
    status: 'ready',
  },
  {
    id: 'split-top-box',
    version: 1,
    name: 'Split Top Box',
    shortName: 'Split top',
    family: 'corrugated',
    category: 'Corrugated',
    description: 'Six-face box whose top surface is split into two independently hinged panels.',
    tags: ['box','legacy','split top','dual flap','shipping'],
    rendererKey: 'split-top-box-v1',
    structureKey: 'split-top-box-v1',
    capabilities: ['dieline','3d','interior-artwork','full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 1, step: 1, defaultValue: 400 },
      { key: 'height', label: 'Height', unit: 'mm', min: 1, step: 1, defaultValue: 300 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 1, step: 1, defaultValue: 300 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: [
      ...exteriorRegions.filter(region => region.panelId !== 'Top'),
      {id:'outside-top-left',label:'Top left',surface:'outside',panelId:'Top Left'},
      {id:'outside-top-right',label:'Top right',surface:'outside',panelId:'Top Right'},
      ...interiorRegions.filter(region => region.panelId !== 'Interior Top'),
      {id:'inside-top-left',label:'Inside top left',surface:'inside',panelId:'Interior Top Left'},
      {id:'inside-top-right',label:'Inside top right',surface:'inside',panelId:'Interior Top Right'},
    ],
    defaultDimensions: { width: 400, height: 300, depth: 300, thickness: 0.5 },
    status: 'ready',
  },
  {
    id: 'reverse-tuck-carton',
    version: 1,
    name: 'Reverse Tuck End Carton',
    shortName: 'Reverse tuck',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Classic folding carton with opposite top and bottom tuck directions.',
    tags: ['carton','tuck','retail','paperboard','reverse tuck'],
    rendererKey: 'reverse-tuck-v1',
    structureKey: 'reverse-tuck-v1',
    capabilities: ['dieline','3d','fold','interior-artwork','full-dieline-artwork'],
    parameters: [
      { key: 'width', label: 'Width', unit: 'mm', min: 30, max: 400, step: 1, defaultValue: 120 },
      { key: 'height', label: 'Height', unit: 'mm', min: 40, max: 500, step: 1, defaultValue: 180 },
      { key: 'depth', label: 'Depth', unit: 'mm', min: 15, max: 250, step: 1, defaultValue: 55 },
      { key: 'thickness', label: 'Board thickness', unit: 'mm', min: 0.3, max: 2, step: 0.1, defaultValue: 0.5 },
    ],
    artworkRegions: [...exteriorRegions, ...interiorRegions],
    defaultDimensions: { width: 120, height: 180, depth: 55, thickness: 0.5 },
    status: 'ready',
  },

  // Catalog seeds. These intentionally remain planned until their real
  // structure + geometry adapters are implemented and validated.
  {
    id: 'straight-tuck-carton',
    version: 1,
    name: 'Straight Tuck End Carton',
    shortName: 'Straight tuck',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Folding carton with top and bottom tuck flaps closing in the same direction.',
    tags: ['carton','tuck','retail','paperboard'],
    rendererKey: 'straight-tuck-v1',
    structureKey: 'straight-tuck-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
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
  {
    id: 'pizza-box',
    version: 1,
    name: 'Pizza Box',
    shortName: 'Pizza box',
    family: 'corrugated',
    category: 'Food',
    description: 'Hinged corrugated food box.',
    tags: ['pizza','food','corrugated','takeout'],
    rendererKey: 'pizza-box-v1',
    structureKey: 'pizza-box-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
  {
    id: 'sleeve-box',
    version: 1,
    name: 'Sleeve Box',
    shortName: 'Sleeve',
    family: 'folding-carton',
    category: 'Cartons',
    description: 'Open-ended sleeve for trays and product wraps.',
    tags: ['sleeve','carton','wrap'],
    rendererKey: 'sleeve-v1',
    structureKey: 'sleeve-v1',
    capabilities: [],
    parameters: [],
    artworkRegions: [],
    status: 'planned',
  },
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
  return templateMap.get('reverse-tuck-carton') ?? getReadyPackagingTemplates()[0] ?? null;
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
