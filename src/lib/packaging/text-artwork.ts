// Text layers. A text layer is an ordinary artwork layer whose image is an
// SVG drawn from its text settings, with the font embedded, so the 2D sheet,
// the 3D box, the PDF and the image and video exports all show the same
// letters with no extra code paths. The settings are kept on the layer so
// the text stays editable.

export type TextAlign = 'left' | 'center' | 'right';

export type TextSpec = {
  content: string;
  font: TextFontId;
  bold: boolean;
  color: string;
  align: TextAlign;
  /** Extra space between letters, in em. */
  letterSpacing: number;
  /** Distance between lines, as a multiple of the font size. */
  lineHeight: number;
};

/** Fonts shipped in public/fonts/text (SIL Open Font License, latin subset). */
export const TEXT_FONTS = [
  { id: 'manrope', label: 'Manrope', style: 'Sans', bold: true },
  { id: 'montserrat', label: 'Montserrat', style: 'Sans', bold: true },
  { id: 'oswald', label: 'Oswald', style: 'Condensed', bold: true },
  { id: 'bebas-neue', label: 'Bebas Neue', style: 'Display', bold: false },
  { id: 'playfair-display', label: 'Playfair Display', style: 'Serif', bold: true },
  { id: 'lora', label: 'Lora', style: 'Serif', bold: true },
  { id: 'dancing-script', label: 'Dancing Script', style: 'Script', bold: true },
  { id: 'great-vibes', label: 'Great Vibes', style: 'Script', bold: false },
  { id: 'space-mono', label: 'Space Mono', style: 'Mono', bold: true },
] as const;

export type TextFontId = (typeof TEXT_FONTS)[number]['id'];

export const TEXT_MAX_LENGTH = 500;

export const DEFAULT_TEXT_SPEC: TextSpec = {
  content: 'Your text',
  font: 'montserrat',
  bold: true,
  color: '#111827',
  align: 'center',
  letterSpacing: 0,
  lineHeight: 1.2,
};

const FONT_IDS = new Set<string>(TEXT_FONTS.map(font => font.id));
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Whether a stored value is a usable text spec (saved designs are checked with this). */
export function isTextSpec(value: unknown): value is TextSpec {
  if (!value || typeof value !== 'object') return false;
  const spec = value as Partial<TextSpec>;
  return typeof spec.content === 'string' && spec.content.length <= TEXT_MAX_LENGTH
    && typeof spec.font === 'string' && FONT_IDS.has(spec.font)
    && typeof spec.bold === 'boolean'
    && typeof spec.color === 'string' && HEX.test(spec.color)
    && (spec.align === 'left' || spec.align === 'center' || spec.align === 'right')
    && typeof spec.letterSpacing === 'number' && Number.isFinite(spec.letterSpacing) && spec.letterSpacing >= -0.2 && spec.letterSpacing <= 1
    && typeof spec.lineHeight === 'number' && Number.isFinite(spec.lineHeight) && spec.lineHeight >= 0.6 && spec.lineHeight <= 3;
}

/** The weight a font actually has: fonts with one weight ignore Bold. */
export function textWeight(spec: Pick<TextSpec, 'font' | 'bold'>) {
  const font = TEXT_FONTS.find(item => item.id === spec.font);
  return spec.bold && font?.bold ? 700 : 400;
}

/** The text's lines; an empty layer still has one line so it stays selectable. */
export function textLines(content: string) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  return lines.length ? lines : [''];
}

/** A short name for the layer list. */
export function textLayerName(content: string) {
  const first = textLines(content).find(line => line.trim())?.trim() ?? '';
  return first ? (first.length > 32 ? `${first.slice(0, 31)}…` : first) : 'Text';
}

const escapeXml = (text: string) => text.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);

/** Font size the SVG is drawn at; the layer's transform scales it on the sheet. */
const SIZE = 100;
/** Room around the letters for script swashes and accents. */
const PAD = 0.12 * SIZE;

export type TextMetrics = { lineWidths: number[]; ascent: number; descent: number };

