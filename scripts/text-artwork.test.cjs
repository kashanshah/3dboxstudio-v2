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
const { DEFAULT_TEXT_SPEC, TEXT_FONTS, isTextSpec, textLayerName, textLines, textSvg, textWeight } = require('../src/lib/packaging/text-artwork.ts');
const { validProjectState } = require('../src/lib/studio-project.ts');

const metrics = { lineWidths: [400], ascent: 90, descent: 25 };

test('every font the editor offers ships its files and licence', () => {
  for (const font of TEXT_FONTS) {
    for (const weight of font.bold ? [400, 700] : [400]) {
      assert.ok(fs.existsSync(path.join(__dirname, `../public/fonts/text/${font.id}-${weight}.woff2`)), `${font.id} ${weight}`);
    }
    assert.ok(fs.existsSync(path.join(__dirname, `../public/fonts/text/${font.id}-LICENSE.txt`)), `${font.id} licence`);
  }
});

test('text specs are checked before they are saved', () => {
  assert.equal(isTextSpec(DEFAULT_TEXT_SPEC), true);
  for (const bad of [
    null, 'text', { ...DEFAULT_TEXT_SPEC, font: 'comic-sans' }, { ...DEFAULT_TEXT_SPEC, color: 'red' },
    { ...DEFAULT_TEXT_SPEC, align: 'justify' }, { ...DEFAULT_TEXT_SPEC, content: 'x'.repeat(501) },
    { ...DEFAULT_TEXT_SPEC, lineHeight: 9 }, { ...DEFAULT_TEXT_SPEC, letterSpacing: Number.NaN }, { ...DEFAULT_TEXT_SPEC, bold: 'yes' },
  ]) assert.equal(isTextSpec(bad), false, JSON.stringify(bad));
});

test('one-weight fonts ignore Bold, and layer names come from the first line', () => {
  assert.equal(textWeight({ font: 'great-vibes', bold: true }), 400);
  assert.equal(textWeight({ font: 'montserrat', bold: true }), 700);
  assert.deepEqual(textLines('a\r\nb\rc'), ['a', 'b', 'c']);
  assert.equal(textLayerName('\n  Fresh Roast  \nCoffee'), 'Fresh Roast');
  assert.equal(textLayerName('   '), 'Text');
  assert.equal(textLayerName('x'.repeat(40)).length, 32);
});

test('the SVG escapes the text, embeds the font and sizes itself to the lines', () => {
  const spec = { ...DEFAULT_TEXT_SPEC, content: '<b>&"Tea"</b>\nCo.', align: 'left' };
  const one = textSvg({ ...spec, content: 'One' }, metrics, 'AAAA');
  const two = textSvg(spec, { ...metrics, lineWidths: [500, 200] }, 'AAAA');
  assert.match(two.svg, /&lt;b&gt;&amp;&quot;Tea&quot;&lt;\/b&gt;/);
  assert.doesNotMatch(two.svg, /<b>/);
  assert.match(two.svg, /src:url\(data:font\/woff2;base64,AAAA\)/);
  assert.match(two.svg, /text-anchor="start"/);
  assert.ok(two.width > one.width && two.height > one.height);
  assert.equal(Math.round(two.height - one.height), Math.round(spec.lineHeight * 100));
});

test('saved designs keep valid text layers and reject broken ones', () => {
  const layer = { id: 'l1', name: 'Your text', url: 'data:image/svg+xml;base64,PHN2Zy8+', aspectRatio: 3, transform: { x: 50, y: 50, width: 30, height: 10, rotation: 0 }, text: DEFAULT_TEXT_SPEC };
  const state = { version: 1, templateId: 'reverse-tuck-carton', dimensions: { width: 120, height: 180, depth: 55, thickness: 0.5 }, material: 'Kraft', opening: 100, measurementUnit: 'mm', artworkByPanel: {}, outsideArtworkLayers: [layer], insideArtworkLayers: [], mediaAssets: [], outsideColorMode: 'material', insideColorMode: 'material', outsideCustomColor: '#ffffff', insideCustomColor: '#ffffff' };
  assert.equal(validProjectState(state), true);
  assert.equal(validProjectState({ ...state, outsideArtworkLayers: [{ ...layer, text: { ...DEFAULT_TEXT_SPEC, font: '../../etc' } }] }), false);
});
