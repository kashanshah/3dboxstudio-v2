import type { ExpandedTemplate, ParametricTemplate, Repeat, RepeatEntry, Repeatable } from './format';

// `repeat` blocks let a definition stay plain data without copy-pasting four
// near-identical walls: any list in a definition may hold
//
//   { repeat: [{ wall: 'front', x: 'xFront' }, …], each: [ …items… ] }
//
// which expands to `each` once per entry, in order, with every `{{key}}` in
// the items' strings replaced by that entry's value. A string that is only
// `{{key}}` takes the value itself, so numbers stay numbers and objects stay
// objects; as a property's whole value, null leaves the property out.
// Expansion runs before anything else reads the definition.

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

function isRepeat(item: unknown): item is Repeat<unknown> {
  return typeof item === 'object' && item !== null && !Array.isArray(item) && 'repeat' in item && 'each' in item;
}

function substitute(value: unknown, entry: RepeatEntry, fail: (message: string) => never, lenient = false): unknown {
  // Inside a nested repeat block, placeholders this entry doesn't know are the
  // inner block's to fill; its own expansion is strict, so none slip through.
  const missing = (key: string, original: string) => (lenient ? original : fail(`"{{${key}}}" has no value in its repeat entry`));
  if (typeof value === 'string') {
    const whole = /^\{\{(\w+)\}\}$/.exec(value);
    if (whole) return whole[1] in entry ? entry[whole[1]] : missing(whole[1], value);
    return value.replace(PLACEHOLDER, (original, key: string) => (key in entry ? String(entry[key]) : missing(key, original)));
  }
  if (Array.isArray(value)) return value.map(item => substitute(item, entry, fail, lenient));
  if (typeof value === 'object' && value !== null) {
    if (isRepeat(value)) {
      return { repeat: substitute(value.repeat, entry, fail, lenient), each: substitute(value.each, entry, fail, true) };
    }
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
      const result = substitute(item, entry, fail, lenient);
      // `"key": "{{x}}"` with x null leaves the property out for that entry.
      return result === null && typeof item === 'string' ? [] : [[key, result]];
    }));
  }
  return value;
}

function expandList<T>(list: Repeatable<T> | undefined, fail: (message: string) => never): T[] | undefined {
  if (!list) return list;
  return list.flatMap(item => {
    if (!isRepeat(item)) return [item as T];
    if (!Array.isArray(item.repeat) || !Array.isArray(item.each)) fail('a repeat block needs a "repeat" list of entries and an "each" list of items');
    // Repeats may nest: expand the inner lists for each entry too.
    return item.repeat.flatMap(entry => expandList(substitute(item.each, entry, fail) as Repeatable<T>, fail)!);
  });
}

/** Every list in the definition with its `repeat` blocks expanded. */
export function expandRepeats(definition: ParametricTemplate, fail: (message: string) => never): ExpandedTemplate {
  const d = definition as unknown as Record<string, unknown> & { fold: Record<string, unknown> };
  function list<T>(value: unknown) {
    return expandList(value as Repeatable<T> | undefined, fail);
  }
  return {
    ...definition,
    derived: list(d.derived)!,
    panels: list(d.panels)!,
    slits: list(d.slits),
    cuts: list(d.cuts),
    validations: list(d.validations),
    notes: list(d.notes)!,
    fold: { ...definition.fold, hinges: list(d.fold.hinges)!, motions: list(d.fold.motions) },
  } as ExpandedTemplate;
}
