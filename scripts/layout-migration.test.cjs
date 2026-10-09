/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { migrateStudioLayout, layoutVersionFor } = require('../src/lib/packaging/layout-migration.ts');
const { reverseTuckPanels, reverseTuckBounds } = require('../src/lib/packaging/reverse-tuck.ts');
const { getTemplateGeometry } = require('../src/lib/packaging/template-runtime.ts');
const { registerTemplateRuntime } = require('../src/lib/packaging/template-runtime.ts');
const { reverseTuckRuntime } = require('../src/lib/packaging/templates/reverse-tuck/runtime.ts');
try { registerTemplateRuntime(reverseTuckRuntime); } catch { /* already registered */ }

// The print file draws each sheet layer into each panel at the layer's
// physical sheet position. These helpers replay that drawing for one point:
// which image coordinate (0–1) lands there, from the topmost layer covering it.
function imageAt(layers, bounds, sheetPoint, panelId) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.panels && !layer.panels.includes(panelId)) continue;
    const t = layer.transform;
    const cx = bounds.width * t.x / 100, cy = bounds.height * t.y / 100;
    const w = bounds.width * t.width / 100, h = bounds.height * t.height / 100;
    const a = -t.rotation * Math.PI / 180, dx = sheetPoint.x - cx, dy = sheetPoint.y - cy;
    const u = (dx * Math.cos(a) - dy * Math.sin(a)) / w + 0.5, v = (dx * Math.sin(a) + dy * Math.cos(a)) / h + 0.5;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return { layer: layer.url, u, v };
  }
  return null;
}

function randomLayers(seed, count) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  return Array.from({ length: count }, (_, i) => ({
    id: `layer-${i}`, name: `Layer ${i}`, url: `/api/media/layer-${i}`, aspectRatio: 1,
    transform: { x: rand() * 100, y: rand() * 100, width: 10 + rand() * 90, height: 10 + rand() * 90, rotation: rand() * 360 - 180 },
  }));
}

const state = (dimensions, outsideArtworkLayers, artworkByPanel = {}) => ({
  version: 1, templateId: 'reverse-tuck-carton', dimensions, material: 'White board', opening: 100,
  measurementUnit: 'mm', artworkByPanel, outsideArtworkLayers, insideArtworkLayers: outsideArtworkLayers,
  mediaAssets: [], outsideColorMode: 'material', insideColorMode: 'material', outsideCustomColor: '#ffffff', insideCustomColor: '#ffffff',
});

test('reverse-tuck designs move onto the cutting-template grid and print exactly as before', () => {
  for (const dimensions of [{ width: 120, height: 180, depth: 55, thickness: 0.5 }, { width: 300, height: 90, depth: 200, thickness: 1 }, { width: 50, height: 150, depth: 30, thickness: 0.4 }]) {
    for (const seed of [1, 7, 42, 1234]) {
      const layers = randomLayers(seed, 4);
      const migrated = migrateStudioLayout(state(dimensions, layers));
      assert.equal(migrated.layoutVersion, 2);
      const oldPanels = reverseTuckPanels(dimensions), oldBounds = reverseTuckBounds(dimensions);
      const { panels, bounds } = getTemplateGeometry('reverse-tuck-carton', dimensions);
      for (const panel of panels) {
        const old = oldPanels.find(item => item.id === panel.id);
        for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
          // A point in the printed panel, in panel-local millimetres.
          const q = { x: panel.width * (0.02 + 0.96 * i / 8), y: panel.height * (0.02 + 0.96 * j / 8) };
          const now = imageAt(migrated.outsideArtworkLayers, bounds, { x: panel.x + q.x, y: panel.y + q.y }, panel.id);
          if (!old) {
            // Closure flaps were unprinted before, and stay so for moved designs.
            assert.equal(now, null, `${panel.id} stays blank`);
            continue;
          }
          // Before: the print file drew the old grid panel, turning the bottom half a turn.
          const turned = panel.id === 'bottom' ? { x: panel.width - q.x, y: panel.height - q.y } : q;
          const before = imageAt(layers, oldBounds, { x: old.x + turned.x, y: old.y + turned.y }, panel.id);
          if (!before) { assert.equal(now, null, `${panel.id} blank at ${q.x},${q.y}`); continue; }
          assert.ok(now, `${panel.id} lost artwork at ${q.x},${q.y}`);
          assert.equal(now.layer, before.layer);
          assert.ok(Math.abs(now.u - before.u) < 1e-6 && Math.abs(now.v - before.v) < 1e-6, `${panel.id} artwork moved at ${q.x},${q.y}`);
        }
      }
      // The inside sheet moves the same way.
      assert.deepEqual(migrated.insideArtworkLayers, migrated.outsideArtworkLayers);
    }
  }
});

test('bottom panel artwork turns half a turn with the panel; other panels are untouched', () => {
  const placement = { name: 'a', url: '/api/media/a', mode: 'fill', scale: 100, rotation: 30, alignX: 1, alignY: -1, panelTexture: true };
  const placed = { ...placement, transform: { x: 30, y: 20, width: 50, height: 40, rotation: 10 } };
  const migrated = migrateStudioLayout(state({ width: 120, height: 180, depth: 55, thickness: 0.5 }, [], { Bottom: placement, 'Interior Bottom': placed, Front: placement }));
  assert.deepEqual(migrated.artworkByPanel.Front, placement);
  assert.equal(migrated.artworkByPanel.Bottom.rotation, -150);
  assert.equal(migrated.artworkByPanel.Bottom.alignX, -1);
  assert.equal(migrated.artworkByPanel.Bottom.alignY, 1);
  assert.deepEqual(migrated.artworkByPanel['Interior Bottom'].transform, { x: 70, y: 80, width: 50, height: 40, rotation: -170 });
});

test('migration runs once, and only for templates whose grid changed', () => {
  const once = migrateStudioLayout(state({ width: 120, height: 180, depth: 55, thickness: 0.5 }, randomLayers(3, 2)));
  assert.deepEqual(migrateStudioLayout(once), once);
  const other = { ...state({ width: 120, height: 180, depth: 55, thickness: 0.5 }, randomLayers(3, 2)), templateId: 'base-box' };
  assert.deepEqual(migrateStudioLayout(other), other);
  assert.equal(layoutVersionFor('base-box'), 1);
  assert.equal(layoutVersionFor('reverse-tuck-carton'), 2);
});
