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

const { getPdfRasterBudget, panelPixelsPerMm, choosePanelImageEncoding, isIOSDevice, isIOSWebView, friendlyPdfError, PdfExportError } = require('../src/lib/packaging/pdf-options.ts');
const { svgIntrinsicSize } = require('../src/lib/packaging/download-dieline-pdf.ts');
const devices = {
  desktop: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', platform: 'Win32', maxTouchPoints: 0, deviceMemory: 8 },
  mac: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 0 },
  ipad: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 },
  iphone: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 },
  iphoneWebView: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0', platform: 'iPhone', maxTouchPoints: 5 },
  lowAndroid: { userAgent: 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36', platform: 'Linux armv8l', maxTouchPoints: 5, deviceMemory: 2 },
};

function rasterPlan(d, budget, bleed = 3) {
  const geometry = getTemplateExportGeometry('reverse-tuck-carton', d);
  const sized = geometry.panels.map(p => ({ w: p.width + 2 * bleed, h: p.height + 2 * bleed }));
  const total = sized.reduce((sum, p) => sum + p.w * p.h, 0);
  const panels = sized.map(p => { const ppm = panelPixelsPerMm(p.w, p.h, total, budget); return { dpi: ppm * 25.4, pixels: Math.round(p.w * ppm) * Math.round(p.h * ppm) }; });
  return { minDpi: Math.min(...panels.map(p => p.dpi)), maxPixels: Math.max(...panels.map(p => p.pixels)), totalPixels: panels.reduce((s, p) => s + p.pixels, 0) };
}

test('device detection recognises iOS, iPadOS-as-Mac and in-app webviews', () => {
  assert.equal(isIOSDevice(devices.iphone), true);
  assert.equal(isIOSDevice(devices.ipad), true, 'iPadOS reports MacIntel with touch');
  assert.equal(isIOSDevice(devices.mac), false);
  assert.equal(isIOSDevice(devices.desktop), false);
  assert.equal(isIOSWebView(devices.iphone), false);
  assert.equal(isIOSWebView(devices.iphoneWebView), true);
  assert.equal(isIOSWebView(devices.mac), false);
});

test('raster budget tiers: desktop unchanged, iOS/mobile and low-memory devices capped', () => {
  assert.equal(getPdfRasterBudget(devices.desktop).tier, 'desktop');
  assert.equal(getPdfRasterBudget(devices.mac).tier, 'desktop');
  assert.equal(getPdfRasterBudget({}).tier, 'desktop');
  assert.equal(getPdfRasterBudget(devices.ipad).tier, 'mobile');
  assert.equal(getPdfRasterBudget(devices.iphone).tier, 'mobile');
  assert.equal(getPdfRasterBudget(devices.lowAndroid).tier, 'low-memory');
  assert.equal(getPdfRasterBudget({ ...devices.desktop, deviceMemory: 1 }).tier, 'low-memory');
  const desktop = getPdfRasterBudget(devices.desktop);
  // Desktop matches the previous per-panel formula exactly.
  for (const [w, h] of [[126, 186], [1506, 86], [40, 40]]) {
    near(panelPixelsPerMm(w, h, 1e9, desktop), Math.min(300 / 25.4, 4096 / Math.max(w, h), Math.sqrt(16e6 / (w * h))));
  }
});

test('typical carton keeps 300 dpi on desktop and mobile; low-memory stays above the 150 dpi floor', () => {
  const typical = { width: 120, height: 180, depth: 55, thickness: 0.5 };
  const desktop = rasterPlan(typical, getPdfRasterBudget(devices.desktop));
  const mobile = rasterPlan(typical, getPdfRasterBudget(devices.iphone));
  const low = rasterPlan(typical, getPdfRasterBudget(devices.lowAndroid));
  near(desktop.minDpi, 300); near(mobile.minDpi, 300);
  assert.ok(mobile.maxPixels <= 4.01e6 && mobile.totalPixels <= 32e6);
  assert.ok(low.minDpi >= 150 && low.minDpi < 300, `low-memory dpi ${low.minDpi}`);
  assert.ok(low.maxPixels <= 2.51e6);
});

test('large cartons on mobile are bounded per panel; the total cap never goes below the dpi floor', () => {
  const budget = getPdfRasterBudget(devices.ipad);
  const large = rasterPlan({ width: 300, height: 400, depth: 150, thickness: 1 }, budget);
  assert.ok(large.maxPixels <= 4.01e6, `per panel ${large.maxPixels}`);
  assert.ok(large.minDpi >= 100);
  const desktopLarge = rasterPlan({ width: 300, height: 400, depth: 150, thickness: 1 }, getPdfRasterBudget(devices.desktop));
  assert.ok(desktopLarge.minDpi > large.minDpi);
  near(panelPixelsPerMm(50, 50, 1e6, budget) * 25.4, 150);
});

