import { compileParametricTemplate } from './parametric/compile';
import { compileParametricSheet, DIMENSIONS, type OptionValues } from './parametric/sheet';
import { PARAMETRIC_TEMPLATE_FORMAT, type DimensionKey, type ExpandedTemplate, type ParametricTemplate, type TemplateCatalog } from './parametric/format';
import { panelRegions } from './parametric/definitions/artwork-regions';
import { panelName } from './templates/folded-box';
import { dielineSvg } from './dieline-vector';
import { getPackagingTemplate, isBuiltInTemplate, registerPackagingTemplate, STUDIO_MATERIALS, type PackagingTemplateDefinition } from './template-registry';
import { getTemplateRuntime, registerTemplateRuntime } from './template-runtime';
import type { LegacyOpeningMode } from '@/lib/studio-project';

// Templates an admin uploads as a parametric definition in JSON (the format
// of parametric/definitions/*, see docs/parametric-templates.md). They are
// data: the only thing in them that is evaluated is the arithmetic language
// of parametric/expression.ts, which reaches nothing but its own scope. The
// limits below keep one definition from tying up a server or a browser.

export const JSON_TEMPLATE_LIMITS = {
  bytes: 200_000,
  /** Values in the definition after its repeat blocks are expanded. */
  nodes: 60_000,
  depth: 40,
  panels: 200,
  hinges: 300,
  derived: 500,
  modelPanels: 400,
  surfacePoints: 2_000,
  lines: 300,
  validations: 60,
  notes: 30,
  variants: 24,
  expressionLength: 400,
  arcSegments: 64,
  /** Wall time for the server's checks of one upload. */
  checkMs: 8_000,
} as const;

export const JSON_TEMPLATE_ID = /^[a-z][a-z0-9-]{2,60}$/;

export class JsonTemplateError extends Error {}

const fail = (message: string): never => { throw new JsonTemplateError(message); };

/** Repeat blocks multiply; the size a definition expands to, counted without expanding it. */
function expandedSize(value: unknown, depth = 0): number {
  if (depth > JSON_TEMPLATE_LIMITS.depth) fail(`The definition is nested more than ${JSON_TEMPLATE_LIMITS.depth} levels deep.`);
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + expandedSize(item, depth + 1), 1);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.repeat) && 'each' in record) {
      return record.repeat.length * expandedSize(record.each, depth + 1) + expandedSize(record.repeat, depth + 1);
    }
    return Object.values(record).reduce<number>((sum, item) => sum + expandedSize(item, depth + 1), 1);
  }
  return 1;
}

function checkExpanded(definition: ExpandedTemplate) {
  const limits = JSON_TEMPLATE_LIMITS;
  const count = (label: string, length: number, max: number) => { if (length > max) fail(`The definition has ${length} ${label}; the limit is ${max}.`); };
  count('panels', definition.panels.length, limits.panels);
  count('hinges', definition.fold.hinges.length, limits.hinges);
  count('derived values', definition.derived.length + (definition.fold.motions?.length ?? 0), limits.derived);
  count('model panels', definition.fold.modelPanels?.length ?? 0, limits.modelPanels);
  count('surface points', (definition.fold.surfaces ?? []).reduce((sum, surface) => sum + surface.rows.flat().length, 0), limits.surfacePoints);
  count('cut and slit lines', (definition.cuts?.length ?? 0) + (definition.slits?.length ?? 0), limits.lines);
  count('size checks', definition.validations?.length ?? 0, limits.validations);
  count('notes', definition.notes.length, limits.notes);
  const variants = (definition.options ?? []).reduce((product, option) => product * Math.max(1, Object.keys(option.choices ?? {}).length), 1);
  count('option combinations', variants, limits.variants);
  // Every string is either an expression, a label or a note; none may be long enough to parse slowly.
  const walk = (value: unknown, key: string) => {
    if (typeof value === 'string') {
      if (value.length > limits.expressionLength && key !== 'description' && key !== 'text' && key !== 'message') {
        fail(`A value is ${value.length} characters long; expressions are limited to ${limits.expressionLength}.`);
      }
      if (value.length > 2_000) fail('A text in the definition is over 2,000 characters long.');
    } else if (Array.isArray(value)) value.forEach(item => walk(item, key));
    else if (value && typeof value === 'object') {
      for (const [name, item] of Object.entries(value)) {
        if (name === 'segments' && (typeof item !== 'number' || !Number.isInteger(item) || item < 1 || item > limits.arcSegments)) {
          fail(`Arc segments must be a whole number from 1 to ${limits.arcSegments}.`);
        }
        walk(item, name);
      }
    }
  };
  walk(definition, '');
}

