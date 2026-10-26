import { ensureV2Schema, getSql } from '@/server/db';
import { countDesignsByTemplate, readTemplateSettings } from '@/server/templates';
import { checkJsonTemplateBuilds, JsonTemplateError, parseJsonTemplate } from '@/lib/packaging/json-templates';
import {
  defaultSizeProblem, isStudioMaterial, NAMED_TEMPLATE_ID, resolveTemplateCatalog,
  type TemplateCatalogEntry, type TemplateDisplayFields, type TemplateSettingsRecord,
} from '@/lib/packaging/template-catalog';
import { getPackagingTemplate, isBuiltInTemplate, type PackagingTemplateDefinition } from '@/lib/packaging/template-registry';
import { getTemplateRuntime } from '@/lib/packaging/template-runtime';

// Admin → Templates: the list with design counts, and every change an admin
// can make. Callers revalidate the public pages (revalidateTemplatePages).

export class TemplateAdminError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export type AdminTemplateRow = TemplateCatalogEntry & { designCount: number };

export async function listAdminTemplates(): Promise<{ templates: AdminTemplateRow[]; records: TemplateSettingsRecord[] }> {
  const [records, counts] = await Promise.all([readTemplateSettings(), countDesignsByTemplate()]);
  const templates = resolveTemplateCatalog(records).map(entry => ({ ...entry, designCount: counts.get(entry.id) ?? 0 }));
  return { templates, records };
}

export async function getAdminTemplate(id: string) {
  const { templates, records } = await listAdminTemplates();
  const template = templates.find(entry => entry.id === id);
  return template ? { template, record: records.find(record => record.id === id) ?? null } : null;
}

const text = (value: unknown, label: string, max: number, required = false) => {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (required && !clean) throw new TemplateAdminError(`Enter a ${label}.`);
  if (clean.length > max) throw new TemplateAdminError(`The ${label} must be at most ${max} characters.`);
  return clean || undefined;
};

const THUMBNAIL = /^(\/api\/template-images\/[0-9a-f-]{36}|\/images\/templates\/[A-Za-z0-9-]+\.webp)$/;

/**
 * The display fields from a form, checked against the style: the default
 * size within its size controls and passing its own size checks. Empty
 * fields are left out, so the original shows through.
 */
export function cleanTemplateFields(input: Record<string, unknown>, style: PackagingTemplateDefinition, options: { requireName?: boolean } = {}): TemplateDisplayFields {
  const fields: TemplateDisplayFields = {};
  const name = text(input.name, 'name', 80, options.requireName);
  if (name) fields.name = name;
  const description = text(input.description, 'short description', 600);
  if (description) fields.description = description;
  const category = text(input.category, 'category', 40);
  if (category) fields.category = category;
  if (input.order !== undefined && input.order !== '' && input.order !== null) {
    const order = Number(input.order);
    if (!Number.isInteger(order) || Math.abs(order) > 100_000) throw new TemplateAdminError('The card order must be a whole number.');
    fields.order = order;
  }
  const sizes = ['width', 'height', 'depth', 'thickness'] as const;
  if (sizes.some(key => input[key] !== undefined && input[key] !== '' && input[key] !== null)) {
    const base = style.defaultDimensions;
    const dimensions = Object.fromEntries(sizes.map(key => {
      const raw = input[key];
      return [key, raw === undefined || raw === '' || raw === null ? base?.[key] ?? NaN : Number(raw)];
    })) as Record<(typeof sizes)[number], number>;
    const problem = defaultSizeProblem(style, dimensions);
    if (problem) throw new TemplateAdminError(problem);
    const runtime = getTemplateRuntime(style.id);
    const [check] = runtime?.getSizeProblems?.(runtime.sanitizeParameters(dimensions)) ?? [];
    if (check) throw new TemplateAdminError(`That default size fails the style's size check: ${check}`);
    fields.defaultDimensions = dimensions;
  }
  if (input.defaultMaterial !== undefined && input.defaultMaterial !== '') {
    if (!isStudioMaterial(input.defaultMaterial)) throw new TemplateAdminError('Choose one of the Studio materials.');
    fields.defaultMaterial = input.defaultMaterial;
  }
  if (typeof input.thumbnail === 'string' && input.thumbnail) {
    if (!THUMBNAIL.test(input.thumbnail)) throw new TemplateAdminError('Upload the picture here, or leave it empty.');
    fields.thumbnail = input.thumbnail;
  }
  return fields;
}

async function recordOf(id: string): Promise<TemplateSettingsRecord | null> {
  return (await readTemplateSettings()).find(record => record.id === id) ?? null;
}

/** The style a template's fields are checked against: itself, or a named template's base. */
async function styleOf(id: string): Promise<{ style: PackagingTemplateDefinition; record: TemplateSettingsRecord | null }> {
  const record = await recordOf(id);
  if (isBuiltInTemplate(id)) return { style: getPackagingTemplate(id)!, record };
  if (!record) throw new TemplateAdminError('This template no longer exists.', 404);
  const styleId = record.source === 'named' ? record.baseTemplateId : record.id;
  const style = styleId ? getPackagingTemplate(styleId) : null;
  if (!style) throw new TemplateAdminError('This template\'s style is not available.', 409);
  return { style, record };
}