test('panel encoding prefers JPEG and only keeps alpha when needed', () => {
  assert.equal(choosePanelImageEncoding({ hasAlpha: false, jpegSupported: true }), 'jpeg');
  assert.equal(choosePanelImageEncoding({ hasAlpha: true, jpegSupported: true }), 'jpeg+smask');
  assert.equal(choosePanelImageEncoding({ hasAlpha: true, jpegSupported: false }), 'png');
  assert.equal(choosePanelImageEncoding({ hasAlpha: false, jpegSupported: false }), 'png');
});

test('SVG without intrinsic size is sized from its viewBox or reported', () => {
  assert.deepEqual(svgIntrinsicSize(null, null, '0 0 20 10'), { width: 2048, height: 1024, viewBox: null });
  assert.deepEqual(svgIntrinsicSize('100%', '100%', '0,0,300,600'), { width: 1024, height: 2048, viewBox: null });
  assert.deepEqual(svgIntrinsicSize('4000', null, '0 0 2 1'), { width: 4000, height: 2000, viewBox: null });
  assert.deepEqual(svgIntrinsicSize('20px', '10px', null), { width: 2048, height: 1024, viewBox: '0 0 20 10' });
  assert.equal(svgIntrinsicSize(null, null, null), null);
  assert.equal(svgIntrinsicSize('50%', null, '0 0 0 10'), null);
});

test('low-level failures become user-friendly messages; explicit messages pass through', () => {
  assert.match(friendlyPdfError(new RangeError('Array buffer allocation failed')).message, /ran out of memory/);
  assert.match(friendlyPdfError(Object.assign(new Error('x'), { name: 'SecurityError' })).message, /image permissions/);
  assert.match(friendlyPdfError(undefined).message, /Could not prepare the PDF/);
  const own = new PdfExportError('Bleed must be between 0 and 10 mm.');
  assert.equal(friendlyPdfError(own), own);
  assert.match(friendlyPdfError(new Error('Box is too small for a glue flap')).message, /glue flap/);
});

const fakeJpeg = (w, h) => Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);

test('JPEG panels embed as DCT images with a Flate soft mask only when alpha is present, yielding between panels', async () => {
  const geometry = getTemplateExportGeometry('reverse-tuck-carton', defaultDimensions);
  const order = [];
  let ticks = 0;
  const timer = setInterval(() => ticks++, 0);
  const renderPanel = async index => {
    order.push(ticks);
    if (index > 2) return null;
    const panel = geometry.panels[index];
    return { bytes: fakeJpeg(4, 2), format: 'jpeg', alpha: index === 0 ? Uint8Array.from([0, 255, 255, 255, 255, 255, 255, 0]) : null, pixelWidth: 4, pixelHeight: 2, x: panel.x, y: panel.y, width: panel.width, height: panel.height, dpi: 300 };
  };
  const result = await createDielinePdf({ geometry, renderPanel, dimensions: defaultDimensions, scope: 'outside', title: 'JPEG', options: DEFAULT_DIELINE_PDF_OPTIONS });
  clearInterval(timer);
  assert.ok(order.at(-1) > order[0], 'panels must be rendered across event-loop turns');
  const pdf = await PDFDocument.load(result.bytes);
  const images = pdf.context.enumerateIndirectObjects().map(([, o]) => o).filter(o => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
  const jpegs = images.filter(o => o.dict.get(PDFName.of('Filter'))?.toString() === '/DCTDecode');
  assert.equal(jpegs.length, 3);
  const masked = jpegs.filter(o => o.dict.get(PDFName.of('SMask')));
  assert.equal(masked.length, 1);
  const smask = pdf.context.lookup(masked[0].dict.get(PDFName.of('SMask')), PDFRawStream);
  assert.equal(smask.dict.get(PDFName.of('ColorSpace')).toString(), '/DeviceGray');
  assert.deepEqual(Array.from(decodePDFRawStream(smask).decode()), [0, 255, 255, 255, 255, 255, 255, 0]);
  await assert.rejects(createDielinePdf({ geometry, renderPanel: async () => ({ ...(await renderPanel(0)), alpha: new Uint8Array(3) }), dimensions: defaultDimensions, scope: 'outside', title: 'Bad', options: DEFAULT_DIELINE_PDF_OPTIONS }), /transparency/);
});