/**
 * Parses an uploaded definition and checks its shape and size, without
 * evaluating anything. Throws JsonTemplateError with a message for people.
 */
export function parseJsonTemplate(source: string): ParametricTemplate {
  if (new TextEncoder().encode(source).length > JSON_TEMPLATE_LIMITS.bytes) fail(`The definition is over ${JSON_TEMPLATE_LIMITS.bytes / 1000} kB.`);
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    fail(`This isn't valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return checkJsonTemplate(value);
}

/** The shape and size checks of parseJsonTemplate, for a definition already parsed (one read back from the database). */
export function checkJsonTemplate(value: unknown): ParametricTemplate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('The definition must be a JSON object.');
  const definition = value as ParametricTemplate;
  if (definition.format !== PARAMETRIC_TEMPLATE_FORMAT) fail(`"format" must be "${PARAMETRIC_TEMPLATE_FORMAT}".`);
  if (typeof definition.templateId !== 'string' || !JSON_TEMPLATE_ID.test(definition.templateId)) {
    fail('"templateId" must be 3 to 61 lowercase letters, digits and hyphens, starting with a letter.');
  }
  for (const key of ['structureKey', 'rendererKey'] as const) {
    if (typeof definition[key] !== 'string' || !definition[key] || definition[key].length > 80) fail(`"${key}" must be a short string.`);
  }
  for (const key of ['panels', 'derived', 'notes'] as const) if (!Array.isArray(definition[key])) fail(`"${key}" must be a list.`);
  if (!definition.fold || typeof definition.fold !== 'object' || !Array.isArray(definition.fold.hinges)) fail('"fold" must have a list of "hinges".');
  if (!definition.assembly || typeof definition.assembly !== 'object') fail('"assembly" is missing.');
  if (!definition.export || typeof definition.export !== 'object') fail('"export" is missing.');
  if (!definition.parameters || typeof definition.parameters !== 'object') fail('"parameters" is missing.');
  for (const key of DIMENSIONS) {
    const spec = definition.parameters[key];
    if (!spec || !Number.isFinite(spec.fallback) || spec.fallback <= 0) fail(`Parameter "${key}" needs a "fallback" above zero.`);
    for (const bound of ['min', 'max'] as const) if (spec[bound] !== undefined && !Number.isFinite(spec[bound])) fail(`Parameter "${key}" has a "${bound}" that isn't a number.`);
  }
  const size = expandedSize(definition);
  if (size > JSON_TEMPLATE_LIMITS.nodes) fail(`The definition expands to ${size.toLocaleString('en-US')} values; the limit is ${JSON_TEMPLATE_LIMITS.nodes.toLocaleString('en-US')}.`);
  if (definition.catalog !== undefined) checkCatalog(definition.catalog);
  return definition;
}

const FAMILIES = ['folding-carton', 'corrugated', 'rigid-box', 'bottle', 'jar', 'can', 'tube', 'pouch', 'cup', 'other'];
const CAPABILITIES = ['dieline', '3d', 'fold', 'interior-artwork', 'full-dieline-artwork', 'production-export'];
const OPENING_MODES = ['closed', 'lid_from_back', 'lid_from_front', 'lid_from_left', 'lid_from_right', 'top_split_meet_center', 'door_left', 'door_right', 'double_doors'];

