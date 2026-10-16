// Matching for the box template gallery's search box: every word typed must
// appear somewhere in the template's text (name, description, tags, size
// presets, section headings), ignoring case, accents and punctuation, and
// a plural matches its singular ("boxes" finds "box").

function normalize(text: string) {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function singular(word: string) {
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** The searchable text of one template, prepared once. */
export function templateSearchText(parts: (string | undefined)[]) {
  return ` ${normalize(parts.filter(Boolean).join(' '))} `;
}

/** True when every word of the query is in the template's text. An empty query matches everything. */
export function matchesTemplateSearch(query: string, searchText: string) {
  const words = normalize(query).split(' ').filter(Boolean);
  return words.every((word) => searchText.includes(word) || searchText.includes(singular(word)));
}
