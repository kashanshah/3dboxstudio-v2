import type { CartonDimensions } from './reverse-tuck';
import type { ParametricTemplate } from './parametric/format';
import { getPackagingTemplate, PACKAGING_TEMPLATES, STUDIO_MATERIALS, type PackagingTemplateDefinition, type StudioMaterial } from './template-registry';
import { registerJsonTemplates } from './json-templates';

// The template catalog as the site shows it: the built-in templates and the
// ones an admin added, with what the admin changed (Admin → Templates). The
// settings live in the database (src/server/templates.ts) and reach the
// browser as plain records; resolveTemplateCatalog turns them into the list
// every picker, gallery and count reads.
//
// Three kinds of template:
//  - built-in: code-defined (template-registry.ts); a record only exists
//    once an admin changes something, so built-ins are active by default;
//  - named: an existing style with its own name and defaults ("Candle box
//    80×100" on the hexagon box). Designs made from one keep the style's
//    templateId, so the runtime, layout migrations and exports never see
//    the named id, and record it separately as `presetId`;
//  - json: an uploaded parametric definition with its own id and runtime
//    (json-templates.ts).
//
// Inactive templates are left out of every list but stay registered, so
// existing designs and share links keep opening.

export type TemplateSource = 'built-in' | 'named' | 'json';

/** What an admin can set on a template: overrides for built-in and JSON templates, a named template's own fields. */
export type TemplateDisplayFields = {
  name?: string;
  description?: string;
  category?: string;
  /** Card order: lower first. */
  order?: number;
  defaultDimensions?: CartonDimensions;
  defaultMaterial?: StudioMaterial;
  /** Card picture: a site path or an uploaded image's /api/media URL. */
  thumbnail?: string;
};

export type TemplateSettingsRecord = {
  id: string;
  source: TemplateSource;
  active: boolean;
  /** A named template's style. */
  baseTemplateId?: string | null;
  fields: TemplateDisplayFields;
  /** A JSON template's definition. */
  definition?: ParametricTemplate | null;
  updatedAt?: string | null;
};

export type TemplateCatalogEntry = PackagingTemplateDefinition & {
  source: TemplateSource;
  active: boolean;
  /** The template the runtime draws: the entry's own id, or a named template's style. */
  templateId: string;
  /** Set on a named template: its id, which designs record as `presetId`. */
  presetId?: string;
  order: number;
  /** Whether an admin set the order; otherwise each list keeps its own (the gallery its page order). */
  orderSet: boolean;
  /** A built-in or JSON template an admin changed (Reset to original clears it). */
  customized: boolean;
  updatedAt: string | null;
};

export const DEFAULT_ORDER_STEP = 10;

/** No settings: the built-in catalog. One shared value, so a memo keyed on it holds. */
export const NO_TEMPLATE_RECORDS: readonly TemplateSettingsRecord[] = [];

/** A named template's id must not collide with a template id or a JSON template's. */
export const NAMED_TEMPLATE_ID = /^[a-z][a-z0-9-]{2,60}$/;

function applyFields(template: PackagingTemplateDefinition, fields: TemplateDisplayFields): PackagingTemplateDefinition {
  const customCopy: PackagingTemplateDefinition['customCopy'] = {
    ...(fields.name ? { name: fields.name, shortName: fields.name } : {}),
    ...(fields.description ? { description: fields.description } : {}),
    ...(fields.category ? { category: fields.category } : {}),
  };
  return {
    ...template,
    ...customCopy,
    ...(Object.keys(customCopy).length ? { customCopy } : {}),
    ...(fields.defaultDimensions ? { defaultDimensions: fields.defaultDimensions } : {}),
    ...(fields.defaultMaterial ? { defaultMaterial: fields.defaultMaterial } : {}),
    ...(fields.thumbnail ? { thumbnail: fields.thumbnail } : {}),
  };
}

const hasFields = (fields: TemplateDisplayFields | undefined) => Boolean(fields && Object.values(fields).some(value => value !== undefined && value !== ''));

/**
 * Every template, active or not, with the admin's changes applied, in card
 * order. Registers the JSON templates first, so their runtimes resolve.
 */
