// Renders the short clips the template cards play on hover, into
// public/videos/templates/<id>.mp4, with the Studio's own 3D renderer: the
// box starts as its card picture, opens out to the flat sheet and folds up
// again, so the clip loops and starts and ends exactly on the picture.
//
//   npm i --no-save esbuild && node scripts/render-template-clips.mjs
//   ONLY=pillow-box node scripts/render-template-clips.mjs   (just one)
//
// Needs Chromium (PLAYWRIGHT_BROWSERS_PATH or CHROMIUM_PATH) and ffmpeg with
// libx264, so the clips are H.264 and play in every browser.
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { SHOTS } from './template-shots.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.env.ONLY?.split(',').map(id => id.trim()).filter(Boolean);
const shots = only?.length ? SHOTS.filter(shot => only.includes(shot.id)) : SHOTS;

// The card's picture box: 4:3, with the box set in from its edges as the
// card pads its picture (18 px of a 380 px wide card).
const WIDTH = 640, HEIGHT = 480, PAD = Math.round(18 * WIDTH / 380);
const FPS = 30, SECONDS = 4;

const entry = `
import { createCartonRenderer } from '@/components/studio/carton-renderer';
import { fitZoom } from '@/components/studio/carton-framing';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import { templateAssemblyValuesForProgress } from '@/lib/packaging/template-runtime';
const W = 1200, H = 900;
const canvas = document.getElementById('c');
const renderer = createCartonRenderer(canvas);
const scratch = Object.assign(document.createElement('canvas'), { width: W, height: H });
const out = Object.assign(document.createElement('canvas'), { width: ${WIDTH}, height: ${HEIGHT} });
const scene = (shot, progress) => {
  const template = getPackagingTemplate(shot.id);
  const values = templateAssemblyValuesForProgress(shot.id, progress, shot.mode);
  return { dimensions: template.defaultDimensions, templateId: shot.id, opening: values.opening, formation: values.formation, openingMode: shot.mode, splitTopHingeSide: 'side_a', material: template.defaultMaterial, outsideColor: null, insideColor: null, artworkByPanel: {}, yaw: shot.yaw, pitch: shot.pitch, zoom: 90, viewPan: { x: 0, y: 0 }, lightIntensity: 0, hoverPanel: null, renderStyle: 'realistic', floorShadow: true };
};
// One frame, drawn transparent, and the box of what it shows (shadow included, as the picture is trimmed).
const draw = (shot, progress) => {
  const s = scene(shot, progress);
  renderer.setScene(s);
  renderer.beginCapture(W, H, { kind: 'transparent' });
  try {
    const frame = renderer.captureFrame({ zoom: fitZoom(s, s.pitch, W / H) * 0.9 });
    const context = scratch.getContext('2d', { willReadFrequently: true });
    context.clearRect(0, 0, W, H);
    context.drawImage(frame, 0, 0);
  } finally {
    renderer.endCapture();
  }
  const data = scratch.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] <= 1) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < x0 ? { x: 0, y: 0, w: W, h: H } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};
window.measure = (shot, progress) => draw(shot, progress);
// The frame on the card's background, the box fitted into the padded picture area.
window.compose = (shot, progress, box) => {
  draw(shot, progress);
  const context = out.getContext('2d');
  const background = context.createLinearGradient(0, 0, 0, ${HEIGHT});
  background.addColorStop(0, '#f4f7fb');
  background.addColorStop(1, '#e9eef5');
  context.fillStyle = background;
  context.fillRect(0, 0, ${WIDTH}, ${HEIGHT});
  const scale = Math.min((${WIDTH} - 2 * ${PAD}) / box.w, (${HEIGHT} - 2 * ${PAD}) / box.h);
  const w = box.w * scale, h = box.h * scale;
  context.imageSmoothingQuality = 'high';
  context.drawImage(scratch, box.x, box.y, box.w, box.h, (${WIDTH} - w) / 2, (${HEIGHT} - h) / 2, w, h);
  return out.toDataURL('image/png');
};`;

const ease = t => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
/** Assembly progress at time t (s): hold, open out to flat, a beat, fold up slowly, hold. */
function progressAt(t, closed) {
  if (t < 0.25) return closed;
  if (t < 1.2) return closed * (1 - ease((t - 0.25) / 0.95));
  if (t < 1.5) return 0;
  if (t < 3.5) return closed * ease((t - 1.5) / 2);
  return closed;
}

const work = await mkdtemp(path.join(tmpdir(), 'clips-'));
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
  await mkdir(path.join(root, 'public/videos/templates'), { recursive: true });
  for (const shot of shots) {
    const frames = Array.from({ length: FPS * SECONDS }, (_, i) => progressAt(i / FPS, shot.progress));
    // Let the shadow settle once, then measure every frame and smooth the
    // framing so the box doesn't jitter as its outline changes.
    await page.evaluate(([value, progress]) => window.measure(value, progress), [shot, shot.progress]);
    await page.waitForTimeout(800);
    const boxes = [];
    for (const progress of frames) boxes.push(await page.evaluate(([value, p]) => window.measure(value, p), [shot, progress]));
    const smooth = boxes.map((_, i) => {
      // The first and last frames are the picture exactly; others average their neighbours.
      if (frames[i] === shot.progress) return boxes[i];
      const near = boxes.slice(Math.max(0, i - 3), i + 4);
      const mean = key => near.reduce((sum, box) => sum + box[key], 0) / near.length;
      return { x: mean('x'), y: mean('y'), w: mean('w'), h: mean('h') };
    });
    const dir = path.join(work, shot.id);
    await mkdir(dir);
    for (let i = 0; i < frames.length; i++) {
      const png = await page.evaluate(([value, p, box]) => window.compose(value, p, box), [shot, frames[i], smooth[i]]);
      await writeFile(path.join(dir, `${String(i).padStart(3, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    const out = path.join(root, 'public/videos/templates', `${shot.id}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%03d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-profile:v', 'main',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-movflags', '+faststart', '-an', out]);
    console.log('wrote', path.relative(root, out), `${Math.round(statSync(out).size / 1024)} KB`);
  }
  await browser.close();
} finally {
  await rm(work, { recursive: true, force: true });
}
