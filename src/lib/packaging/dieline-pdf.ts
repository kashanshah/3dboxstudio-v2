import {
  PDFDocument, PDFName, PDFNumber, PDFString, PDFDict, PDFOperator, PDFOperatorNames,
  PDFStream, StandardFonts, rgb, type PDFPage, type PDFRef,
} from 'pdf-lib';
import type { DielineExportGeometry, LineMm } from './export-geometry';
import { validatePdfOptions, validatePdfDimensions, PdfExportError, type DielinePdfOptions } from './pdf-options';

export const MM_TO_PT = 72 / 25.4;
const pt = (mm: number) => mm * MM_TO_PT;
export type PdfPanelImage = {
  /** Encoded panel raster: PNG (with alpha) or JPEG (opaque; see `alpha`). */
  bytes: Uint8Array;
  format?: 'png' | 'jpeg';
  /** JPEG only: one 8-bit alpha sample per pixel, row-major; omitted when fully opaque. */
  alpha?: Uint8Array | null;
  pixelWidth?: number;
  pixelHeight?: number;
  x: number; y: number; width: number; height: number; dpi: number;
};

/** Lets the browser paint and collect garbage between panels. */
export const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function embedPanelImage(doc: PDFDocument, image: PdfPanelImage) {
  if (image.format !== 'jpeg') return doc.embedPng(image.bytes);
  const embedded = await doc.embedJpg(image.bytes);
  if (image.alpha) {
    const { pixelWidth: w, pixelHeight: h } = image;
    if (!w || !h || image.alpha.length !== w * h) throw new PdfExportError('Could not encode PDF artwork transparency. Please retry or use a desktop browser.');
    const smask = doc.context.register(doc.context.flateStream(image.alpha, {
      Type: 'XObject', Subtype: 'Image', Width: w, Height: h, ColorSpace: 'DeviceGray', BitsPerComponent: 8,
    }));
    // Write the image XObject now so the soft mask can be attached to it.
    await embedded.embed();
    doc.context.lookup(embedded.ref, PDFStream).dict.set(PDFName.of('SMask'), smask);
  } else await embedded.embed();
  return embedded;
}
export type DielinePdfInput = {
  geometry: DielineExportGeometry;
  options: DielinePdfOptions;
  title: string;
  scope: 'outside' | 'inside';
  dimensions: { width: number; height: number; depth: number; thickness: number };
  /** One panel at a time bounds browser memory; null means an unprinted panel. */
  renderPanel?: (index: number) => Promise<PdfPanelImage | null>;
  /** Called after each panel's artwork is placed, so the UI can show progress. */
  onPanelProgress?: (done: number, total: number) => void;
};

function addLayer(doc: PDFDocument, page: PDFPage, name: string, layers: PDFRef[]) {
  const ref = doc.context.register(doc.context.obj({ Type: 'OCG', Name: PDFString.of(name) }));
  layers.push(ref);
  const resources = page.node.Resources()!;
  let properties = resources.lookupMaybe(PDFName.of('Properties'), PDFDict);
  if (!properties) { properties = doc.context.obj({}); resources.set(PDFName.of('Properties'), properties); }
  const key = PDFName.of(`Layer${layers.length}`);
  properties.set(key, ref);
  return () => page.pushOperators(PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of('OC'), key]));
}
const endLayer = (page: PDFPage) => page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent));

/** Native Separation colors preserve independently selectable tooling paths. */
function addSpotColor(doc: PDFDocument, page: PDFPage, name: string, cmyk: number[]) {
  const tint = doc.context.register(doc.context.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: cmyk, N: 1 }));
  const resources = page.node.Resources()!;
  let colors = resources.lookupMaybe(PDFName.of('ColorSpace'), PDFDict);
  if (!colors) { colors = doc.context.obj({}); resources.set(PDFName.of('ColorSpace'), colors); }
  colors.set(PDFName.of(name), doc.context.obj([PDFName.of('Separation'), PDFName.of(name), PDFName.of('DeviceCMYK'), tint]));
}

function drawTooling(page: PDFPage, lines: LineMm[], color: string, origin: { x: number; top: number }) {
  const n = (value: number) => PDFNumber.of(value);
  page.pushOperators(
    PDFOperator.of(PDFOperatorNames.PushGraphicsState),
    PDFOperator.of(PDFOperatorNames.SetGraphicsStateParams, [PDFName.of('ToolingOverprint')]),
    PDFOperator.of(PDFOperatorNames.StrokingColorspace, [PDFName.of(color)]),
    PDFOperator.of(PDFOperatorNames.StrokingColorN, [n(1)]),
    PDFOperator.of(PDFOperatorNames.SetLineWidth, [n(pt(0.1))]),
  );
  for (const line of lines) {
    page.pushOperators(
      PDFOperator.of(PDFOperatorNames.MoveTo, [n(pt(origin.x + line.start.x)), n(pt(origin.top - line.start.y))]),
      PDFOperator.of(PDFOperatorNames.LineTo, [n(pt(origin.x + line.end.x)), n(pt(origin.top - line.end.y))]),
      PDFOperator.of(PDFOperatorNames.StrokePath),
    );
  }
  page.pushOperators(PDFOperator.of(PDFOperatorNames.PopGraphicsState));
}

