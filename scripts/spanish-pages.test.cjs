/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { ES_BOX_TEMPLATE_PAGES, getEsBoxTemplatePage, templateLanguageAlternates } = require('../src/content/es/box-template-pages.ts');
const { GENERATOR_COPY } = require('../src/components/dieline-generator/copy.ts');
const { MATERIALS } = require('../src/lib/dieline/state.ts');

test('every Spanish template page has its English page and the same presets', () => {
  assert.ok(ES_BOX_TEMPLATE_PAGES.length >= 5);
  for (const page of ES_BOX_TEMPLATE_PAGES) {
    const both = getEsBoxTemplatePage(page.slug);
    assert.ok(both, page.slug);
    assert.equal(page.presets.length, both.en.presets.length, `${page.slug}: one Spanish label per preset`);
    assert.ok(page.faqs.length >= 4 && page.sections.length >= 4, page.slug);
    assert.ok(page.title.length <= 75, `${page.slug}: title ${page.title.length} characters`);
    assert.ok(page.description.length <= 220, `${page.slug}: description ${page.description.length} characters`);
    assert.deepEqual(templateLanguageAlternates(page.slug), { en: `/box-templates/${page.slug}`, es: `/es/box-templates/${page.slug}`, 'x-default': `/box-templates/${page.slug}` });
    // Links in the text go to pages that exist.
    for (const text of [...page.sections.flatMap(section => [section.body, ...(section.bullets ?? [])]), ...page.faqs.map(faq => faq.answer)]) {
      for (const [, href] of text.matchAll(/\]\((\/[^)]+)\)/g)) assert.match(href, /^\/(box-templates|blog|es)\//, `${page.slug}: ${href}`);
    }
  }
});

test('the Spanish generator copy covers every key, style and material', async () => {
  const { DIELINE_STYLES } = require('../src/lib/dieline/styles.ts');
  const { en, es } = GENERATOR_COPY;
  const keys = value => Object.keys(value).sort();
  assert.deepEqual(keys(es.modes), keys(en.modes));
  assert.deepEqual(keys(es.fields), keys(en.fields));
  assert.deepEqual(keys(es.exports), keys(en.exports));
  for (const style of DIELINE_STYLES) assert.ok(es.styleNames[style.id], `Spanish name for ${style.id}`);
  for (const material of MATERIALS) assert.ok(es.materials[material.id], `Spanish name for ${material.id}`);
  assert.equal(new Set(Object.values(es.fields).map(field => field.letter)).size, 3, 'distinct field letters');
  assert.equal(es.enterAbove('Largo'), 'Introduce un largo mayor que cero.');
});
