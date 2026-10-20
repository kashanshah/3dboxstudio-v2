/* eslint-disable @typescript-eslint/no-require-imports */
// Renders the pictures for the dieline guides from the generator's own
// dielines, so every diagram is a real, correctly drawn box: the guide's
// card picture (public/images/blog/<slug>.webp, 1200×800) and any figures
// inside it (public/images/guides/<name>.webp).
//
//   node scripts/render-guide-images.cjs
//   ONLY=what-is-a-dieline node scripts/render-guide-images.cjs
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.resolve(root, 'src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
const { generateDieline, dielineToSvg, dielineToCricutSvg, LINE_STYLES, LINE_NAMES } = require('../src/lib/dieline/index.ts');

const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif';
const escape = text => text.replace(/[<>&]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char]);

/**
 * A dieline as an SVG element placed in a box, keeping its proportions.
 * Line widths, dashes and text are in millimetres in the file; they are
 * scaled here so lines draw about 2 px wide and labels stay legible whatever
 * the sheet's size.
 */
function placed(svg, box) {
  const [, , vw, vh] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const mmPerPx = Math.max(vw / box.w, vh / box.h);
  const scale = number => Number((number * mmPerPx * 8).toFixed(3));
  return svg.replace(/^<\?xml[^>]*>\s*/, '').replace(/<title>[^<]*<\/title>/, '')
    .replace(/<svg([^>]*?) width="[^"]+" height="[^"]+"/, `<svg$1 x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid meet"`)
    .replace(/stroke-width="([\d.]+)"/g, (_, width) => `stroke-width="${scale(Number(width))}"`)
    .replace(/stroke-dasharray="([\d. ]+)"/g, (_, dash) => `stroke-dasharray="${dash.split(' ').map(value => scale(Number(value) * 0.6)).join(' ')}"`)
    .replace(/font-size="([\d.]+)"/g, (_, size) => `font-size="${Number((Math.max(Number(size), 11 * mmPerPx)).toFixed(2))}"`)
    .replace(/font-family="[^"]*"/g, `font-family="${FONT}"`);
}

function draw({ style, length, width, depth, thickness, units = 'mm', mode = 'inner', options }) {
  return generateDieline({ styleId: style, length, width, depth, thickness, units, dimensionMode: mode, ...(options ? { options } : {}) });
}

function legend(types, x, y) {
  let at = x;
  return types.map(type => {
    const style = LINE_STYLES[type];
    const item = `<line x1="${at}" y1="${y}" x2="${at + 34}" y2="${y}" stroke="${style.color}" stroke-width="4"${style.dash ? ' stroke-dasharray="9 5"' : ''}/><text x="${at + 44}" y="${y + 6}" font-family="${FONT}" font-size="18" fill="#344054">${escape(LINE_NAMES[type])}</text>`;
    at += 64 + LINE_NAMES[type].length * 10;
    return item;
  }).join('');
}

/** Panes side by side, each a dieline with a caption under it, and an optional legend. */
function compose({ width = 1200, height = 800, panes, legendTypes, background = '#f8fafc' }) {
  const top = 40, bottom = legendTypes ? 90 : 40, gap = 40;
  const paneW = (width - 80 - gap * (panes.length - 1)) / panes.length;
  const parts = panes.map((pane, index) => {
    const x = 40 + index * (paneW + gap);
    const box = { x, y: top, w: paneW, h: height - top - bottom - (pane.caption ? 44 : 0) };
    const caption = pane.caption ? `<text x="${x + paneW / 2}" y="${box.y + box.h + 34}" text-anchor="middle" font-family="${FONT}" font-size="21" font-weight="bold" fill="#101828">${escape(pane.caption)}</text>` : '';
    return `<rect x="${x}" y="${top}" width="${paneW}" height="${box.h}" rx="18" fill="#ffffff" stroke="#e4e7ec"/>${placed(pane.svg, { x: x + 18, y: top + 18, w: paneW - 36, h: box.h - 36 })}${caption}`;
  }).join('');
  const key = legendTypes ? legend(legendTypes, 60, height - 46) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${background}"/>${parts}${key}</svg>`;
}