/** The catalog entry reaches the Studio's UI as is, so every field it gives must have the shape the UI reads. */
function checkCatalog(catalog: unknown) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) fail('"catalog" must be an object.');
  const entry = catalog as Partial<TemplateCatalog>;
  const isText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
  const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  const text = (key: keyof TemplateCatalog, max: number) => {
    if (entry[key] !== undefined && !isText(entry[key], max)) fail(`catalog.${key} must be text of at most ${max} characters.`);
  };
  text('name', 80); text('shortName', 40); text('category', 40); text('description', 600);
  if (entry.version !== undefined && !isNumber(entry.version)) fail('catalog.version must be a number.');
  if (entry.thumbnail !== undefined) fail('catalog.thumbnail is set from the admin; leave it out of the definition.');
  if (entry.isDefault !== undefined) fail('catalog.isDefault is for built-in templates only.');
  if (entry.family !== undefined && !FAMILIES.includes(entry.family)) fail(`catalog.family must be one of ${FAMILIES.join(', ')}.`);
  if (entry.defaultMaterial !== undefined && !STUDIO_MATERIALS.includes(entry.defaultMaterial)) fail(`catalog.defaultMaterial must be one of ${STUDIO_MATERIALS.join(', ')}.`);
  if (entry.fixedOpeningMode !== undefined && !OPENING_MODES.includes(entry.fixedOpeningMode)) fail(`catalog.fixedOpeningMode must be one of ${OPENING_MODES.join(', ')}.`);
  if (entry.tags !== undefined && (!Array.isArray(entry.tags) || entry.tags.length > 20 || !entry.tags.every(tag => isText(tag, 40)))) fail('catalog.tags must be up to 20 short strings.');
  if (entry.capabilities !== undefined && (!Array.isArray(entry.capabilities) || !entry.capabilities.every(item => CAPABILITIES.includes(item)))) {
    fail(`catalog.capabilities may hold ${CAPABILITIES.join(', ')}.`);
  }
  if (entry.parameters !== undefined && (!Array.isArray(entry.parameters) || entry.parameters.length > 8 || !entry.parameters.every(parameter =>
    parameter && (DIMENSIONS as string[]).includes(parameter.key) && isText(parameter.label, 40) && isNumber(parameter.defaultValue)
    && (['min', 'max', 'step'] as const).every(key => parameter[key] === undefined || isNumber(parameter[key]))
    && (parameter.unit === undefined || ['mm', 'in', '%'].includes(parameter.unit))
    && (parameter.measuredAlong === undefined || parameter.measuredAlong === null || ['x', 'y', 'z'].includes(parameter.measuredAlong))))) {
    fail('catalog.parameters must be size controls: { key: width, height, depth or thickness, label, defaultValue, min?, max?, step? }.');
  }
  if (entry.artworkRegions !== undefined && (!Array.isArray(entry.artworkRegions) || entry.artworkRegions.length > 400 || !entry.artworkRegions.every(region =>
    region && isText(region.id, 80) && isText(region.label, 80) && isText(region.panelId, 80) && (region.surface === 'outside' || region.surface === 'inside')))) {
    fail('catalog.artworkRegions must be up to 400 regions: { id, label, surface: outside or inside, panelId }.');
  }
  if (entry.defaultDimensions !== undefined && !(entry.defaultDimensions && DIMENSIONS.every(key => isNumber(entry.defaultDimensions![key]) && entry.defaultDimensions![key] > 0))) {
    fail('catalog.defaultDimensions needs width, height, depth and thickness above zero.');
  }
  if (entry.foldStages !== undefined) fail('catalog.foldStages is not supported for uploaded templates.');
}

const titleCase = (id: string) => id.replace(/-/g, ' ').replace(/^\w/, char => char.toUpperCase());

/** The registry record for an uploaded definition, with sensible defaults for whatever its catalog entry leaves out. */
export function jsonTemplateRecord(definition: ParametricTemplate, expanded: ExpandedTemplate = compileParametricSheet(definition).definition): PackagingTemplateDefinition {
  const catalog: Partial<TemplateCatalog> = definition.catalog ?? {};
  const fallback = Object.fromEntries(DIMENSIONS.map(key => [key, definition.parameters[key].fallback])) as Record<DimensionKey, number>;
  const name = catalog.name ?? titleCase(definition.templateId);
  const labels: Record<DimensionKey, string> = { width: 'Width', height: 'Height', depth: 'Depth', thickness: 'Board thickness' };
  const printed = Array.from(new Set(expanded.panels.filter(panel => panel.kind !== 'glue').map(panel => panel.name ?? panelName(panel.label))));
  return {
    version: catalog.version ?? 1,
    name,
    shortName: catalog.shortName ?? name,
    family: catalog.family ?? 'folding-carton',
    category: catalog.category ?? 'Custom',
    description: catalog.description ?? definition.description ?? '',
    tags: catalog.tags ?? [],
    capabilities: catalog.capabilities ?? ['dieline', '3d', 'fold', 'interior-artwork'],
    parameters: catalog.parameters ?? DIMENSIONS.map(key => ({
      key, label: labels[key], unit: 'mm' as const, step: key === 'thickness' ? 0.1 : 1,
      min: definition.parameters[key].min, max: definition.parameters[key].max, defaultValue: fallback[key],
    })),
    artworkRegions: catalog.artworkRegions ?? panelRegions(printed),
    ...(catalog.foldStages ? { foldStages: catalog.foldStages } : {}),
    defaultDimensions: catalog.defaultDimensions ?? fallback,
    defaultMaterial: catalog.defaultMaterial ?? 'White board',
    ...(catalog.fixedOpeningMode ? { fixedOpeningMode: catalog.fixedOpeningMode } : {}),
    id: definition.templateId,
    rendererKey: definition.rendererKey,
    structureKey: definition.structureKey,
    status: 'ready',
  };
}

