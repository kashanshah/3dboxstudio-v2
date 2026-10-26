import { unstable_cache } from 'next/cache';
import { ensureV2Schema, getSql } from '@/server/db';
import { activeStyleCount, resolveTemplateCatalog, type TemplateCatalogEntry, type TemplateSettingsRecord, type TemplateSource } from '@/lib/packaging/template-catalog';
import type { ParametricTemplate } from '@/lib/packaging/parametric/format';
import { registerJsonTemplates } from '@/lib/packaging/json-templates';
import { LEGACY_TEMPLATE_ID, NATIVE_CATALOG_ID } from '@/server/template-sql';

// Template settings from Admin → Templates, for every page and route that
// lists templates or opens a design. Public pages are prerendered, so the
// settings are read through Next's data cache under TEMPLATES_TAG; the
// admin routes revalidate that tag (and the listing pages) on every change.

export const TEMPLATES_TAG = 'template-settings';

type Row = {
  id: string;
  source: TemplateSource;
  base_template_id: string | null;
  active: boolean;
  fields: TemplateSettingsRecord['fields'] | null;
  definition: ParametricTemplate | null;
  updated_at: string | Date | null;
};

const iso = (value: string | Date | null) => (value ? new Date(value).toISOString() : null);

/** Every settings row, straight from the database, oldest first (the order added templates are listed in). */
export async function readTemplateSettings(): Promise<TemplateSettingsRecord[]> {
  await ensureV2Schema();
  const rows = await getSql().query('SELECT id, source, base_template_id, active, fields, definition, updated_at FROM template_settings ORDER BY created_at, id') as Row[];
  return rows.map(row => ({
    id: row.id,
    source: row.source,
    active: row.active,
    baseTemplateId: row.base_template_id,
    fields: row.fields ?? {},
    definition: row.definition,
    updatedAt: iso(row.updated_at),
  }));
}

const cachedSettings = unstable_cache(readTemplateSettings, ['template-settings-v1'], { tags: [TEMPLATES_TAG], revalidate: 3600 });

/**
 * The settings, cached. Without a database (a build with no DATABASE_URL)
 * or outside Next (the unit tests) it falls back to reading directly, and
 * then to none: every built-in template active and unchanged.
 */
export async function getTemplateSettings(): Promise<TemplateSettingsRecord[]> {
  let records: TemplateSettingsRecord[];
  try {
    records = await cachedSettings();
  } catch {
    try {
      records = process.env.DATABASE_URL || process.env.NEON_FETCH_ENDPOINT ? await readTemplateSettings() : [];
    } catch (error) {
      console.error('Template settings could not be read; showing the built-in catalog', error);
      records = [];
    }
  }
  registerJsonTemplates(records.flatMap(record => record.source === 'json' && record.definition ? [record.definition] : []));
  return records;
}

/** The resolved catalog: every template, active or not, in card order. */
export async function getTemplateCatalog(): Promise<TemplateCatalogEntry[]> {
  return resolveTemplateCatalog(await getTemplateSettings());
}

/**
 * Registers uploaded templates on this server before a design is checked or
 * opened (validProjectState looks templates up by id).
 */
export async function ensureTemplatesRegistered(): Promise<void> {
  await getTemplateSettings();
}

/** Designs per catalog entry: a named template's id, or the template id; legacy designs as the template they open as. */
export async function countDesignsByTemplate(): Promise<Map<string, number>> {
  await ensureV2Schema();
  const rows = await getSql().query(`
    SELECT key, SUM(n)::int AS n FROM (
      SELECT ${NATIVE_CATALOG_ID} AS key, COUNT(*) AS n
      FROM projects p GROUP BY 1
      UNION ALL
      SELECT ${LEGACY_TEMPLATE_ID}, COUNT(*)
      FROM legacy_records lr WHERE lr.entity_type='shared_designs' AND lr.deleted_at IS NULL GROUP BY 1
    ) counts WHERE key IS NOT NULL GROUP BY key
  `) as { key: string; n: number }[];
  return new Map(rows.map(row => [row.key, Number(row.n)]));
}

/**
 * After a change in Admin → Templates: the cached settings, and every
 * prerendered page, since templates are listed and counted across the
 * marketing pages (galleries, the generator, comparison pages, sitemap,
 * llms.txt). Changes are rare, and each page regenerates on its next visit.
 */
export async function revalidateTemplatePages() {
  const { revalidatePath, revalidateTag } = await import('next/cache');
  revalidateTag(TEMPLATES_TAG, { expire: 0 });
  revalidatePath('/', 'layout');
}

/** An uploaded template's definition, for a page that opens a design drawn by it in the browser (share viewer). */
export async function jsonDefinitionFor(templateId: string | undefined): Promise<ParametricTemplate | null> {
  if (!templateId) return null;
  const record = (await getTemplateSettings()).find(item => item.source === 'json' && item.id === templateId);
  return record?.definition ?? null;
}

/** How many box styles are active, for page copy (template-count-copy.ts). */
export async function activeStyleCountNow(): Promise<number> {
  return activeStyleCount(await getTemplateCatalog());
}
