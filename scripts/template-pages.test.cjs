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
const { BOX_TEMPLATE_SLUGS } = require('../src/content/box-template-slugs.ts');
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

test('every preset is within its template\'s size limits', () => {
  for (const page of BOX_TEMPLATE_PAGES) {
    const template = getPackagingTemplate(page.templateId);
    for (const preset of page.presets) {
      for (const key of ['width', 'height', 'depth']) {
        const limits = template.parameters.find(parameter => parameter.key === key);
        const mm = toMm(preset[key], preset.unit);
        assert.ok(mm >= (limits?.min ?? 1) - 1e-9, `${page.slug} ${preset.label} ${key} ${mm} < ${limits?.min}`);
        assert.ok(mm <= (limits?.max ?? 3000) + 1e-9, `${page.slug} ${preset.label} ${key} ${mm} > ${limits?.max}`);
      }
    }
  }
});

test('the Studio links each template to its page', () => {
  assert.deepEqual(Object.fromEntries(BOX_TEMPLATE_PAGES.map(page => [page.templateId, page.slug]).sort()), Object.fromEntries(Object.entries(BOX_TEMPLATE_SLUGS).sort()));
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
  // Board thickness and flap sizes from the dieline generator; bad entries are dropped.
  assert.deepEqual(requestedDimensions({ w: '70', t: '0.46', a: 'glue:12.34;tuck:20;bad key:3;x:-1;y:abc' }, fallback), { width: 70, height: 180, depth: 55, thickness: 0.46, adjustments: { glue: 12.3, tuck: 20 } });
  assert.equal(requestedDimensions({ w: '70', t: '40' }, fallback).thickness, 0.5);
  const href = studioTemplateHref('mailer-box', { width: 220, height: 80, depth: 160, thickness: 1.5, adjustments: { ear: 30 } }, 'mm');
  assert.equal(href, '/studio/editor?template=mailer-box&w=220&h=80&d=160&t=1.5&a=ear%3A30&unit=mm');
  assert.equal(editorReturnPath(Object.fromEntries(new URL(href, 'https://x.test').searchParams)), href);
});

test('every template page has its own 1200×630 share image', () => {
  for (const page of BOX_TEMPLATE_PAGES) {
    const file = path.join(__dirname, '../public/og/templates', `${page.slug}.png`);
    assert.ok(fs.existsSync(file), `${page.slug} has no share image; run node scripts/render-template-og.cjs`);
    // A PNG's size sits in its IHDR chunk, right after the signature.
    const header = fs.readFileSync(file).subarray(0, 24);
    assert.deepEqual([header.readUInt32BE(16), header.readUInt32BE(20)], [1200, 630], `${page.slug} share image size`);
  }
});

test('every template card has its fold clip, small enough to load on hover', () => {
  const shots = fs.readFileSync(path.join(__dirname, 'template-shots.mjs'), 'utf8');
  for (const page of BOX_TEMPLATE_PAGES) {
    const file = path.join(__dirname, '../public/videos/templates', `${page.templateId}.mp4`);
    assert.ok(fs.existsSync(file), `${page.templateId} has no fold clip; run node scripts/render-template-clips.mjs`);
    // An MP4 opens with its ftyp box; the clip stays under 600 KB.
    assert.equal(fs.readFileSync(file).subarray(4, 8).toString('ascii'), 'ftyp', `${page.templateId} clip is an MP4`);
    assert.ok(fs.statSync(file).size < 600 * 1024, `${page.templateId} clip is ${Math.round(fs.statSync(file).size / 1024)} KB`);
    assert.ok(shots.includes(`id: '${page.templateId}'`), `${page.templateId} has a shot in scripts/template-shots.mjs`);
  }
});
