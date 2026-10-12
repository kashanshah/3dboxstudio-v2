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
const { FILL_OVERLAP_MM, fillUrl, isFill, panelFillLayer } = require('../src/lib/packaging/panel-fill.ts');
const { layerPrintsOn, sheetTransformToPhysical } = require('../src/lib/packaging/full-dieline-artwork.ts');
const { validProjectState } = require('../src/lib/studio-project.ts');

test('a panel colour covers its panel and the bleed, and prints only there', () => {
  const bounds = { width: 400, height: 300 };
  const panel = { id: 'top', x: 100, y: 50, width: 200, height: 120 };
  const layer = panelFillLayer('l1', panel, 'Top', bounds, '#0f67e8');
  const physical = sheetTransformToPhysical(layer.transform, bounds);
  assert.ok(Math.abs(physical.centerX - 200) < 1e-9 && Math.abs(physical.centerY - 110) < 1e-9);
  assert.ok(Math.abs(physical.width - (200 + 2 * FILL_OVERLAP_MM)) < 1e-9 && Math.abs(physical.height - (120 + 2 * FILL_OVERLAP_MM)) < 1e-9);
  assert.equal(layerPrintsOn(layer, 'top'), true);
  assert.equal(layerPrintsOn(layer, 'front'), false);
  assert.equal(layer.name, 'Top colour');
});

test('fill colours are checked and the image is one plain colour', () => {
  assert.equal(isFill({ color: '#a1B2c3' }), true);
  for (const bad of [null, {}, { color: 'red' }, { color: '#fff' }, { color: '#12345678' }]) assert.equal(isFill(bad), false);
  const svg = Buffer.from(fillUrl('#0f67e8').split(',')[1], 'base64').toString();
  assert.match(svg, /fill="#0f67e8"/);
  assert.doesNotMatch(Buffer.from(fillUrl('"><script>').split(',')[1], 'base64').toString(), /script/);
});

test('saved designs keep panel colours and reject broken ones', () => {
  const layer = panelFillLayer('l1', { id: 'front', x: 0, y: 0, width: 100, height: 100 }, 'Front', { width: 300, height: 300 }, '#ffffff');
  const state = { version: 1, templateId: 'reverse-tuck-carton', dimensions: { width: 120, height: 180, depth: 55, thickness: 0.5 }, material: 'Kraft', opening: 100, measurementUnit: 'mm', artworkByPanel: {}, outsideArtworkLayers: [layer], insideArtworkLayers: [], mediaAssets: [], outsideColorMode: 'material', insideColorMode: 'material', outsideCustomColor: '#ffffff', insideCustomColor: '#ffffff' };
  assert.equal(validProjectState(state), true);
  assert.equal(validProjectState({ ...state, outsideArtworkLayers: [{ ...layer, fill: { color: 'url(x)' } }] }), false);
});
