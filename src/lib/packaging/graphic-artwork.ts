import qrcode from 'qrcode-generator';

// Shapes, QR codes and barcodes. Like text, each is an ordinary artwork
// layer whose image is an SVG drawn from its settings, so the sheet, the 3D
// box, the PDF and the image and video exports all show it with no extra
// code paths. The settings are kept on the layer so it stays editable.

export const SHAPE_KINDS = ['rectangle', 'rounded', 'ellipse', 'triangle', 'star', 'line', 'arrow'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export const BARCODE_FORMATS = ['ean13', 'upca', 'code128'] as const;
export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

export type ShapeSpec = {
  kind: 'shape';
  shape: ShapeKind;
  /** Inside colour; none for an outline. Lines and arrows use the outline colour only. */
  fill: string | null;
  stroke: string | null;
  /** Outline thickness, in mm on the printed box. */
  strokeMm: number;
};

export type QrSpec = { kind: 'qr'; value: string; color: string; background: string | null };

export type BarcodeSpec = {
  kind: 'barcode';
  format: BarcodeFormat;
  value: string;
  color: string;
  background: string | null;
  /** Print the digits or text under the bars. */
  showText: boolean;
};

export type GraphicSpec = ShapeSpec | QrSpec | BarcodeSpec;

export const QR_MAX_LENGTH = 1000;
export const BARCODE_MAX_LENGTH = 48;
export const STROKE_MAX_MM = 20;

export const DEFAULT_SHAPE: ShapeSpec = { kind: 'shape', shape: 'rectangle', fill: '#0f67e8', stroke: null, strokeMm: 1 };
export const DEFAULT_QR: QrSpec = { kind: 'qr', value: 'https://3dboxstudio.com', color: '#111827', background: '#ffffff' };
export const DEFAULT_BARCODE: BarcodeSpec = { kind: 'barcode', format: 'ean13', value: '590123412345', color: '#111827', background: '#ffffff', showText: true };

const HEX = /^#[0-9a-fA-F]{6}$/;
const colour = (value: unknown) => typeof value === 'string' && HEX.test(value);
const optionalColour = (value: unknown) => value === null || colour(value);

/** Whether a stored value is a usable graphic spec (saved designs are checked with this). */
export function isGraphicSpec(value: unknown): value is GraphicSpec {
  if (!value || typeof value !== 'object') return false;
  const spec = value as Record<string, unknown>;
  if (spec.kind === 'shape') {
    return SHAPE_KINDS.includes(spec.shape as ShapeKind) && optionalColour(spec.fill) && optionalColour(spec.stroke)
      && typeof spec.strokeMm === 'number' && Number.isFinite(spec.strokeMm) && spec.strokeMm > 0 && spec.strokeMm <= STROKE_MAX_MM;
  }
  if (spec.kind === 'qr') {
    return typeof spec.value === 'string' && spec.value.length > 0 && spec.value.length <= QR_MAX_LENGTH && colour(spec.color) && optionalColour(spec.background);
  }
  if (spec.kind === 'barcode') {
    return BARCODE_FORMATS.includes(spec.format as BarcodeFormat) && typeof spec.value === 'string' && barcodeError(spec.format as BarcodeFormat, spec.value) === null
      && colour(spec.color) && optionalColour(spec.background) && typeof spec.showText === 'boolean';
  }
  return false;
}

/** A short name for the layer list. */
export function graphicLayerName(spec: GraphicSpec) {
  if (spec.kind === 'qr') return 'QR code';
  if (spec.kind === 'barcode') return `Barcode ${spec.value}`;
  return { rectangle: 'Rectangle', rounded: 'Rounded rectangle', ellipse: 'Ellipse', triangle: 'Triangle', star: 'Star', line: 'Line', arrow: 'Arrow' }[spec.shape];
}

const round = (value: number) => Number(value.toFixed(3));
function toDataUrl(svg: string) {
  if (typeof btoa !== 'function') return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

// ---------------------------------------------------------------- shapes

/** Lines and arrows are drawn in their outline colour, or the fill colour when they have no outline. */
const lineColour = (spec: ShapeSpec) => spec.stroke ?? spec.fill ?? '#111827';

/** Size a new shape is placed at, in mm. */
export function defaultShapeSize(shape: ShapeKind) {
  if (shape === 'line') return { width: 50, height: 6 };
  if (shape === 'arrow') return { width: 50, height: 16 };
  return { width: 30, height: 30 };
}

function starPoints(width: number, height: number, inset: number) {
  const points: [number, number][] = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 ? 0.382 : 1;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return points.map(([x, y]) => `${round(inset + (x - minX) / (maxX - minX) * (width - 2 * inset))},${round(inset + (y - minY) / (maxY - minY) * (height - 2 * inset))}`).join(' ');
}

/**
 * The SVG for a shape drawn at `width` × `height` mm, so outlines keep their
 * thickness however the shape is stretched.
 */
export function shapeSvg(spec: ShapeSpec, width: number, height: number) {
  const w = Math.max(0.1, width), h = Math.max(0.1, height);
  const stroke = Math.min(spec.strokeMm, w / 2, h / 2);
  let body: string;
  if (spec.shape === 'line') {
    const thickness = Math.min(spec.strokeMm, h);
    body = `<rect x="0" y="${round((h - thickness) / 2)}" width="${round(w)}" height="${round(thickness)}" fill="${lineColour(spec)}"/>`;
  } else if (spec.shape === 'arrow') {
    const thickness = Math.min(spec.strokeMm, h);
    const head = Math.min(w * 0.5, h * 0.9);
    const top = (h - thickness) / 2, bottom = (h + thickness) / 2;
    const points = [[0, top], [w - head, top], [w - head, 0], [w, h / 2], [w - head, h], [w - head, bottom], [0, bottom]];
    body = `<polygon points="${points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')}" fill="${lineColour(spec)}"/>`;
  } else {
    const inset = spec.stroke ? stroke / 2 : 0;
    const paint = `fill="${spec.fill ?? 'none'}"${spec.stroke ? ` stroke="${spec.stroke}" stroke-width="${round(stroke)}" stroke-linejoin="round"` : ''}`;
    if (spec.shape === 'ellipse') body = `<ellipse cx="${round(w / 2)}" cy="${round(h / 2)}" rx="${round(w / 2 - inset)}" ry="${round(h / 2 - inset)}" ${paint}/>`;
    else if (spec.shape === 'triangle') body = `<polygon points="${round(w / 2)},${round(inset)} ${round(w - inset)},${round(h - inset)} ${round(inset)},${round(h - inset)}" ${paint}/>`;
    else if (spec.shape === 'star') body = `<polygon points="${starPoints(w, h, inset)}" ${paint}/>`;
    else {
      const radius = spec.shape === 'rounded' ? Math.min(w, h) * 0.18 : 0;
      body = `<rect x="${round(inset)}" y="${round(inset)}" width="${round(w - 2 * inset)}" height="${round(h - 2 * inset)}"${radius ? ` rx="${round(radius)}"` : ''} ${paint}/>`;
    }
  }
  // Drawn about 300 dpi, so exports rasterise it sharply.
  const scale = Math.min(12, 4096 / Math.max(w, h));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round(w * scale)}" height="${round(h * scale)}" viewBox="0 0 ${round(w)} ${round(h)}" preserveAspectRatio="none">${body}</svg>`;
}

// -------------------------------------------------------------- QR codes

const QR_QUIET = 4;
/** Image size of one QR or barcode module, so exports rasterise it sharply. */
const PIXELS_PER_MODULE = 10;

/** The QR code's modules, light quiet zone excluded. Text is encoded as UTF-8. */
export function qrMatrix(value: string) {
  const qr = qrcode(0, 'M');
  // The library reads one byte per character; hand it the UTF-8 bytes that way.
  qr.addData(Array.from(new TextEncoder().encode(value), byte => String.fromCharCode(byte)).join(''), 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (__, col) => qr.isDark(row, col)));
}