export async function setTemplateActive(id: string, active: boolean) {
  if (!active) {
    const listed = resolveTemplateCatalog(await readTemplateSettings()).filter(entry => entry.active && entry.source !== 'named');
    if (listed.length === 1 && listed[0].id === id) throw new TemplateAdminError('Keep at least one box style active.', 409);
  }
  await ensureV2Schema();
  if (isBuiltInTemplate(id)) {
    await getSql().query(`
      INSERT INTO template_settings(id, source, active) VALUES($1, 'built-in', $2)
      ON CONFLICT(id) DO UPDATE SET active=EXCLUDED.active, updated_at=NOW()
    `, [id, active]);
    return;
  }
  const rows = await getSql().query('UPDATE template_settings SET active=$2, updated_at=NOW() WHERE id=$1 RETURNING id', [id, active]) as unknown[];
  if (!rows.length) throw new TemplateAdminError('This template no longer exists.', 404);
}

export async function updateTemplateFields(id: string, input: Record<string, unknown>) {
  const { style, record } = await styleOf(id);
  const fields = cleanTemplateFields(input, style, { requireName: record?.source === 'named' });
  await ensureV2Schema();
  if (isBuiltInTemplate(id)) {
    await getSql().query(`
      INSERT INTO template_settings(id, source, fields) VALUES($1, 'built-in', $2::jsonb)
      ON CONFLICT(id) DO UPDATE SET fields=EXCLUDED.fields, updated_at=NOW()
    `, [id, JSON.stringify(fields)]);
  } else {
    await getSql().query('UPDATE template_settings SET fields=$2::jsonb, updated_at=NOW() WHERE id=$1', [id, JSON.stringify(fields)]);
  }
  return fields;
}

/** Clears a built-in or JSON template's overrides; whether it is active is kept. */
export async function resetTemplateFields(id: string) {
  const record = await recordOf(id);
  if (record?.source === 'named') throw new TemplateAdminError('A named template has no original to go back to; edit its fields instead.');
  await ensureV2Schema();
  await getSql().query(`UPDATE template_settings SET fields='{}'::jsonb, updated_at=NOW() WHERE id=$1`, [id]);
}

async function idTaken(id: string) {
  return isBuiltInTemplate(id) || Boolean(getPackagingTemplate(id)) || Boolean(await recordOf(id));
}

/** A named template: an active built-in style with its own id, name and defaults. Starts active. */
export async function createNamedTemplate(input: Record<string, unknown>) {
  const id = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  if (!NAMED_TEMPLATE_ID.test(id)) throw new TemplateAdminError('The slug must be 3 to 61 lowercase letters, digits and hyphens, starting with a letter.');
  if (await idTaken(id)) throw new TemplateAdminError(`"${id}" is already used by another template.`, 409);
  const baseId = typeof input.baseTemplateId === 'string' ? input.baseTemplateId : '';
  const catalog = resolveTemplateCatalog(await readTemplateSettings());
  const base = catalog.find(entry => entry.id === baseId && entry.source === 'built-in');
  if (!base) throw new TemplateAdminError('Choose a built-in box style.');
  if (!base.active) throw new TemplateAdminError('That style is inactive; choose an active one.');
  const fields = cleanTemplateFields(input, getPackagingTemplate(baseId)!, { requireName: true });
  await ensureV2Schema();
  await getSql().query(`
    INSERT INTO template_settings(id, source, base_template_id, active, fields) VALUES($1, 'named', $2, TRUE, $3::jsonb)
  `, [id, baseId, JSON.stringify(fields)]);
  return id;
}

/**
 * Checks an uploaded definition (json-templates.ts) and saves it as an
 * inactive draft. Returns its id and the flat dieline for the preview.
 */
export async function createJsonTemplate(source: string) {
  let preview;
  let definition;
  try {
    definition = parseJsonTemplate(source);
    if (await idTaken(definition.templateId)) throw new TemplateAdminError(`"${definition.templateId}" is already used by another template; change "templateId".`, 409);
    preview = checkJsonTemplateBuilds(definition);
  } catch (error) {
    if (error instanceof JsonTemplateError) throw new TemplateAdminError(error.message, 422);
    throw error;
  }
  await ensureV2Schema();
  await getSql().query(`
    INSERT INTO template_settings(id, source, active, definition) VALUES($1, 'json', FALSE, $2::jsonb)
  `, [definition.templateId, JSON.stringify(definition)]);
  return { id: definition.templateId, svg: preview.svg };
}

/**
 * Removes a named template no design uses. Built-in and JSON templates can
 * only be made inactive: a JSON template's id stays registered on servers and
 * browsers that loaded it, so it must never come back with another shape.
 */
export async function deleteTemplate(id: string) {
  const record = await recordOf(id);
  if (record?.source !== 'named') throw new TemplateAdminError('Only named templates can be deleted; make this one inactive instead.');
  const counts = await countDesignsByTemplate();
  if (counts.get(id)) throw new TemplateAdminError('Designs use this template, so it can only be made inactive.', 409);
  await ensureV2Schema();
  await getSql().query(`DELETE FROM template_settings WHERE id=$1 AND source='named'`, [id]);
}
