import { PDFDocument, StandardFonts, degrees, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Point } from '../geometry';
import type { DielineOutput, LineType } from '../types';
import { LINE_NAMES, LINE_STYLES } from './svg';
import { segmentsOf } from './paths';

// The dieline as a vector PDF at exact size (100%): one page the size of the
// sheet plus a margin, or, for printing at home, tiled across A4 or Letter
// pages with registration marks to tape them together. Every page carries a
// 50 mm scale bar to check the print scale, and a legend of the line types.

const PT_PER_MM = 72 / 25.4;
const PAPER = { a4: { width: 210, height: 297, name: 'A4' }, letter: { width: 215.9, height: 279.4, name: 'Letter' } } as const;
export type PdfPaper = keyof typeof PAPER;

export type PdfOptions = {
  title?: string;
  layers?: LineType[];
  /** Overall width and height labels round the sheet. */
  annotations?: boolean;
  /** Tile across home-printer pages instead of one page the size of the sheet. */
  tile?: PdfPaper;
};

const ORDER: LineType[] = ['bleed', 'safe', 'glue', 'perforation', 'crease', 'cut'];
const MARGIN = 15, LEGEND = 16, TILE_MARGIN = 10, OVERLAP = 10, FOOTER = 9;

const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
const mm = (value: number) => value * PT_PER_MM;

/** Bytes of a PDF of the dieline. */
export async function dielineToPdf(output: DielineOutput, options: PdfOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const title = options.title ?? 'Dieline';
  doc.setTitle(title);
  doc.setCreator('3D Box Studio (3dboxstudio.com)');
  doc.setProducer('3D Box Studio');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const layers = (options.layers ?? ORDER).filter(type => output.paths.some(path => path.type === type && path.d));
  const lines = layers.map(type => ({ type, segments: segmentsOf(output, type) }));
  // The area round the sheet: the bleed (3 mm) and the size labels.
  const pad = 6;
  const sheet = { x: -pad, y: -pad, width: output.bounds.width + 2 * pad, height: output.bounds.height + 2 * pad };

  if (!options.tile) {
    const width = sheet.width + 2 * MARGIN, height = sheet.height + 2 * MARGIN + LEGEND;
    const page = doc.addPage([mm(width), mm(height)]);
    // Sheet point (x, y) in mm, y down, to page points.
    const at = (x: number, y: number) => ({ x: mm(MARGIN + pad + x), y: mm(height - MARGIN - pad - y) });
    drawLines(page, lines, at);
    if (options.annotations) drawSizes(page, font, output, at);
    drawLegend(page, font, layers, title, output, { x: mm(MARGIN), y: mm(MARGIN * 0.6) }, width);
  } else {
    const paper = PAPER[options.tile];
    // Whichever orientation needs fewer pages.
    const orientations = [[paper.width, paper.height], [paper.height, paper.width]].map(([w, h]) => {
      const cw = w - 2 * TILE_MARGIN, ch = h - 2 * TILE_MARGIN - FOOTER;
      const cols = Math.max(1, Math.ceil((sheet.width - OVERLAP) / (cw - OVERLAP))), rows = Math.max(1, Math.ceil((sheet.height - OVERLAP) / (ch - OVERLAP)));
      return { w, h, cw, ch, cols, rows };
    });
    const best = orientations.reduce((a, b) => (b.cols * b.rows < a.cols * a.rows ? b : a));
    for (let row = 0; row < best.rows; row++) for (let col = 0; col < best.cols; col++) {
      const page = doc.addPage([mm(best.w), mm(best.h)]);
      const ox = sheet.x + col * (best.cw - OVERLAP), oy = sheet.y + row * (best.ch - OVERLAP);
      const at = (x: number, y: number) => ({ x: mm(TILE_MARGIN + x - ox), y: mm(best.h - TILE_MARGIN - (y - oy)) });
      // Lines stop at the tile's edge.
      page.pushOperators(pushGraphicsState(), rectangle(mm(TILE_MARGIN), mm(TILE_MARGIN + FOOTER), mm(best.cw), mm(best.ch)), clip(), endPath());
      drawLines(page, lines, at);
      if (options.annotations) drawSizes(page, font, output, at);
      page.pushOperators(popGraphicsState());
      drawRegistration(page, { x: TILE_MARGIN, y: TILE_MARGIN + FOOTER, width: best.cw, height: best.ch });
      const label = `${title} - page ${row * best.cols + col + 1} of ${best.rows * best.cols} (row ${row + 1}, column ${col + 1}). ${paper.name}, print at 100% (actual size). Overlap ${OVERLAP} mm: line up the marks.`;
      page.drawText(label, { x: mm(TILE_MARGIN), y: mm(TILE_MARGIN + 4), size: 6.5, font, color: rgb(0.3, 0.33, 0.38), maxWidth: mm(best.cw - 60) });
      drawScaleBar(page, font, { x: mm(best.w - TILE_MARGIN - 50), y: mm(TILE_MARGIN + 3) });
    }
  }
  return doc.save();
}