export function qrSvg(spec: QrSpec) {
  const matrix = qrMatrix(spec.value);
  const size = matrix.length + 2 * QR_QUIET;
  let path = '';
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (!row[x]) continue;
      let run = 1;
      while (row[x + run]) run += 1;
      path += `M${x + QR_QUIET} ${y + QR_QUIET}h${run}v1h-${run}z`;
      x += run - 1;
    }
  });
  const background = spec.background ? `<rect width="${size}" height="${size}" fill="${spec.background}"/>` : '';
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size * PIXELS_PER_MODULE}" height="${size * PIXELS_PER_MODULE}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${background}<path d="${path}" fill="${spec.color}"/></svg>`, width: size, height: size };
}

// -------------------------------------------------------------- barcodes

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_R = EAN_L.map(code => [...code].map(bit => bit === '1' ? '0' : '1').join(''));
const EAN_G = EAN_R.map(code => [...code].reverse().join(''));
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** The GS1 check digit for the digits before it. */
export function gs1CheckDigit(digits: string) {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const fromRight = digits.length - index;
    sum += Number(digits[index]) * (fromRight % 2 ? 3 : 1);
  }
  return String((10 - sum % 10) % 10);
}

// Code 128 bar and space widths for symbol values 0–106 (106 is Stop).
const CODE128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 '
  + '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 '
  + '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 '
  + '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 '
  + '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 '
  + '114131 311141 411131 211412 211214 211232 2331112').split(' ');
const START_B = 104, START_C = 105, CODE_B = 100, CODE_C = 99;

/** Why a barcode value can't be printed, or null when it can. */
export function barcodeError(format: BarcodeFormat, value: string): string | null {
  if (format === 'code128') {
    if (!value) return 'Enter the text to encode.';
    if (value.length > BARCODE_MAX_LENGTH) return `Use at most ${BARCODE_MAX_LENGTH} characters.`;
    return /^[\x20-\x7e]+$/.test(value) ? null : 'Code 128 takes letters, digits, spaces and standard punctuation only.';
  }
  const length = format === 'ean13' ? 13 : 12;
  if (!/^\d+$/.test(value)) return 'Use digits only.';
  if (value.length !== length - 1 && value.length !== length) return `Enter ${length - 1} digits (the check digit is added), or all ${length}.`;
  if (value.length === length && gs1CheckDigit(value.slice(0, -1)) !== value.slice(-1)) return `The last digit should be ${gs1CheckDigit(value.slice(0, -1))}.`;
  return null;
}

/** The full number printed, with its check digit. */
export function barcodeDigits(format: 'ean13' | 'upca', value: string) {
  const length = format === 'ean13' ? 13 : 12;
  return value.length === length ? value : value + gs1CheckDigit(value);
}

/** Code 128 symbol values for the text, starting in set B and using set C for runs of digits. */
export function code128Values(text: string) {
  const values: number[] = [];
  let set: 'B' | 'C' | null = null;
  let index = 0;
  while (index < text.length) {
    const run = /^\d*/.exec(text.slice(index))![0].length;
    // Digit pairs are worth a switch to set C when there are enough of them.
    const useC = run >= 4 && (index === 0 || index + run === text.length || run >= 6);
    if (useC) {
      const pairs = Math.floor(run / 2);
      // An odd run leaves its first digit in set B.
      if (run % 2) {
        if (set !== 'B') { values.push(set === null ? START_B : CODE_B); set = 'B'; }
        values.push(text.charCodeAt(index) - 32);
        index += 1;
      }
      if (set !== 'C') { values.push(set === null ? START_C : CODE_C); set = 'C'; }
      for (let pair = 0; pair < pairs; pair += 1, index += 2) values.push(Number(text.slice(index, index + 2)));
    } else {
      if (set !== 'B') { values.push(set === null ? START_B : CODE_B); set = 'B'; }
      values.push(text.charCodeAt(index) - 32);
      index += 1;
    }
  }
  const check = values.reduce((sum, value, position) => sum + value * Math.max(1, position), 0) % 103;
  return [...values, check, 106];
}

/** The bars as a string of modules: 1 is a bar, 0 a space. */
export function code128Modules(text: string) {
  return code128Values(text).map(value => [...CODE128[value]].map((width, index) => (index % 2 ? '0' : '1').repeat(Number(width))).join('')).join('');
}

/** EAN-13 modules, from the first guard bar to the last. */
export function ean13Modules(digits: string) {
  const parity = EAN_PARITY[Number(digits[0])];
  let modules = '101';
  for (let index = 1; index <= 6; index += 1) modules += (parity[index - 1] === 'L' ? EAN_L : EAN_G)[Number(digits[index])];
  modules += '01010';
  for (let index = 7; index <= 12; index += 1) modules += EAN_R[Number(digits[index])];
  return modules + '101';
}

/** Barcodes are drawn in modules, sized so one module is this many mm (100% magnification). */
export const BARCODE_MODULE_MM = 0.33;
const BAR_HEIGHT = 69;
const GUARD_EXTRA = 5;
const TEXT_SIZE = 9;
const MARGIN = 3;

export function barcodeSvg(spec: BarcodeSpec) {
  // Bars as [start, end, long] spans, in modules from the start of the bars.
  const spans = (modules: string, long: (index: number) => boolean) => {
    const result: [number, number, boolean][] = [];
    for (let index = 0; index < modules.length; index += 1) {
      if (modules[index] !== '1') continue;
      let end = index;
      while (modules[end + 1] === '1') end += 1;
      result.push([index, end + 1, long(index)]);
      index = end;
    }
    return result;
  };
  let left: number, right: number, bars: [number, number, boolean][], barHeight: number;
  const labels: { x: number; text: string; size: number; anchor: string }[] = [];
  if (spec.format === 'code128') {
    const modules = code128Modules(spec.value);
    left = 10; right = 10; barHeight = Math.max(50, Math.round(modules.length * 0.15));
    bars = spans(modules, () => false);
    if (spec.showText) labels.push({ x: left + modules.length / 2, text: spec.value, size: TEXT_SIZE, anchor: 'middle' });
  } else {
    const digits = barcodeDigits(spec.format, spec.value);
    const ean = spec.format === 'ean13' ? digits : `0${digits}`;
    const modules = ean13Modules(ean);
    const upc = spec.format === 'upca';
    left = 11; right = upc ? 11 : 7; barHeight = BAR_HEIGHT;
    // Guard bars, and the first and last digits of a UPC-A, reach into the text row.
    const isLong = (index: number) => index < 3 || (index >= 45 && index < 50) || index >= 92 || (upc && (index < 10 || index >= 85));
    bars = spans(modules, index => spec.showText && isLong(index));
    if (spec.showText) {
      const at = (group: 0 | 1, position: number) => left + 3 + group * 47 + 7 * position + 3.5;
      if (upc) {
        labels.push({ x: left - 2, text: digits[0], size: TEXT_SIZE * 0.75, anchor: 'end' });
        for (let index = 1; index < 6; index += 1) labels.push({ x: at(0, index), text: digits[index], size: TEXT_SIZE, anchor: 'middle' });
        for (let index = 6; index < 11; index += 1) labels.push({ x: at(1, index - 6), text: digits[index], size: TEXT_SIZE, anchor: 'middle' });
        labels.push({ x: left + 95 + 2, text: digits[11], size: TEXT_SIZE * 0.75, anchor: 'start' });
      } else {
        labels.push({ x: left - 2, text: digits[0], size: TEXT_SIZE, anchor: 'end' });
        for (let index = 1; index < 13; index += 1) labels.push({ x: at(index < 7 ? 0 : 1, (index - 1) % 6), text: digits[index], size: TEXT_SIZE, anchor: 'middle' });
      }
    }
  }
  const barsWidth = bars.length ? bars[bars.length - 1][1] : 0;
  const width = left + barsWidth + right;
  const textRow = spec.showText ? TEXT_SIZE + 1 : 0;
  const height = MARGIN + barHeight + textRow + MARGIN;
  const path = bars.map(([start, end, long]) => `M${left + start} ${MARGIN}h${end - start}v${barHeight + (long ? GUARD_EXTRA : 0)}h-${end - start}z`).join('');
  const escape = (text: string) => text.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);
  const text = labels.map(label => `<text x="${round(label.x)}" y="${MARGIN + barHeight + TEXT_SIZE}" font-size="${round(label.size)}" text-anchor="${label.anchor}">${escape(label.text)}</text>`).join('');
  const background = spec.background ? `<rect width="${width}" height="${height}" fill="${spec.background}"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * PIXELS_PER_MODULE}" height="${height * PIXELS_PER_MODULE}" viewBox="0 0 ${width} ${height}">${background}`
    + `<path d="${path}" fill="${spec.color}" shape-rendering="crispEdges"/>`
    + (text ? `<g font-family="Arial, Helvetica, sans-serif" fill="${spec.color}" xml:space="preserve">${text}</g>` : '')
    + '</svg>';
  return { svg, width, height };
}

