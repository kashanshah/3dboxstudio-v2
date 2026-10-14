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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, file);
const { keepArtworkOnResize } = require('../src/lib/packaging/resize-artwork.ts');
const { panelFillLayer, FILL_OVERLAP_MM } = require('../src/lib/packaging/panel-fill.ts');
const { sheetTransformToPhysical } = require('../src/lib/packaging/full-dieline-artwork.ts');
const { getTemplateGeometry } = require('../src/lib/packaging/template-runtime.ts');

const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, `${message}: ${a} vs ${b}`);
// A two-panel strip: the front panel, then the side; the box gets taller.
const before = { bounds: { width: 300, height: 100 }, panels: [{ id: 'front', x: 0, y: 0, width: 200, height: 100 }, { id: 'side', x: 200, y: 0, width: 100, height: 100 }] };
const after = { bounds: { width: 300, height: 200 }, panels: [{ id: 'front', x: 0, y: 0, width: 200, height: 200 }, { id: 'side', x: 200, y: 0, width: 100, height: 200 }] };
const logo = (id, transform) => ({ id, name: id, url: 'data:,', aspectRatio: 1, transform: { rotation: 15, ...transform } });

test('artwork keeps its printed size and its place on its panel when the box grows', () => {
  // 40 x 40 mm, centred on the front panel.
  const [layer] = keepArtworkOnResize([logo('a', { x: 100 / 3, y: 50, width: 40 / 3, height: 40 })], before, after);
  const physical = sheetTransformToPhysical(layer.transform, after.bounds);
  close(physical.width, 40, 'width'); close(physical.height, 40, 'height');
  close(physical.centerX, 100, 'x'); close(physical.centerY, 100, 'still in the middle of the taller panel');
  assert.equal(layer.transform.rotation, 15);
});

test('the selected artwork stretches with the box', () => {
  const original = logo('a', { x: 30, y: 50, width: 10, height: 40 });
  const [layer] = keepArtworkOnResize([original], before, after, new Set(['a']));
  assert.equal(layer, original);
});

test('artwork covering the whole sheet keeps covering it', () => {
  const original = logo('bg', { x: 50, y: 50, width: 100, height: 100 });
  assert.equal(keepArtworkOnResize([original], before, after)[0], original);
});

test('a panel colour refits its panel', () => {
  const fill = panelFillLayer('f', before.panels[1], 'Side', before.bounds, '#ff0000');
  const [layer] = keepArtworkOnResize([fill], before, after);
  const physical = sheetTransformToPhysical(layer.transform, after.bounds);
  close(physical.width, 100 + 2 * FILL_OVERLAP_MM, 'width'); close(physical.height, 200 + 2 * FILL_OVERLAP_MM, 'height');
  close(physical.centerX, 250, 'x'); close(physical.centerY, 100, 'y');
});

test('nothing changes when the geometry is the same', () => {
  const layers = [logo('a', { x: 30, y: 50, width: 10, height: 40 })];
  assert.equal(keepArtworkOnResize(layers, before, before), layers);
});

test('on a real template a logo keeps its size when the height changes', () => {
  const dims = { width: 120, height: 80, depth: 60, thickness: 1.5 };
  const sheetBefore = getTemplateGeometry('mailer-box', dims, {});
  const sheetAfter = getTemplateGeometry('mailer-box', { ...dims, height: 140 }, {});
  const panel = sheetBefore.panels.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
  const b = sheetBefore.bounds;
  const transform = { x: (panel.x + panel.width / 2) / b.width * 100, y: (panel.y + panel.height / 2) / b.height * 100, width: 30 / b.width * 100, height: 20 / b.height * 100, rotation: 0 };
  const [layer] = keepArtworkOnResize([logo('a', transform)], sheetBefore, sheetAfter);
  const physical = sheetTransformToPhysical(layer.transform, sheetAfter.bounds);
  close(physical.width, 30, 'width'); close(physical.height, 20, 'height');
  const moved = sheetAfter.panels.find((p) => p.id === panel.id);
  close(physical.centerX, moved.x + moved.width / 2, 'x'); close(physical.centerY, moved.y + moved.height / 2, 'y');
});
