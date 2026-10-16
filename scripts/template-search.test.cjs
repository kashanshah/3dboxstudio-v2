/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { matchesTemplateSearch, templateSearchText } = require('../src/lib/template-search.ts');
const { BOX_TEMPLATE_PAGES } = require('../src/content/box-template-pages.ts');

const textOf = (page) => templateSearchText([page.name, page.h1, page.description, ...page.tags, ...page.presets.flatMap((preset) => [preset.label, preset.note]), ...page.sections.map((section) => section.title), page.geometryNote]);
const find = (query) => BOX_TEMPLATE_PAGES.filter((page) => matchesTemplateSearch(query, textOf(page))).map((page) => page.slug);

test('every word must match, ignoring case, accents and punctuation', () => {
  const text = templateSearchText(['Reverse tuck end box', 'Perfume 50 ml']);
  assert.equal(matchesTemplateSearch('REVERSE tuck', text), true);
  assert.equal(matchesTemplateSearch('parfüm', text), false);
  assert.equal(matchesTemplateSearch('perfume, 50ml', text), false);
  assert.equal(matchesTemplateSearch('perfume 50', text), true);
  assert.equal(matchesTemplateSearch('reverse pizza', text), false);
  assert.equal(matchesTemplateSearch('  ', text), true);
});

test('plurals find the singular', () => {
  const text = templateSearchText(['Mailer box', 'shipping carton']);
  assert.equal(matchesTemplateSearch('boxes', text), true);
  assert.equal(matchesTemplateSearch('cartons', text), true);
  assert.equal(matchesTemplateSearch('mailers', text), true);
});

test('real searches find the right templates', () => {
  assert.ok(find('pizza').includes('pizza-box'));
  assert.ok(find('mailer').some((slug) => slug.includes('mailer')));
  assert.ok(find('reverse tuck').includes('reverse-tuck-end-box'));
  assert.ok(find('perfume').includes('reverse-tuck-end-box'), 'size presets are searchable');
  assert.deepEqual(find('xyzzy nothing'), []);
  assert.equal(find('').length, BOX_TEMPLATE_PAGES.length);
});
