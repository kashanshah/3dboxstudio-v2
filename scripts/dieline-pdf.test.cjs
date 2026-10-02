/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } = require('pdf-lib');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { getTemplateExportGeometry, getTemplateGeometry } = require('../src/lib/packaging/template-runtime.ts');
const { createDielinePdf, MM_TO_PT } = require('../src/lib/packaging/dieline-pdf.ts');
const { DEFAULT_DIELINE_PDF_OPTIONS } = require('../src/lib/packaging/pdf-options.ts');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} differs from ${b}`);
const defaultDimensions = { width: 120, height: 180, depth: 55, thickness: 0.5 };
const fixtures = [defaultDimensions, { width: 2 * 25.4, height: 3 * 25.4, depth: 25.4, thickness: 0.5 }, { width: 1500, height: 80, depth: 50, thickness: 2 }];

test('reverse-tuck cutting layout has exact nominal faces, opposite hinges and closure flaps', () => {
  for (const d of fixtures) {
    const original = getTemplateGeometry('reverse-tuck-carton', d);
    const g = getTemplateExportGeometry('reverse-tuck-carton', d);
    assert.equal(g.kind, 'cutting-template');
    assert.equal(g.panels.length, 13);
    for (const panel of g.panels.filter(p => p.sourceId)) {
      const source = original.panels.find(p => p.id === panel.sourceId);
      near(panel.width, source.width); near(panel.height, source.height);
    }
    const top = g.panels.find(p => p.id === 'top');
    const bottom = g.panels.find(p => p.id === 'bottom');
    const front = g.panels.find(p => p.id === 'front');
    const back = g.panels.find(p => p.id === 'back');
    near(top.x, front.x); near(top.y + top.height, front.y);
    near(bottom.x, back.x); near(bottom.y, back.y + back.height);
    assert.equal(bottom.sourceRotation, 180);
    assert.equal(g.panels.filter(p => p.id.endsWith('dust')).length, 4);
    assert.equal(g.panels.filter(p => p.id.endsWith('tuck')).length, 2);
    assert.deepEqual(getTemplateGeometry('reverse-tuck-carton', d), original, 'export must not change mockup geometry');
  }
});

test('cut contour forms one closed boundary without cutting through folds', () => {
  for (const d of fixtures) {
    const { cut, crease } = getTemplateExportGeometry('reverse-tuck-carton', d);
    const key = p => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
    const neighbors = new Map();
    for (const line of cut) {
      const a = key(line.start), b = key(line.end);
      assert.notEqual(a, b);
      for (const [from, to] of [[a, b], [b, a]]) neighbors.set(from, [...(neighbors.get(from) || []), to]);
      for (const fold of crease) {
        const vertical = Math.abs(line.start.x - line.end.x) < 1e-7 && Math.abs(fold.start.x - fold.end.x) < 1e-7 && Math.abs(line.start.x - fold.start.x) < 1e-7;
        const horizontal = Math.abs(line.start.y - line.end.y) < 1e-7 && Math.abs(fold.start.y - fold.end.y) < 1e-7 && Math.abs(line.start.y - fold.start.y) < 1e-7;
        if (!vertical && !horizontal) continue;
        const axis = vertical ? 'y' : 'x';
        const overlap = Math.min(Math.max(line.start[axis], line.end[axis]), Math.max(fold.start[axis], fold.end[axis])) - Math.max(Math.min(line.start[axis], line.end[axis]), Math.min(fold.start[axis], fold.end[axis]));
        assert.ok(overlap <= 1e-7, 'cut overlaps a crease');
      }
    }
    assert.ok([...neighbors.values()].every(edges => edges.length === 2), 'every boundary vertex must have exactly two neighbors');
    const visited = new Set();
    const stack = [neighbors.keys().next().value];
    while (stack.length) { const point = stack.pop(); if (visited.has(point)) continue; visited.add(point); stack.push(...neighbors.get(point)); }
    assert.equal(visited.size, neighbors.size, 'boundary must be connected');
  }
});

test('other templates remain explicitly labelled proofs and retain their own geometry', () => {
  for (const id of ['base-box', 'split-top-box']) for (const options of [{ openingMode: 'lid_from_left', splitTopHingeSide: 'side_a' }, { openingMode: 'lid_from_back', splitTopHingeSide: 'side_b' }]) {
    const source = getTemplateGeometry(id, defaultDimensions, options);
    const g = getTemplateExportGeometry(id, defaultDimensions, options);
    assert.equal(g.kind, 'layout-proof');
    assert.deepEqual(g.bounds, source.bounds);
    assert.deepEqual(g.panels.map(p => ({id:p.id,label:p.label,x:p.x,y:p.y,width:p.width,height:p.height,kind:p.kind})), source.panels);
  }
});

async function readPdf(d, options = {}) {
  const geometry = getTemplateExportGeometry('reverse-tuck-carton', d);
  const result = await createDielinePdf({ geometry, dimensions: d, scope: 'outside', title: 'Test', options: { ...DEFAULT_DIELINE_PDF_OPTIONS, includeArtwork: false, ...options } });
  const pdf = await PDFDocument.load(result.bytes);
  const page = pdf.getPages()[0];
  const streams = page.node.lookup(PDFName.of('Contents'), PDFArray);
  const content = Array.from({ length: streams.size() }, (_, i) => Buffer.from(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode()).toString()).join('\n');
  return { geometry, result, pdf, page, content };
}

test('serialized PDF paths, page boxes and calibration ruler are exactly 1:1 in mm and inches', async () => {
  for (const d of fixtures) {
    const { geometry, result, page, content, pdf } = await readPdf(d);
    assert.equal(pdf.getPageCount(), 1);
    near(page.getWidth() / MM_TO_PT, result.widthMm);
    near(page.getHeight() / MM_TO_PT, result.heightMm);
    near(page.getTrimBox().width / MM_TO_PT, geometry.bounds.width);
    near(page.getTrimBox().height / MM_TO_PT, geometry.bounds.height);
    near(page.getBleedBox().width / MM_TO_PT, geometry.bounds.width + 6);
    const cutSection = content.split('/CutContour CS')[1].split('EMC')[0];
    const segments = [...cutSection.matchAll(/([\d.]+) ([\d.]+) m\n([\d.]+) ([\d.]+) l\nS/g)];
    assert.equal(segments.length, geometry.cut.length);
    segments.forEach((match, i) => {
      near((Number(match[3]) - Number(match[1])) / MM_TO_PT, geometry.cut[i].end.x - geometry.cut[i].start.x);
      near((Number(match[4]) - Number(match[2])) / MM_TO_PT, geometry.cut[i].start.y - geometry.cut[i].end.y);
    });
    const allLines = [...content.matchAll(/([\d.]+) ([\d.]+) m\n([\d.]+) ([\d.]+) l\nS/g)];
    assert.ok(allLines.some(m => Math.abs((Number(m[3]) - Number(m[1])) / MM_TO_PT - 100) < 1e-6 && m[2] === m[4]), '100 mm calibration line missing');
    assert.equal(pdf.catalog.lookup(PDFName.of('ViewerPreferences')).get(PDFName.of('PrintScaling')).toString(), '/None');
  }
});

test('PDF exposes separate tooling layers and spot colors; options remove the selected content', async () => {
  const { page, pdf, content } = await readPdf(defaultDimensions);
  const resources = page.node.Resources();
  for (const name of ['CutContour', 'Crease']) {
    const spot = resources.lookup(PDFName.of('ColorSpace')).lookup(PDFName.of(name), PDFArray);
    assert.equal(spot.get(0).toString(), '/Separation'); assert.equal(spot.get(1).toString(), `/${name}`);
  }
  const groups = pdf.catalog.lookup(PDFName.of('OCProperties')).lookup(PDFName.of('OCGs'), PDFArray);
  assert.deepEqual(Array.from({ length: groups.size() }, (_, i) => pdf.context.lookup(groups.get(i)).get(PDFName.of('Name')).decodeText()), ['CutContour', 'Crease', 'Notes and calibration']);
  assert.ok(content.includes('/Crease CS'));
  assert.ok(content.includes('/ToolingOverprint gs'));
  assert.equal(resources.lookup(PDFName.of('ExtGState')).lookup(PDFName.of('ToolingOverprint')).get(PDFName.of('OP')).toString(), 'true');
  const noGuides = await readPdf(defaultDimensions, { includeCutCrease: false, includeArtwork: true, includeCalibration: false, bleedMm: 0 });
  assert.ok(!noGuides.content.includes('/CutContour CS'));
  assert.ok(!noGuides.content.includes('/Crease CS'));
});

test('invalid bleed, empty exports, impossible stock sizes and oversized pages fail explicitly', async () => {
  for (const bleedMm of [-1, 11, NaN]) await assert.rejects(readPdf(defaultDimensions, { bleedMm }), /Bleed/);
  await assert.rejects(readPdf(defaultDimensions, { includeArtwork: false, includeCutCrease: false }), /Include/);
  assert.throws(() => getTemplateExportGeometry('reverse-tuck-carton', { width: 1, height: 1, depth: 1, thickness: 2 }), /too small/);
  assert.throws(() => getTemplateExportGeometry('reverse-tuck-carton', { width: 10, height: 30, depth: 20, thickness: 0.5 }), /glue flap/);
  await assert.rejects(readPdf({ ...defaultDimensions, width: 5000 }), /page size/);
  for (const width of [0, NaN]) await assert.rejects(createDielinePdf({
    geometry: getTemplateExportGeometry('reverse-tuck-carton', defaultDimensions),
    dimensions: { ...defaultDimensions, width }, scope: 'outside', title: 'Invalid dimensions', options: DEFAULT_DIELINE_PDF_OPTIONS,
  }), /valid box dimensions/);
});
