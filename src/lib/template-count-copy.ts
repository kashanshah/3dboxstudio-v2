// Page copy states how many box styles the site offers ("16 styles"). It is
// written with the built-in count; withStyleCount rewrites it to the number
// active now (Admin → Templates), so a style an admin hides isn't counted.

/** The count the copy is written with: the built-in templates (scripts/admin-templates.test.cjs checks it). */
export const WRITTEN_STYLE_COUNT = 16;

const COUNT = /\b(?:16|[Ss]ixteen)(?=(?: box| common box)? (?:styles|templates|structures|estilos|plantillas)\b)/g;

/** `value` (a string, or any plain data holding strings) with the style count replaced by `count`. */
export function withStyleCount<T>(value: T, count: number): T {
  if (count === WRITTEN_STYLE_COUNT) return value;
  const map = (item: unknown): unknown => {
    if (typeof item === 'string') return item.replace(COUNT, String(count));
    if (Array.isArray(item)) return item.map(map);
    if (item && typeof item === 'object' && Object.getPrototypeOf(item) === Object.prototype) {
      return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, map(entry)]));
    }
    return item;
  };
  return map(value) as T;
}