/** The SVG for a text layer; `fontData` is the font file as base64. */
export function textSvg(spec: TextSpec, metrics: TextMetrics, fontData: string) {
  const lines = textLines(spec.content);
  const weight = textWeight(spec);
  const lineStep = spec.lineHeight * SIZE;
  const inkWidth = Math.max(SIZE * 0.3, ...metrics.lineWidths);
  const width = inkWidth + 2 * PAD;
  const height = (lines.length - 1) * lineStep + metrics.ascent + metrics.descent + 2 * PAD;
  const anchor = spec.align === 'left' ? 'start' : spec.align === 'right' ? 'end' : 'middle';
  const x = spec.align === 'left' ? PAD : spec.align === 'right' ? width - PAD : width / 2;
  const round = (value: number) => Number(value.toFixed(2));
  const tspans = lines.map((line, index) => `<tspan x="${round(x)}" y="${round(PAD + metrics.ascent + index * lineStep)}">${escapeXml(line) || ' '}</tspan>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}">`
    + `<defs><style>@font-face{font-family:"bx";src:url(data:font/woff2;base64,${fontData}) format("woff2");font-weight:${weight};}</style></defs>`
    + `<text font-family="bx" font-size="${SIZE}" font-weight="${weight}" fill="${spec.color}" letter-spacing="${round(spec.letterSpacing * SIZE)}" text-anchor="${anchor}" xml:space="preserve">${tspans}</text></svg>`;
  return { svg, width, height };
}

const fontFiles = new Map<string, Promise<string>>();
const fontFaces = new Map<string, Promise<string>>();

const fontFile = (spec: Pick<TextSpec, 'font' | 'bold'>) => `/fonts/text/${spec.font}-${textWeight(spec)}.woff2`;

function base64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

/** The font file as base64 (fetched once) and its family name in this document, for measuring. */
async function loadFont(spec: Pick<TextSpec, 'font' | 'bold'>) {
  const file = fontFile(spec);
  let data = fontFiles.get(file);
  if (!data) {
    data = fetch(file).then(response => {
      if (!response.ok) throw new Error('Could not load the font.');
      return response.arrayBuffer();
    }).then(base64);
    data.catch(() => fontFiles.delete(file));
    fontFiles.set(file, data);
  }
  let family = fontFaces.get(file);
  if (!family) {
    family = data.then(async encoded => {
      const name = `bx-text-${spec.font}-${textWeight(spec)}`;
      const face = new FontFace(name, `url(data:font/woff2;base64,${encoded})`, { weight: String(textWeight(spec)) });
      document.fonts.add(await face.load());
      return name;
    });
    family.catch(() => fontFaces.delete(file));
    fontFaces.set(file, family);
  }
  return { data: await data, family: await family };
}

/**
 * Draws a text spec as an artwork image: an SVG data URL with the font
 * embedded, and its width / height ratio.
 */
export async function renderTextArtwork(spec: TextSpec): Promise<{ url: string; aspectRatio: number; width: number; height: number }> {
  const { data, family } = await loadFont(spec);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not measure the text.');
  context.font = `${textWeight(spec)} ${SIZE}px "${family}"`;
  const lines = textLines(spec.content);
  const lineWidths = lines.map(line => {
    const measured = context.measureText(line);
    const spacing = spec.letterSpacing * SIZE * Math.max(0, [...line].length - 1);
    // Script letters can reach past their advance; keep the ink in the box.
    const ink = Math.max(measured.width, (measured.actualBoundingBoxLeft ?? 0) + (measured.actualBoundingBoxRight ?? 0));
    return ink + spacing;
  });
  const reference = context.measureText('ÁHgjy');
  const ascent = Math.max(reference.fontBoundingBoxAscent ?? 0, reference.actualBoundingBoxAscent ?? 0, SIZE * 0.8);
  const descent = Math.max(reference.fontBoundingBoxDescent ?? 0, reference.actualBoundingBoxDescent ?? 0, SIZE * 0.2);
  const { svg, width, height } = textSvg(spec, { lineWidths, ascent, descent }, data);
  const url = `data:image/svg+xml;base64,${base64(new TextEncoder().encode(svg).buffer as ArrayBuffer)}`;
  return { url, aspectRatio: width / height, width, height };
}
