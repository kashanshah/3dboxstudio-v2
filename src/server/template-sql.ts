// SQL for Admin → Templates: its table, and which template a design uses,
// shared by the admin designs list and the design counts. Aliases: p for
// projects, lr for legacy_records.

/** The template a legacy design opens as (legacy-design-converter.ts). */
export const LEGACY_TEMPLATE_ID = `CASE WHEN lr.payload->'config'->>'opening' ILIKE '%split%' THEN 'split-top-box' ELSE 'base-box' END`;

/** A design's catalog entry: its named template, else its template (matches idx_projects_catalog_template). */
export const NATIVE_CATALOG_ID = `COALESCE(p.studio_state->>'presetId', p.studio_state->>'templateId')`;

/**
 * Admin → Templates (src/server/templates.ts), applied by ensureV2Schema: a
 * built-in template's row exists only once an admin changes it; named and
 * JSON templates always have one. `fields` holds the display fields,
 * `definition` a JSON template's parametric definition.
 */
export const TEMPLATE_SETTINGS_SCHEMA = [
  `
    CREATE TABLE IF NOT EXISTS template_settings (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL CHECK (source IN ('built-in','named','json')),
      base_template_id TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      fields JSONB NOT NULL DEFAULT '{}'::jsonb,
      definition JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  // Designs per template: a design made from a named template records it as presetId.
  `CREATE INDEX IF NOT EXISTS idx_projects_catalog_template ON projects ((COALESCE(studio_state->>'presetId', studio_state->>'templateId')))`,
];
