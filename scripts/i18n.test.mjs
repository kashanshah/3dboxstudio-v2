import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const cache = new Map();
function load(relative) {
  let file = path.resolve(root, relative);
  if (!fs.existsSync(file)) file += '.ts';
  if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.ts');
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const localRequire = specifier => specifier.startsWith('@/') ? load('src/' + specifier.slice(2)) : specifier.startsWith('.') ? load(path.resolve(path.dirname(file), specifier)) : require(specifier);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', js)(localRequire, exports);
  return exports;
}
const { resolveLocale, supportedLocales, localeDirection } = load('src/lib/i18n/config.ts');
const { translate, localizeContent, formatNumber, pluralCategory } = load('src/lib/i18n/index.ts');
const { PACKAGING_TEMPLATES } = load('src/lib/packaging/template-registry.ts');
const { getPackagingTemplateCopy } = load('src/lib/i18n/template-copy.ts');

test('only English is enabled, including stale and unsupported preferences', () => {
  assert.deepEqual(supportedLocales, ['en']);
  for (const input of [null, undefined, '', 'EN-ca', 'en_US', 'fr', 'zh-CN', 'ar', 'invalid']) assert.equal(resolveLocale(input), 'en');
  assert.equal(localeDirection('en'), 'ltr');
});
test('interpolation preserves Unicode and literal braces without evaluating replacements', () => {
  assert.equal(translate('account.named_account', { name: 'Zoë $& {name} <b>' }), 'Account: Zoë $& {name} <b>');
  assert.equal(translate('account.named_account'), 'Account: {name}');
  assert.equal(translate('account.named_account', Object.create({ name: 'Inherited' })), 'Account: {name}');
  assert.equal(formatNumber(1234.5), '1,234.5');
  assert.equal(pluralCategory(1), 'one');
  assert.equal(pluralCategory(2), 'other');
});
test('content localization falls back per field without mutating the source', () => {
  const original = { title: 'English title', description: 'Original description' };
  assert.deepEqual(localizeContent(original, { en: { title: 'Reviewed title', description: undefined } }, 'en'), { title: 'Reviewed title', description: 'Original description' });
  assert.equal(original.title, 'English title');
});
test('template presentation preserves English display copy and all geometry identifiers', () => {
  const before = JSON.stringify(PACKAGING_TEMPLATES);
  for (const template of PACKAGING_TEMPLATES) {
    const copy = getPackagingTemplateCopy(template);
    for (const field of ['name', 'shortName', 'category', 'description']) assert.equal(copy[field], template[field]);
    const marked = getPackagingTemplateCopy(template, key => 'translated:' + key);
    assert.match(marked.name, /^translated:/);
    assert.equal('id' in marked, false);
  }
  assert.equal(JSON.stringify(PACKAGING_TEMPLATES), before);
});
test('sitemap advertises actual translated content and excludes redirecting Studio locale URLs', async () => {
  const xml = await load('src/app/sitemap.xml/route.ts').GET().text();
  assert.ok(xml.includes('hreflang="fr"'));
  assert.ok(xml.includes('/fr/blog/how-to-create-3d-product-box-mockup-online'));
  assert.doesNotMatch(xml, /\/(fr|es|de|zh)\/studio/);
  for (const file of ['src/app/studio/page.tsx', 'src/app/studio/editor/page.tsx', 'src/app/[locale]/studio/page.tsx']) assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /languages:/);
});
