import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';

type EditorParams = { project?: string; template?: string; workspace?: string; w?: string; h?: string; d?: string; unit?: string };

const ENTRY_KEYS = ['project', 'template', 'workspace', 'w', 'h', 'd', 'unit'] as const;
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

/** Finished size from `w`, `h`, `d` (millimetres); falls back per field to the template default. */
export function requestedDimensions(params: EditorParams, fallback: CartonDimensions): CartonDimensions | undefined {
  if (params.w == null && params.h == null && params.d == null) return undefined;
  const read = (value: string | undefined, current: number) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 1 && number <= MAX_MM ? Math.round(number * 10) / 10 : current;
  };
  return { ...fallback, width: read(params.w, fallback.width), height: read(params.h, fallback.height), depth: read(params.d, fallback.depth) };
}

/** Link that opens a new design in the editor with a template and size already set. */
export function studioTemplateHref(templateId: string, dimensions: Pick<CartonDimensions, 'width' | 'height' | 'depth'>, unit: 'mm' | 'in') {
  const round = (value: number) => String(Math.round(value * 10) / 10);
  return `/studio/editor?${new URLSearchParams({ template: templateId, w: round(dimensions.width), h: round(dimensions.height), d: round(dimensions.depth), unit })}`;
}
