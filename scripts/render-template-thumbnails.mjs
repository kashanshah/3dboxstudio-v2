// Renders the template-card photos in public/images/templates with the
// Studio's own 3D renderer, so thumbnails always match what the Studio builds.
//
//   npm i --no-save esbuild && node scripts/render-template-thumbnails.mjs
//   ONLY=sleeve-box node scripts/render-template-thumbnails.mjs   (just one)
//
// Needs Chromium (PLAYWRIGHT_BROWSERS_PATH or CHROMIUM_PATH).
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = [
  { id: 'reverse-tuck-carton', mode: 'closed', progress: 86, yaw: 2.3, pitch: 0.7, material: 'White board' },
  { id: 'base-box', mode: 'lid_from_back', progress: 80, yaw: -0.6, pitch: 0.35, material: 'Kraft', zoom: 70 },
  { id: 'split-top-box', mode: 'top_split_meet_center', progress: 85, yaw: -0.6, pitch: 0.35, material: 'Kraft', zoom: 75 },
  { id: 'pizza-box', mode: 'lid_from_back', progress: 85, yaw: -0.6, pitch: 0.35, material: 'Kraft' },
  { id: 'sleeve-box', mode: 'closed', progress: 100, yaw: -0.6, pitch: 0.45, material: 'White board' },
];
// ONLY=sleeve-box,pizza-box renders just those, leaving the other images as they are.
const only = process.env.ONLY?.split(',').map(id => id.trim()).filter(Boolean);
const shots = only?.length ? SHOTS.filter(shot => only.includes(shot.id)) : SHOTS;

const entry = `
import { createCartonRenderer } from '@/components/studio/carton-renderer';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import { templateAssemblyValuesForProgress } from '@/lib/packaging/template-runtime';
const renderer = createCartonRenderer(document.getElementById('c'));
window.show = shot => {
  const values = templateAssemblyValuesForProgress(shot.id, shot.progress, shot.mode);
  renderer.setScene({ dimensions: getPackagingTemplate(shot.id).defaultDimensions, templateId: shot.id, opening: values.opening, formation: values.formation, openingMode: shot.mode, splitTopHingeSide: 'side_a', material: shot.material, outsideColor: null, insideColor: null, artworkByPanel: {}, yaw: shot.yaw, pitch: shot.pitch, zoom: shot.zoom ?? 90, viewPan: { x: 0, y: 0 }, lightIntensity: 0, hoverPanel: null, renderStyle: 'realistic', floorShadow: true });
};`;

const work = await mkdtemp(path.join(tmpdir(), 'thumbs-'));
try {
  const esbuild = await import('esbuild').catch(() => { throw new Error('Install esbuild first: npm i --no-save esbuild'); });
  await writeFile(path.join(work, 'entry.js'), entry);
  await esbuild.build({
    bundle: true, format: 'iife', target: 'es2020', logLevel: 'warning', minify: true,
    entryPoints: [path.join(work, 'entry.js')], outfile: path.join(work, 'bundle.js'),
    alias: { '@': path.join(root, 'src') }, nodePaths: [path.join(root, 'node_modules')],
    plugins: [{ name: 'no-analytics', setup(build) {
      build.onResolve({ filter: /^@\/lib\/analytics$/ }, () => ({ path: 'analytics', namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const trackEvent = () => {};', loader: 'js' }));
    } }],
  });
  await writeFile(path.join(work, 'index.html'), '<!doctype html><body style="margin:0"><canvas id="c" style="width:1200px;height:900px;display:block"></canvas><script src="bundle.js"></script>');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto('file://' + path.join(work, 'index.html'));
  for (const shot of shots) {
    await page.evaluate(value => window.show(value), shot);
    // Let textures and the shadow settle, then draw once more.
    await page.waitForTimeout(1500);
    await page.evaluate(value => window.show(value), shot);
    await page.waitForTimeout(300);
    const png = await page.locator('#c').screenshot({ omitBackground: true });
    const out = path.join(root, 'public/images/templates', `${shot.id}.webp`);
    await sharp(await sharp(png).trim({ threshold: 1 }).toBuffer())
      .resize({ width: 520, height: 420, fit: 'inside' })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(out);
    console.log('wrote', path.relative(root, out));
  }
  await browser.close();
} finally {
  await rm(work, { recursive: true, force: true });
}