export function resolveTemplateCatalog(records: readonly TemplateSettingsRecord[]): TemplateCatalogEntry[] {
  registerJsonTemplates(records.flatMap(record => record.source === 'json' && record.definition ? [record.definition] : []));
  const byId = new Map(records.map(record => [record.id, record]));
  const entries: TemplateCatalogEntry[] = [];
  PACKAGING_TEMPLATES.filter(template => template.status === 'ready').forEach((template, index) => {
    const record = byId.get(template.id);
    const fields = record?.source === 'built-in' ? record.fields : {};
    entries.push({
      ...applyFields(template, fields),
      source: 'built-in', active: record?.source === 'built-in' ? record.active : true,
      templateId: template.id, order: fields.order ?? (index + 1) * DEFAULT_ORDER_STEP, orderSet: fields.order !== undefined,
      customized: hasFields(fields), updatedAt: record?.updatedAt ?? null,
    });
  });
  const builtInCount = entries.length;
  records.forEach((record, index) => {
    const fallbackOrder = (builtInCount + index + 1) * DEFAULT_ORDER_STEP;
    if (record.source === 'json') {
      const template = record.definition ? getPackagingTemplate(record.definition.templateId) : null;
      if (!template || template.id !== record.id) return;
      entries.push({
        ...applyFields(template, record.fields), source: 'json', active: record.active, templateId: template.id,
        order: record.fields.order ?? fallbackOrder, orderSet: record.fields.order !== undefined, customized: hasFields(record.fields), updatedAt: record.updatedAt ?? null,
      });
    } else if (record.source === 'named') {
      const base = record.baseTemplateId ? getPackagingTemplate(record.baseTemplateId) : null;
      if (!base) return;
      const name = record.fields.name || base.name;
      entries.push({
        ...base,
        id: record.id,
        name, shortName: name,
        description: record.fields.description ?? base.description,
        category: record.fields.category || base.category,
        // The style's translated copy doesn't apply: the named template has its own words.
        customCopy: undefined,
        isDefault: false,
        defaultDimensions: record.fields.defaultDimensions ?? base.defaultDimensions,
        defaultMaterial: record.fields.defaultMaterial ?? base.defaultMaterial,
        thumbnail: record.fields.thumbnail ?? base.thumbnail,
        source: 'named', active: record.active, templateId: base.id, presetId: record.id,
        order: record.fields.order ?? fallbackOrder, orderSet: record.fields.order !== undefined, customized: false, updatedAt: record.updatedAt ?? null,
      });
    }
  });
  return entries.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** A built-in template's card order when no admin has set one. */
export function builtInOrder(id: string) {
  const index = PACKAGING_TEMPLATES.filter(template => template.status === 'ready').findIndex(template => template.id === id);
  return index < 0 ? null : (index + 1) * DEFAULT_ORDER_STEP;
}

/** The template a catalog entry or registry record is drawn by. */
export function templateIdOf(template: PackagingTemplateDefinition & { templateId?: string }) {
  return template.templateId ?? template.id;
}

/** The templates the site lists: active ones, in card order. */
export function listedTemplates(entries: readonly TemplateCatalogEntry[]) {
  return entries.filter(entry => entry.active);
}

/** The entry for a design: its named template when it records one, else its template. */
export function catalogEntryFor(entries: readonly TemplateCatalogEntry[], state: { templateId?: string; presetId?: string } | null | undefined) {
  if (!state) return null;
  return (state.presetId ? entries.find(entry => entry.presetId === state.presetId && entry.templateId === state.templateId) : null)
    ?? entries.find(entry => entry.id === state.templateId && !entry.presetId)
    ?? null;
}

/** How many box styles the site offers, for page copy: active built-in and JSON templates (named templates reuse a style). */
export function activeStyleCount(entries: readonly TemplateCatalogEntry[]) {
  return entries.filter(entry => entry.active && entry.source !== 'named').length;
}

/** The ids of templates an admin made inactive. */
export function inactiveTemplateIds(entries: readonly TemplateCatalogEntry[]) {
  return new Set(entries.filter(entry => !entry.active).map(entry => entry.id));
}

/** Records a page needs in the browser: overrides and named templates, and JSON definitions that are active or in `keep`. */
export function clientTemplateRecords(records: readonly TemplateSettingsRecord[], keep: Iterable<string | undefined> = []) {
  const wanted = new Set(keep);
  return records.filter(record => record.source !== 'json' || record.active || wanted.has(record.id));
}

/** Checks a default size against the style's size controls; returns a message, or null when it fits. */
export function defaultSizeProblem(template: PackagingTemplateDefinition, dimensions: CartonDimensions): string | null {
  for (const key of ['width', 'height', 'depth', 'thickness'] as const) {
    const value = dimensions[key];
    const control = template.parameters.find(parameter => parameter.key === key);
    const label = control?.label ?? key;
    if (!Number.isFinite(value) || value <= 0) return `${label} must be a number above zero.`;
    if (control?.min !== undefined && value < control.min) return `${label} must be at least ${control.min} mm for this style.`;
    if (control?.max !== undefined && value > control.max) return `${label} must be at most ${control.max} mm for this style.`;
  }
  return null;
}

export function isStudioMaterial(value: unknown): value is StudioMaterial {
  return typeof value === 'string' && (STUDIO_MATERIALS as readonly string[]).includes(value);
}