/** All dimensions and paths go straight from mm to PDF points, never via CSS pixels. */
export async function createDielinePdf(input: DielinePdfInput) {
  const { geometry, options, scope, dimensions } = input;
  validatePdfOptions(options);
  validatePdfDimensions(dimensions);
  const margin = 10 + options.bleedMm;
  const footer = options.includeCalibration ? 38 : 23;
  const width = Math.max(125, geometry.bounds.width + 2 * margin);
  const height = geometry.bounds.height + 2 * margin + footer;
  // Standard PDF page dimensions above 200 inches need UserUnit support in every tool.
  if (!Number.isFinite(width + height) || width <= 0 || height <= 0 || Math.max(width, height) > 5080) {
    throw new PdfExportError('This dieline exceeds the supported PDF page size of 5,080 mm. Reduce the box dimensions.');
  }
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  doc.setSubject(`${geometry.kind}; nominal millimetre geometry; ${scope} artwork; print at 100%`);
  doc.setCreator('3D Box Studio');
  doc.setProducer('3D Box Studio - vector dieline PDF');
  const page = doc.addPage([pt(width), pt(height)]);
  page.node.set(PDFName.of('Resources'), doc.context.obj({}));
  const origin = { x: margin, top: height - margin };
  page.setTrimBox(pt(margin), pt(margin + footer), pt(geometry.bounds.width), pt(geometry.bounds.height));
  page.setBleedBox(pt(margin - options.bleedMm), pt(margin + footer - options.bleedMm), pt(geometry.bounds.width + 2 * options.bleedMm), pt(geometry.bounds.height + 2 * options.bleedMm));
  const layers: PDFRef[] = [];
  let minDpi = 300;
  if (options.includeArtwork && input.renderPanel) {
    const begin = addLayer(doc, page, 'Artwork', layers);
    begin();
    for (let i = 0; i < geometry.panels.length; i++) {
      if (i > 0) await yieldToEventLoop();
      const image = await input.renderPanel(i);
      input.onPanelProgress?.(i + 1, geometry.panels.length);
      if (!image) continue;
      const embedded = await embedPanelImage(doc, image);
      minDpi = Math.min(minDpi, image.dpi);
      page.drawImage(embedded, {
        x: pt(origin.x + image.x), y: pt(origin.top - image.y - image.height),
        width: pt(image.width), height: pt(image.height),
      });
    }
    endLayer(page);
  }
  if (options.includeCutCrease) {
    page.node.Resources()!.set(PDFName.of('ExtGState'), doc.context.obj({
      ToolingOverprint: { Type: 'ExtGState', OP: true, op: true, OPM: 1 },
    }));
    addSpotColor(doc, page, 'CutContour', [0, 1, 0, 0]);
    addSpotColor(doc, page, 'Crease', [1, 0, 0, 0]);
    addLayer(doc, page, 'CutContour', layers)();
    drawTooling(page, geometry.cut, 'CutContour', origin);
    endLayer(page);
    addLayer(doc, page, 'Crease', layers)();
    drawTooling(page, geometry.crease, 'Crease', origin);
    endLayer(page);
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  addLayer(doc, page, 'Notes and calibration', layers)();
  const label = geometry.kind === 'cutting-template' ? 'CUTTING TEMPLATE - PRINTER APPROVAL REQUIRED' : 'LAYOUT PROOF - NOT A PRODUCTION DIELINE';
  const printable = (value: string) => value.replace(/[^\x20-\x7E]/g, '?');
  const notes = [
    label,
    `W ${dimensions.width} x H ${dimensions.height} x D ${dimensions.depth} mm | ${scope} | Bleed ${options.bleedMm} mm | Print: Actual size / 100%`,
    ...geometry.notes,
    ...(minDpi < 299 ? [`Artwork raster limited to ${Math.floor(minDpi)} dpi at this size. Vector tooling remains exact.`] : []),
  ];
  let textY = margin + footer - 4;
  for (const note of notes) {
    // Wrap the metadata without changing the physical artwork or page scale.
    let line = '';
    for (const word of printable(note).split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, 6) > pt(width - 2 * margin) && line) {
        page.drawText(line, { x: pt(margin), y: pt(textY), size: 6, font });
        textY -= 3;
        line = word;
      } else line = next;
    }
    page.drawText(line, { x: pt(margin), y: pt(textY), size: 6, font });
    textY -= 3;
  }
  if (options.includeCalibration) {
    const y = Math.min(10, textY - 3);
    page.drawLine({ start: { x: pt(margin), y: pt(y) }, end: { x: pt(margin + 100), y: pt(y) }, thickness: pt(0.15), color: rgb(0, 0, 0) });
    for (let x = 0; x <= 100; x += 10) page.drawLine({
      start: { x: pt(margin + x), y: pt(y - 1) }, end: { x: pt(margin + x), y: pt(y + (x % 50 === 0 ? 2 : 1)) }, thickness: pt(0.15),
    });
    page.drawText('100 mm calibration - measure after printing; disable Fit to page', { x: pt(margin), y: pt(y - 4), size: 6, font });
  }
  endLayer(page);
  doc.catalog.set(PDFName.of('OCProperties'), doc.context.obj({
    OCGs: layers, D: { Order: layers, ON: layers, BaseState: 'ON' },
  }));
  doc.catalog.set(PDFName.of('ViewerPreferences'), doc.context.obj({ PrintScaling: 'None' }));
  return { bytes: await doc.save(), widthMm: width, heightMm: height, minArtworkDpi: minDpi };
}