const ALL = ['cut', 'crease', 'glue', 'bleed', 'safe'];
const svgOf = (output, options = {}) => dielineToSvg(output, { showLabels: true, annotations: true, ...options });

const IMAGES = [
  {
    file: 'blog/what-is-a-dieline.webp',
    picture: () => compose({ panes: [{ svg: svgOf(draw({ style: 'reverse-tuck-end', length: 120, width: 55, depth: 180, thickness: 0.46 })), caption: 'A reverse tuck end carton, 120 × 55 × 180 mm' }], legendTypes: ALL }),
  },
  {
    file: 'guides/dieline-anatomy.webp',
    picture: () => compose({ height: 700, panes: [
      { svg: svgOf(draw({ style: 'reverse-tuck-end', length: 70, width: 40, depth: 110, thickness: 0.46 }), { annotations: false }), caption: 'Folding carton: reverse tuck end' },
      { svg: svgOf(draw({ style: 'mailer-box', length: 220, width: 160, depth: 80, thickness: 1.5 }), { annotations: false }), caption: 'Corrugated mailer, FEFCO 0427' },
    ], legendTypes: ALL }),
  },
  {
    file: 'blog/dieline-line-types-and-colors.webp',
    picture: () => compose({ panes: [{ svg: svgOf(draw({ style: 'cake-box', length: 200, width: 200, depth: 100, thickness: 0.5, options: { window: 40 } }), { annotations: false }), caption: 'Every line type on one dieline: a cake box with a window' }], legendTypes: ALL }),
  },
  {
    file: 'blog/paperboard-thickness-chart.webp',
    picture: () => compose({ panes: [
      { svg: svgOf(draw({ style: 'reverse-tuck-end', length: 100, width: 60, depth: 140, thickness: 0.46 }), { layers: ['cut', 'crease'], annotations: true }), caption: '0.46 mm (18 pt) card' },
      { svg: svgOf(draw({ style: 'reverse-tuck-end', length: 100, width: 60, depth: 140, thickness: 1.5 }), { layers: ['cut', 'crease'], annotations: true }), caption: '1.5 mm E-flute, same inside size' },
    ], legendTypes: ['cut', 'crease'] }),
  },
  {
    file: 'blog/fefco-box-codes-explained.webp',
    picture: () => compose({ panes: [
      { svg: svgOf(draw({ style: 'shipping-box-rsc', length: 300, width: 200, depth: 150, thickness: 3 }), { annotations: false }), caption: 'FEFCO 0201: regular slotted carton' },
      { svg: svgOf(draw({ style: 'mailer-box', length: 300, width: 200, depth: 100, thickness: 3 }), { annotations: false }), caption: 'FEFCO 0427: mailer' },
    ], legendTypes: ['cut', 'crease', 'glue', 'bleed'] }),
  },
  {
    file: 'blog/how-to-send-a-dieline-to-a-printer.webp',
    picture: () => compose({ panes: [{ svg: svgOf(draw({ style: 'straight-tuck-end', length: 70, width: 70, depth: 150, thickness: 0.46 })), caption: 'A print-ready dieline: separate layers, bleed, safe zone and sizes' }], legendTypes: ALL }),
  },
  {
    file: 'blog/how-to-make-a-box-with-cricut.webp',
    picture: () => compose({ background: '#e6f2ee', panes: [{ svg: dielineToCricutSvg(draw({ style: 'gable-box', length: 4, width: 2.5, depth: 3.5, thickness: 0.3 / 25.4, units: 'in' }), 'Gable box'), caption: 'A Cricut file: cut lines black, score lines blue, sized in inches' }] }),
  },
];

(async () => {
  const only = process.env.ONLY?.split(',');
  for (const image of IMAGES) {
    const name = path.basename(image.file, '.webp');
    if (only && !only.includes(name)) continue;
    const out = path.join(root, 'public/images', image.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(Buffer.from(image.picture())).webp({ quality: 86, effort: 6 }).toFile(out);
    console.log('wrote', path.relative(root, out));
  }
})();
