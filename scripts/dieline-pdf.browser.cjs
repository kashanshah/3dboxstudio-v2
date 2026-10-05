/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('playwright-core');
const { webpack } = require('next/dist/compiled/webpack/webpack');

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dieline-pdf-browser-'));
  const root = path.resolve(__dirname, '..');
  const mirror = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { mirror(file); continue; }
      if (!file.endsWith('.ts')) continue;
      const target = path.join(temp, path.relative(root, file).replace(/\.ts$/, '.js'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
    }
  };
  mirror(path.join(root, 'src/lib/packaging'));
  fs.writeFileSync(path.join(temp, 'entry.js'), `window.pdfAudit={...require('./src/lib/packaging/download-dieline-pdf'),...require('./src/lib/packaging/dieline-pdf'),...require('./src/lib/packaging/template-runtime')};`);
  await new Promise((resolve, reject) => webpack({ mode: 'production', target: 'web', entry: path.join(temp, 'entry.js'), output: { path: temp, filename: 'bundle.js' }, resolve: { alias: { '@': path.join(temp, 'src') }, modules: [path.join(root, 'node_modules')] }, optimization: { minimize: false } }, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ path: path.join(temp, 'bundle.js') });
    const result = await page.evaluate(async () => {
      const svg = content => 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">${content}</svg>`);
      const red = svg('<rect width="200" height="100" fill="red"/>');
      const green = svg('<rect width="200" height="100" fill="#00ff00"/>');
      const blue = svg('<rect width="200" height="100" fill="blue"/>');
      const halves = svg('<rect width="100" height="100" fill="red"/><rect x="100" width="100" height="100" fill="blue"/>');
      const input = { templateId: 'reverse-tuck-carton', dimensions: { width: 40, height: 60, depth: 20, thickness: 0.5 }, geometryOptions: {}, layers: [], artworkByPanel: {}, scope: 'outside', options: { bleedMm: 3, includeArtwork: true, includeCutCrease: true, includeCalibration: true } };
      const layer = (url, opacity = 100, visible = true) => ({ id: url, name: 'test', url, opacity, visible, aspectRatio: 2, transform: { x: 50, y: 50, width: 200, height: 200, rotation: 0 } });
      const placement = url => ({ name: 'test', url, mode: 'fill', scale: 100, rotation: 0, alignX: 0, alignY: 0, transform: { x: 50, y: 50, width: 100, height: 100, rotation: 0 } });
      // JPEG panels carry alpha separately; JPEG colors are compared with a small tolerance.
      const hi = v => v >= 248, lo = v => v <= 7;
      const pixels = async (rendered, positions) => {
        const url = URL.createObjectURL(new Blob([rendered.bytes], { type: rendered.format === 'jpeg' ? 'image/jpeg' : 'image/png' }));
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); URL.revokeObjectURL(url);
        return positions.map(([x, y]) => {
          const px = Math.floor(x / rendered.width * canvas.width), py = Math.floor(y / rendered.height * canvas.height);
          const value = Array.from(ctx.getImageData(px, py, 1, 1).data);
          if (rendered.format === 'jpeg') value[3] = rendered.alpha ? rendered.alpha[py * rendered.pixelWidth + px] : 255;
          return value;
        });
      };
      const output = [];
      // Hidden layers must never be fetched or enlarge/reposition the PDF.
      let prepared = window.pdfAudit.preparePdfArtwork({ ...input, layers: [layer(red), layer('https://invalid.test/hidden.png', 100, false)] });
      const frontIndex = prepared.geometry.panels.findIndex(p => p.id === 'front');
      const front = prepared.geometry.panels[frontIndex];
      let rendered = await prepared.renderPanel(frontIndex);
      const bleedPixels = await pixels(rendered, [[23, 2], [23, 4], [23, front.height + 5]]);
      output.push({ name: 'external bleed only', pass: bleedPixels[0][3] === 0 && hi(bleedPixels[1][0]) && hi(bleedPixels[2][0]) && bleedPixels[2][3] === 255, pixels: bleedPixels });
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, layers: [layer(red), layer(blue, 50)] });
      rendered = await prepared.renderPanel(frontIndex);
      const blended = (await pixels(rendered, [[23, 33]]))[0];
      output.push({ name: 'opacity and stack order', pass: Math.abs(blended[0] - 127) <= 4 && Math.abs(blended[2] - 128) <= 4 && blended[3] === 255, pixels: blended });
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, artworkByPanel: { Bottom: placement(halves), 'Interior Bottom': placement(green) } });
      const bottomIndex = prepared.geometry.panels.findIndex(p => p.id === 'bottom');
      rendered = await prepared.renderPanel(bottomIndex);
      const bottomPixels = await pixels(rendered, [[8, 13], [38, 13]]);
      output.push({ name: 'opposite bottom hinge preserves folded orientation', pass: hi(bottomPixels[0][2]) && hi(bottomPixels[1][0]), pixels: bottomPixels });
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, scope: 'inside', artworkByPanel: { Bottom: placement(halves), 'Interior Bottom': placement(green) } });
      rendered = await prepared.renderPanel(bottomIndex);
      const inside = (await pixels(rendered, [[23, 13]]))[0];
      output.push({ name: 'inside artwork scope', pass: hi(inside[1]) && lo(inside[0]), pixels: inside });
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, layers: [layer(red)], artworkByPanel: { Front: placement(green) } });
      rendered = await prepared.renderPanel(frontIndex);
      const explicit = (await pixels(rendered, [[23, 33]]))[0];
      output.push({ name: 'explicit panel artwork takes precedence over sheet artwork', pass: hi(explicit[1]) && lo(explicit[0]), pixels: explicit });
      const transparent = svg('<rect width="100" height="100" fill="#00ff00"/>');
      for (const templateId of ['reverse-tuck-carton', 'base-box', 'split-top-box']) {
        for (const scope of ['outside', 'inside']) {
          const key = scope === 'inside' ? 'Interior Front' : 'Front';
          prepared = window.pdfAudit.preparePdfArtwork({ ...input, templateId, scope, layers: [layer(red)], artworkByPanel: { [key]: placement(transparent) } });
          const index = prepared.geometry.panels.findIndex(p => p.id === 'front');
          rendered = await prepared.renderPanel(index);
          const face = await pixels(rendered, [[13, 33], [33, 33]]);
          output.push({ name: `${templateId} ${scope}: transparent face replaces sheet artwork`, pass: hi(face[0][1]) && face[1][3] === 0, pixels: face });
          const leftIndex = prepared.geometry.panels.findIndex(p => p.id === 'left');
          const left = await prepared.renderPanel(leftIndex);
          const sheet = (await pixels(left, [[13, 33]]))[0];
          output.push({ name: `${templateId} ${scope}: other faces retain sheet artwork`, pass: hi(sheet[0]) && sheet[3] === 255, pixels: sheet });
        }
      }
      const fitted = { ...placement(green), transform: undefined, mode: 'fit' };
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, layers: [layer(red)], artworkByPanel: { Front: fitted } });
      rendered = await prepared.renderPanel(frontIndex);
      const partial = await pixels(rendered, [[23, 13], [23, 33], [23, 53]]);
      output.push({ name: 'fitted face leaves uncovered areas transparent instead of showing sheet artwork', pass: partial[0][3] === 0 && hi(partial[1][1]) && partial[2][3] === 0, pixels: partial });
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, baseColor: '#0000ff', layers: [layer(red)], artworkByPanel: { Front: placement(transparent) } });
      rendered = await prepared.renderPanel(frontIndex);
      const base = (await pixels(rendered, [[33, 33]]))[0];
      output.push({ name: 'transparent face preserves custom base color', pass: lo(base[0]) && hi(base[2]) && base[3] === 255, pixels: base });
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, layers: [layer('data:image/png;base64,broken')] });
      let rejected = false;
      try { await prepared.renderPanel(frontIndex); } catch { rejected = true; }
      output.push({ name: 'failed artwork aborts export', pass: rejected });
      const large = window.pdfAudit.preparePdfArtwork({ ...input, dimensions: { width: 1500, height: 80, depth: 50, thickness: 0.5 }, layers: [layer(red)] });
      const largeFront = await large.renderPanel(large.geometry.panels.findIndex(p => p.id === 'front'));
      output.push({ name: 'large artwork has a bounded raster canvas', pass: largeFront.dpi < 300 && largeFront.dpi > 60, dpi: largeFront.dpi });
      const ipad = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 };
      const mobile = window.pdfAudit.preparePdfArtwork({ ...input, deviceInfo: ipad, dimensions: { width: 400, height: 500, depth: 200, thickness: 0.5 }, layers: [layer(red)] });
      let mobileMax = 0, mobileMinDpi = 300;
      for (let i = 0; i < mobile.geometry.panels.length; i++) {
        const panelImage = await mobile.renderPanel(i);
        if (!panelImage) continue;
        mobileMax = Math.max(mobileMax, panelImage.pixelWidth * panelImage.pixelHeight);
        mobileMinDpi = Math.min(mobileMinDpi, panelImage.dpi);
      }
      output.push({ name: 'iPadOS budget caps every panel canvas at 4 MP', pass: mobile.budget.tier === 'mobile' && mobileMax <= 4.01e6 && mobileMinDpi >= 100, mobileMax, mobileMinDpi });
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, options: { ...input.options, bleedMm: 0 }, baseColor: '#336699' });
      rendered = await prepared.renderPanel(frontIndex);
      output.push({ name: 'opaque panel is a plain JPEG without a soft mask', pass: rendered.format === 'jpeg' && rendered.alpha === null, format: rendered.format });
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, layers: [layer(red)] });
      rendered = await prepared.renderPanel(frontIndex);
      output.push({ name: 'panel with transparent bleed corners keeps alpha', pass: rendered.format === 'jpeg' && rendered.alpha instanceof Uint8Array && rendered.alpha.length === rendered.pixelWidth * rendered.pixelHeight });
      const unsized = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10" fill="red"/></svg>');
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, artworkByPanel: { Front: { ...placement(unsized), transform: undefined, mode: 'fill' } } });
      rendered = await prepared.renderPanel(frontIndex);
      const unsizedPixel = (await pixels(rendered, [[23, 33]]))[0];
      output.push({ name: 'viewBox-only SVG is sized from its viewBox instead of producing NaN', pass: hi(unsizedPixel[0]) && lo(unsizedPixel[1]) && unsizedPixel[3] === 255, pixels: unsizedPixel });
      const sizeless = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10" fill="red"/></svg>');
      prepared = window.pdfAudit.preparePdfArtwork({ ...input, artworkByPanel: { Front: { ...placement(sizeless), transform: undefined, mode: 'fill' } } });
      let sizelessResult;
      try { const r = await prepared.renderPanel(frontIndex); sizelessResult = (await pixels(r, [[23, 33]]))[0].every(Number.isFinite) ? 'rendered' : 'nan'; } catch (error) { sizelessResult = error.message; }
      output.push({ name: 'SVG without any size renders or fails with a clear message', pass: sizelessResult === 'rendered' || /no width, height or viewBox/.test(sizelessResult), sizelessResult });
      const exported = window.pdfAudit.preparePdfArtwork({ ...input, layers: [layer(halves)] });
      const pdf = await window.pdfAudit.createDielinePdf({ ...input, geometry: exported.geometry, renderPanel: exported.renderPanel, title: 'PDF artwork verification' });
      return { output, pdf: Array.from(pdf.bytes) };
    });
    for (const check of result.output) { assert.ok(check.pass, JSON.stringify(check)); console.log(`PASS: ${check.name}`); }
    if (process.env.PDF_AUDIT_OUTPUT) fs.writeFileSync(process.env.PDF_AUDIT_OUTPUT, Buffer.from(result.pdf));
    const { PDFDocument, PDFName, PDFRawStream } = require('pdf-lib');
    const parsed = await PDFDocument.load(Uint8Array.from(result.pdf));
    const images = parsed.context.enumerateIndirectObjects().map(([, object]) => object)
      .filter(object => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
    const jpegs = images.filter(image => image.dict.get(PDFName.of('Filter'))?.toString() === '/DCTDecode');
    assert.ok(jpegs.length > 0, 'artwork panels should be embedded as JPEG');
    assert.ok(jpegs.every(image => image.dict.get(PDFName.of('SMask'))), 'transparent JPEG panels need a soft mask');
    console.log(`PASS: PDF embeds ${jpegs.length} JPEG panels with Flate soft masks`);
    const input = { templateId: 'reverse-tuck-carton', dimensions: { width: 120, height: 180, depth: 55, thickness: 0.5 }, geometryOptions: {}, layers: [], artworkByPanel: {}, scope: 'outside', options: { bleedMm: 3, includeArtwork: false, includeCutCrease: true, includeCalibration: true } };
    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(input => window.pdfAudit.downloadDielinePdf(input), input);
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), '3d-box-studio-reverse-tuck-carton-outside-1to1.pdf');
    assert.equal(await download.failure(), null);
    console.log('PASS: direct browser PDF download without popup or print dialog');
    const webview = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram', platform: 'iPhone', maxTouchPoints: 5 };
    const popupPromise = page.waitForEvent('popup', { timeout: 10_000 }).catch(() => null);
    const delivery = await page.evaluate(input => window.pdfAudit.downloadDielinePdf(input).then(r => r.delivery, e => `error: ${e.message}`), { ...input, deviceInfo: webview });
    const popup = await popupPromise;
    assert.ok(delivery === 'share' || (delivery === 'tab' && popup), `iOS webview fallback: ${delivery}`);
    console.log(`PASS: iOS in-app webview falls back to ${delivery} instead of an ignored download`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
