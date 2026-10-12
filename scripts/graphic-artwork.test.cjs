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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, file);
const g = require('../src/lib/packaging/graphic-artwork.ts');
const { validProjectState } = require('../src/lib/studio-project.ts');

const svgOf = url => Buffer.from(url.split(',')[1], 'base64').toString();

test('EAN-13 and UPC-A bars and check digits match the GS1 patterns', () => {
  assert.equal(g.gs1CheckDigit('400638133393'), '1');
  assert.equal(g.gs1CheckDigit('03600029145'), '2');
  assert.equal(g.ean13Modules('4006381333931'),
    '101' + '000110101001110101111011110100010010110011' + '01010' + '100001010000101000010111010010000101100110' + '101');
  assert.equal(g.barcodeDigits('ean13', '400638133393'), '4006381333931');
  assert.equal(g.barcodeDigits('upca', '03600029145'), '036000291452');
  assert.equal(g.barcodeError('ean13', '4006381333931'), null);
  assert.match(g.barcodeError('ean13', '4006381333932'), /should be 1/);
  assert.match(g.barcodeError('ean13', '12345'), /12 digits/);
  assert.match(g.barcodeError('upca', '03600029145x'), /digits only/);
});

test('Code 128 uses set B for text and set C for runs of digits', () => {
  assert.equal(g.code128Modules('ABC-123'),
    '1101001000010100011000100010110001000100011010011011100100111001101100111001011001011100101100001001100011101011');
  assert.deepEqual(g.code128Values('AB123456'), [104, 33, 34, 99, 12, 34, 56, 26, 106]);
  assert.deepEqual(g.code128Values('12345').slice(0, -2), [104, 17, 99, 23, 45]);
  assert.deepEqual(g.code128Values('X1234567Y').slice(0, -2), [104, 56, 17, 99, 23, 45, 67, 100, 57]);
  assert.equal(g.barcodeError('code128', 'Box 42!'), null);
  assert.ok(g.barcodeError('code128', 'Café'));
  assert.ok(g.barcodeError('code128', ''));
});

test('QR codes encode UTF-8 with finder patterns in three corners', () => {
  const matrix = g.qrMatrix('https://3dboxstudio.com');
  assert.equal(matrix.length, 25);
  const n = matrix.length;
  for (const [row, col] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    assert.equal(matrix[row].slice(col, col + 7).every(Boolean), true);
    assert.equal(matrix[row + 3][col + 3], true);
  }
  assert.ok(g.qrMatrix('Café ☕').length >= 21);
  const drawn = g.renderGraphic(g.DEFAULT_QR);
  assert.equal(drawn.aspectRatio, 1);
  assert.match(svgOf(drawn.url), /fill="#ffffff"/);
});

test('shapes are drawn at their size so outlines keep their thickness', () => {
  const spec = { ...g.DEFAULT_SHAPE, stroke: '#111827', strokeMm: 2 };
  const wide = g.renderGraphic(spec, { width: 80, height: 20 });
  assert.equal(wide.aspectRatio, 4);
  const svg = svgOf(wide.url);
  assert.match(svg, /viewBox="0 0 80 20"/);
  assert.match(svg, /<rect x="1" y="1" width="78" height="18"/);
  assert.match(svg, /stroke-width="2"/);
  for (const shape of g.SHAPE_KINDS) assert.match(svgOf(g.renderGraphic({ ...spec, shape }).url), /^<svg [^>]+>.+<\/svg>$/);
  assert.match(svgOf(g.renderGraphic({ ...g.DEFAULT_SHAPE, shape: 'line', fill: '#c2410c', stroke: null }).url), /fill="#c2410c"/);
});

test('barcodes are placed at 100% size', () => {
  const size = g.defaultGraphicSize({ ...g.DEFAULT_BARCODE, showText: false });
  assert.ok(Math.abs(size.width - 113 * 0.33) < 1e-9);
  assert.ok(g.renderGraphic(g.DEFAULT_BARCODE).height > g.renderGraphic({ ...g.DEFAULT_BARCODE, showText: false }).height);
  assert.match(svgOf(g.renderGraphic({ ...g.DEFAULT_BARCODE, format: 'code128', value: 'A<&>' }).url), /A&lt;&amp;&gt;/);
});

test('saved designs keep graphic settings and reject broken ones', () => {
  for (const spec of [g.DEFAULT_SHAPE, g.DEFAULT_QR, g.DEFAULT_BARCODE]) assert.equal(g.isGraphicSpec(spec), true);
  for (const bad of [null, { kind: 'shape' }, { ...g.DEFAULT_SHAPE, shape: 'hexagon' }, { ...g.DEFAULT_SHAPE, fill: 'red' }, { ...g.DEFAULT_SHAPE, strokeMm: 0 },
    { ...g.DEFAULT_QR, value: '' }, { ...g.DEFAULT_QR, value: 'x'.repeat(g.QR_MAX_LENGTH + 1) }, { ...g.DEFAULT_BARCODE, value: '123' }, { ...g.DEFAULT_BARCODE, format: 'ean8' }]) {
    assert.equal(g.isGraphicSpec(bad), false);
  }
  const drawn = g.renderGraphic(g.DEFAULT_QR);
  const layer = { id: 'q', name: 'QR code', url: drawn.url, aspectRatio: 1, graphic: g.DEFAULT_QR, transform: { x: 50, y: 50, width: 10, height: 10, rotation: 0 } };
  const state = { version: 1, templateId: 'reverse-tuck-carton', dimensions: { width: 120, height: 180, depth: 55, thickness: 0.5 }, material: 'Kraft', opening: 100, measurementUnit: 'mm', artworkByPanel: {}, outsideArtworkLayers: [layer], insideArtworkLayers: [], mediaAssets: [], outsideColorMode: 'material', insideColorMode: 'material', outsideCustomColor: '#ffffff', insideCustomColor: '#ffffff' };
  assert.equal(validProjectState(state), true);
  assert.equal(validProjectState({ ...state, outsideArtworkLayers: [{ ...layer, graphic: { ...g.DEFAULT_QR, color: 'javascript:' } }] }), false);
});
