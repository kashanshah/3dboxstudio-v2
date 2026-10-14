/* eslint-disable @typescript-eslint/no-require-imports */
// Renders a 1200×630 social preview image for each box template page into
// public/og/templates/<slug>.png: the template's name, what the page offers,
// its dieline and its 3D thumbnail (public/images/templates).
//
//   node scripts/render-template-og.cjs
//   ONLY=auto-lock-bottom-box node scripts/render-template-og.cjs   (just one page)
//
// Run it after adding a template page or re-rendering a thumbnail. Text is set
// in Inter Display when the system has it.
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
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { BOX_TEMPLATE_PAGES } = require('../src/content/box-template-pages.ts');
const { templatePreviewGeometry } = require('../src/lib/packaging/template-preview.ts');
const { getPackagingTemplate } = require('../src/lib/packaging/template-registry.ts');

const W = 1200, H = 630;
const FONT = "'Inter Display', 'Inter', 'Helvetica Neue', Arial, sans-serif";
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Splits `text` into lines of at most `max` characters, at spaces. */
function wrap(text, max) {
  const lines = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= max) lines[lines.length - 1] = last + ' ' + word;
    else lines.push(word);
  }
  return lines;
}

/** The template's cutting template, drawn faintly into a box. */
function dieline(geometry, box) {
  const s = Math.min(box.w / geometry.bounds.width, box.h / geometry.bounds.height);
  const ox = box.x + (box.w - geometry.bounds.width * s) / 2, oy = box.y + (box.h - geometry.bounds.height * s) / 2;
  const line = l => `<line x1="${(ox + l.start.x * s).toFixed(1)}" y1="${(oy + l.start.y * s).toFixed(1)}" x2="${(ox + l.end.x * s).toFixed(1)}" y2="${(oy + l.end.y * s).toFixed(1)}"/>`;
  return `<g stroke="#9fc3e6" stroke-width="1.6" stroke-dasharray="6 4" fill="none">${geometry.crease.map(line).join('')}</g>
    <g stroke="#b9c6d6" stroke-width="1.6" fill="none">${geometry.cut.map(line).join('')}</g>`;
}

async function render(page) {
  const template = getPackagingTemplate(page.templateId);
  const geometry = templatePreviewGeometry(page.templateId, template.defaultDimensions);
  const title = wrap(page.h1, 18).slice(0, 3);
  const titleSize = title.length > 2 ? 56 : 64;
  const titleTop = 214;
  const titleSvg = title.map((line, i) => `<text x="64" y="${titleTop + i * titleSize * 1.08}" font-family="${FONT}" font-size="${titleSize}" font-weight="700" letter-spacing="-1.5" fill="#0f172a">${escape(line)}</text>`).join('');
  const below = titleTop + (title.length - 1) * titleSize * 1.08 + 58;
  const chips = ['Free', 'Any size', 'Fold it in 3D'];
  let chipX = 64;
  const chipSvg = chips.map(label => {
    const width = 28 + label.length * 10.5;
    const svg = `<rect x="${chipX}" y="512" width="${width}" height="40" rx="20" fill="#ffffff" stroke="#cfe1f3"/><text x="${chipX + width / 2}" y="538" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="600" fill="#0b5fa8">${label}</text>`;
    chipX += width + 12;
    return svg;
  }).join('');
  const logo = fs.readFileSync(path.join(root, 'public/brand/logo-horizontal-light.svg'), 'utf8')
    .replace(/<\?xml[^>]*>/, '').replace(/width="[^"]*" height="[^"]*"/, 'width="180" height="47.5"');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#e6ebf2" stroke-width="1"/></pattern>
      <linearGradient id="card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef3f9"/></linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#1b2a3c" flood-opacity="0.14"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="#f6f8fb"/><rect width="${W}" height="${H}" fill="url(#grid)"/>
    <g transform="translate(64 52)">${logo}</g>
    <text x="64" y="152" font-family="${FONT}" font-size="18" font-weight="700" letter-spacing="2.5" fill="#168de2">FREE BOX TEMPLATE &amp; DIELINE</text>
    ${titleSvg}
    <text x="64" y="${below}" font-family="${FONT}" font-size="25" fill="#475569">Enter your size, design it on the dieline,</text>
    <text x="64" y="${below + 34}" font-family="${FONT}" font-size="25" fill="#475569">export a 1:1 PDF, SVG or DXF.</text>
    ${chipSvg}
    <rect x="660" y="56" width="484" height="518" rx="22" fill="url(#card)" filter="url(#shadow)"/>
    ${dieline(geometry, { x: 690, y: 86, w: 424, h: 458 })}
    <text x="${W - 64}" y="${H - 22}" text-anchor="end" font-family="${FONT}" font-size="16" fill="#64748b">www.3dboxstudio.com</text>
  </svg>`;
  const thumb = await sharp(path.join(root, 'public/images/templates', `${page.templateId}.webp`)).resize({ width: 400, height: 420, fit: 'inside' }).toBuffer();
  const meta = await sharp(thumb).metadata();
  const out = path.join(root, 'public/og/templates', `${page.slug}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(svg))
    .composite([{ input: thumb, left: Math.round(902 - meta.width / 2), top: Math.round(315 - meta.height / 2) }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(out);
  console.log('wrote', path.relative(root, out));
}

(async () => {
  const only = process.env.ONLY?.split(',').map(slug => slug.trim()).filter(Boolean);
  for (const page of BOX_TEMPLATE_PAGES) if (!only?.length || only.includes(page.slug)) await render(page);
})();