// ------------------------------------------------------------- rendering

/**
 * Draws a graphic as an artwork image. Shapes are drawn at `sizeMm` (their
 * size on the sheet); QR codes and barcodes keep their own proportions.
 * Returns the image, its width / height ratio and the size it is drawn at
 * (mm for shapes and barcodes at 100%, modules for QR codes).
 */
export function renderGraphic(spec: GraphicSpec, sizeMm?: { width: number; height: number }) {
  if (spec.kind === 'shape') {
    const size = sizeMm ?? defaultShapeSize(spec.shape);
    return { url: toDataUrl(shapeSvg(spec, size.width, size.height)), aspectRatio: size.width / size.height, width: size.width, height: size.height };
  }
  const drawn = spec.kind === 'qr' ? qrSvg(spec) : barcodeSvg(spec);
  return { url: toDataUrl(drawn.svg), aspectRatio: drawn.width / drawn.height, width: drawn.width, height: drawn.height };
}

/** Size a new graphic is placed at, in mm. */
export function defaultGraphicSize(spec: GraphicSpec) {
  if (spec.kind === 'shape') return defaultShapeSize(spec.shape);
  if (spec.kind === 'qr') return { width: 25, height: 25 };
  const drawn = barcodeSvg(spec);
  return { width: drawn.width * BARCODE_MODULE_MM, height: drawn.height * BARCODE_MODULE_MM };
}