function drawLines(page: PDFPage, lines: { type: LineType; segments: [Point, Point][] }[], at: (x: number, y: number) => { x: number; y: number }) {
  for (const { type, segments } of lines) {
    const style = LINE_STYLES[type];
    const dashArray = style.dash?.split(' ').map(Number).map(mm);
    for (const [a, b] of segments) {
      page.drawLine({ start: at(a[0], a[1]), end: at(b[0], b[1]), thickness: Math.max(0.5, mm(style.width)), color: color(style.color), ...(dashArray ? { dashArray } : {}) });
    }
  }
}

function drawSizes(page: PDFPage, font: PDFFont, output: DielineOutput, at: (x: number, y: number) => { x: number; y: number }) {
  const grey = rgb(0.36, 0.4, 0.46);
  const { width, height } = output.bounds;
  const top = at(0, -4.5), topEnd = at(width, -4.5);
  page.drawLine({ start: top, end: topEnd, thickness: 0.4, color: grey });
  const label = `${width.toFixed(1)} mm`;
  page.drawText(label, { x: (top.x + topEnd.x) / 2 - font.widthOfTextAtSize(label, 7) / 2, y: top.y + 2, size: 7, font, color: grey });
  const left = at(-4.5, 0), leftEnd = at(-4.5, height);
  page.drawLine({ start: left, end: leftEnd, thickness: 0.4, color: grey });
  const side = `${height.toFixed(1)} mm`;
  page.drawText(side, { x: left.x - 2, y: (left.y + leftEnd.y) / 2 - font.widthOfTextAtSize(side, 7) / 2, size: 7, font, color: grey, rotate: degrees(90) });
}

function drawLegend(page: PDFPage, font: PDFFont, layers: LineType[], title: string, output: DielineOutput, origin: { x: number; y: number }, pageWidth: number) {
  const grey = rgb(0.3, 0.33, 0.38);
  page.drawText(`${title} - flat size ${output.bounds.width.toFixed(1)} x ${output.bounds.height.toFixed(1)} mm. Print at 100% (actual size); check the scale bar.`, { x: origin.x, y: origin.y + mm(7), size: 7, font, color: grey, maxWidth: mm(pageWidth - 2 * MARGIN) });
  let x = origin.x;
  for (const type of layers) {
    const style = LINE_STYLES[type];
    const dashArray = style.dash?.split(' ').map(Number).map(mm);
    page.drawLine({ start: { x, y: origin.y + mm(1.2) }, end: { x: x + mm(8), y: origin.y + mm(1.2) }, thickness: 1, color: color(style.color), ...(dashArray ? { dashArray } : {}) });
    page.drawText(LINE_NAMES[type], { x: x + mm(10), y: origin.y, size: 6.5, font, color: grey });
    x += mm(12) + font.widthOfTextAtSize(LINE_NAMES[type], 6.5) + mm(4);
  }
  drawScaleBar(page, font, { x: x + mm(2), y: origin.y });
}

/** A 50 mm bar: if it measures 50 mm on paper, the print is at 100%. */
function drawScaleBar(page: PDFPage, font: PDFFont, origin: { x: number; y: number }) {
  const black = rgb(0, 0, 0);
  page.drawLine({ start: { x: origin.x, y: origin.y + mm(1.2) }, end: { x: origin.x + mm(50), y: origin.y + mm(1.2) }, thickness: 0.6, color: black });
  for (const tick of [0, 10, 20, 30, 40, 50]) page.drawLine({ start: { x: origin.x + mm(tick), y: origin.y + mm(0.2) }, end: { x: origin.x + mm(tick), y: origin.y + mm(tick % 50 === 0 ? 2.8 : 2) }, thickness: 0.5, color: black });
  page.drawText('50 mm', { x: origin.x + mm(51.5), y: origin.y, size: 6.5, font, color: black });
}

/** Crosshairs at the tile's corners, where neighbouring pages overlap. */
function drawRegistration(page: PDFPage, area: { x: number; y: number; width: number; height: number }) {
  const black = rgb(0, 0, 0);
  for (const [x, y] of [[area.x, area.y], [area.x + area.width, area.y], [area.x, area.y + area.height], [area.x + area.width, area.y + area.height]]) {
    page.drawLine({ start: { x: mm(x - 3), y: mm(y) }, end: { x: mm(x + 3), y: mm(y) }, thickness: 0.4, color: black });
    page.drawLine({ start: { x: mm(x), y: mm(y - 3) }, end: { x: mm(x), y: mm(y + 3) }, thickness: 0.4, color: black });
    page.drawCircle({ x: mm(x), y: mm(y), size: mm(1.6), borderColor: black, borderWidth: 0.4 });
  }
}
