import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';

type EditorParams = { project?: string; template?: string; workspace?: string; w?: string; h?: string; d?: string; t?: string; a?: string; unit?: string };

const ENTRY_KEYS = ['project', 'template', 'workspace', 'w', 'h', 'd', 't', 'a', 'unit'] as const;
const MAX_MM = 3000;

/** `/studio/editor?…` with only the parameters the editor understands, for the post-login redirect. */
export function editorReturnPath(params: EditorParams) {
  const query = new URLSearchParams();
  for (const key of ENTRY_KEYS) {
    const value = params[key];
    if (typeof value === 'string' && value && value.length <= 120) query.set(key, value);
  }
  const search = query.toString();
  return `/studio/editor${search ? `?${search}` : ''}`;
}

/**
 * Finished size from `w`, `h`, `d` (millimetres), board thickness from `t`
 * and flap sizes from `a` ("glue:12;tuck:20", millimetres); falls back per
 * field to the template default. The template's own limits apply later.
 */
export function requestedDimensions(params: EditorParams, fallback: CartonDimensions): CartonDimensions | undefined {
  if (params.w == null && params.h == null && params.d == null) return undefined;
  const read = (value: string | undefined, current: number, max = MAX_MM, digits = 10) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 && (max !== MAX_MM || number >= 1) && number <= max ? Math.round(number * digits) / digits : current;
  };
  const adjustments: Record<string, number> = {};
  for (const entry of (params.a ?? '').split(';').slice(0, 20)) {
    const [key, value] = entry.split(':');
    const number = Number(value);
    if (/^[A-Za-z]{1,40}$/.test(key ?? '') && Number.isFinite(number) && number >= 0 && number <= MAX_MM) adjustments[key] = Math.round(number * 10) / 10;
  }
  return {
    ...fallback,
    width: read(params.w, fallback.width), height: read(params.h, fallback.height), depth: read(params.d, fallback.depth),
    thickness: read(params.t, fallback.thickness, 10, 100),
    ...(Object.keys(adjustments).length ? { adjustments } : {}),
  };
}

/** Link that opens a new design in the editor with a template and size (and optionally board and flap sizes) already set. */
export function studioTemplateHref(templateId: string, dimensions: Pick<CartonDimensions, 'width' | 'height' | 'depth'> & Partial<Pick<CartonDimensions, 'thickness' | 'adjustments'>>, unit: 'mm' | 'in') {
  const round = (value: number) => String(Math.round(value * 10) / 10);
  const query = new URLSearchParams({ template: templateId, w: round(dimensions.width), h: round(dimensions.height), d: round(dimensions.depth) });
  if (dimensions.thickness) query.set('t', String(Math.round(dimensions.thickness * 100) / 100));
  const adjustments = Object.entries(dimensions.adjustments ?? {}).map(([key, value]) => `${key}:${round(value)}`);
  if (adjustments.length) query.set('a', adjustments.join(';'));
  query.set('unit', unit);
  return `/studio/editor?${query}`;
}
