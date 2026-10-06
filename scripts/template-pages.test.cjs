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
const { BOX_TEMPLATE_PAGES } = require('../src/content/box-template-pages.ts');
const { templatePreviewGeometry } = require('../src/lib/packaging/template-preview.ts');
const { getTemplateExportGeometry } = require('../src/lib/packaging/template-runtime.ts');
const { getPackagingTemplate } = require('../src/lib/packaging/template-registry.ts');
const { editorReturnPath, requestedDimensions, studioTemplateHref } = require('../src/lib/studio-entry.ts');

const toMm = (value, unit) => unit === 'in' ? value * 25.4 : value;

test('every template page points at a ready template and every preset draws', () => {
  for (const page of BOX_TEMPLATE_PAGES) {
    const template = getPackagingTemplate(page.templateId);
    assert.equal(template?.status, 'ready', page.slug);
    for (const preset of page.presets) {
      const dimensions = { width: toMm(preset.width, preset.unit), height: toMm(preset.height, preset.unit), depth: toMm(preset.depth, preset.unit), thickness: template.defaultDimensions.thickness };
      const preview = templatePreviewGeometry(page.templateId, dimensions);
      assert.ok(preview.cut.length > 0 && preview.crease.length > 0, `${page.slug} ${preset.label}`);
      // The page preview must match what the Studio exports for the same size.
      assert.deepEqual(preview, getTemplateExportGeometry(page.templateId, dimensions), `${page.slug} ${preset.label}`);
    }
  }
});

test('studio links carry the template and size, and survive the sign-in redirect', () => {
  const href = studioTemplateHref('pizza-box', { width: 304.8, height: 44.45, depth: 304.8 }, 'in');
  const params = Object.fromEntries(new URL(href, 'https://x.test').searchParams);
  assert.deepEqual(params, { template: 'pizza-box', w: '304.8', h: '44.5', d: '304.8', unit: 'in' });
  assert.equal(editorReturnPath({ ...params, evil: 'x' }), '/studio/editor?template=pizza-box&w=304.8&h=44.5&d=304.8&unit=in');
  assert.equal(editorReturnPath({ project: 'abc' }), '/studio/editor?project=abc');
  assert.equal(editorReturnPath({}), '/studio/editor');
});

test('requested dimensions are bounded and fall back per field', () => {
  const fallback = { width: 120, height: 180, depth: 55, thickness: 0.5 };
  assert.equal(requestedDimensions({}, fallback), undefined);
  assert.deepEqual(requestedDimensions({ w: '70', h: 'abc', d: '99999' }, fallback), { width: 70, height: 180, depth: 55, thickness: 0.5 });
  assert.deepEqual(requestedDimensions({ w: '0', h: '-5', d: '12.345' }, fallback), { width: 120, height: 180, depth: 12.3, thickness: 0.5 });
});