export type JsonTemplatePreview = { svg: string; record: PackagingTemplateDefinition; problems: string[] };

/**
 * Everything the server checks before an uploaded definition is saved: it
 * compiles, its size checks run, the sheet builds, the box folds at
 * formation 0, 50 and 100 in every variant at its default size, and the
 * cutting template exports as SVG. Returns the flat SVG for the admin's
 * preview; throws JsonTemplateError naming what failed.
 */
export function checkJsonTemplateBuilds(definition: ParametricTemplate): JsonTemplatePreview {
  const started = Date.now();
  const step = <T,>(what: string, run: () => T): T => {
    if (Date.now() - started > JSON_TEMPLATE_LIMITS.checkMs) fail('The definition takes too long to build.');
    try {
      return run();
    } catch (error) {
      if (error instanceof JsonTemplateError) throw error;
      // The compiler names the template; the admin knows which one they uploaded.
      const message = (error instanceof Error ? error.message : String(error)).replace(/^Template [\w-]+: /, '');
      return fail(`${what}: ${message}`);
    }
  };
  if (isBuiltInTemplate(definition.templateId)) fail(`"${definition.templateId}" is a built-in template's id; choose another.`);
  const sheet = step('It does not compile', () => compileParametricSheet(definition));
  checkExpanded(sheet.definition);
  const runtime = step('It does not compile', () => compileParametricTemplate(definition));
  const record = step('Its catalog entry is incomplete', () => jsonTemplateRecord(definition, sheet.definition));
  const dimensions = runtime.sanitizeParameters(record.defaultDimensions!);
  const variants = (sheet.definition.options ?? []).reduce<OptionValues[]>(
    (all, option) => all.flatMap(partial => Object.keys(option.choices).map(choice => ({ ...partial, [option.source]: choice }))),
    [{}],
  );
  let problems: string[] = [];
  let svg = '';
  for (const options of variants) {
    const where = Object.keys(options).length ? ` (${Object.entries(options).map(([key, value]) => `${key} ${value}`).join(', ')})` : '';
    const geometry = { openingMode: options.openingMode as LegacyOpeningMode | undefined, splitTopHingeSide: options.splitTopHingeSide as 'side_a' | 'side_b' | undefined };
    const found = step(`Its size checks fail to run${where}`, () => runtime.getSizeProblems!(dimensions, geometry));
    if (!svg) problems = found;
    const flat = step(`The sheet doesn't build${where}`, () => runtime.getSheetGeometry!(dimensions, geometry));
    if (!flat.panels.length) fail(`The sheet has no panels${where}.`);
    for (const formation of [0, 50, 100]) {
      step(`It doesn't fold at formation ${formation}${where}`, () => {
        const meshes = runtime.buildMeshes({
          dimensions, formation, opening: 0,
          openingMode: (geometry.openingMode ?? runtime.assembly.defaultOpeningMode),
          splitTopHingeSide: geometry.splitTopHingeSide ?? 'side_a',
          color: [1, 1, 1], interiorColor: [1, 1, 1],
        });
        if (!meshes.length) throw new Error('the fold builds no meshes');
      });
    }
    const exported = step(`It doesn't export as SVG${where}`, () => dielineSvg(flat, record.name));
    svg ||= exported;
  }
  if (problems.length) fail(`At its default size the box fails its own size check: ${problems[0]}`);
  return { svg, record, problems };
}

const registered = new Map<string, string>();

/**
 * Makes an uploaded template available to every lookup by id (the Studio,
 * generator, share viewer, exports, admin). Safe to call again with the same
 * definitions: each id registers once, and definitions are never changed
 * after upload. A definition that no longer compiles is skipped, so one bad
 * row can't take the site down; designs using it degrade like an unknown id.
 */
export function registerJsonTemplates(definitions: Iterable<ParametricTemplate>) {
  for (const definition of definitions) {
    const id = definition?.templateId;
    if (typeof id !== 'string' || registered.has(id)) continue;
    if (getPackagingTemplate(id) || getTemplateRuntime(id)) {
      registered.set(id, '');
      continue;
    }
    try {
      checkJsonTemplate(definition);
      const sheet = compileParametricSheet(definition);
      checkExpanded(sheet.definition);
      const runtime = compileParametricTemplate(definition);
      registerPackagingTemplate(jsonTemplateRecord(definition, sheet.definition));
      registerTemplateRuntime(runtime);
      registered.set(id, definition.templateId);
    } catch (error) {
      registered.set(id, '');
      console.error(`Uploaded template ${id} could not be registered`, error);
    }
  }
}
