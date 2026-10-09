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
const { migrateStudioLayout, migrateStudioLayoutTo, layoutVersionFor } = require('../src/lib/packaging/layout-migration.ts');
const { reverseTuckSheetV2 } = require('../src/lib/packaging/templates/reverse-tuck/sheet-v2.ts');
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
      // Layout versions 2–4 share one cutting template (frozen in sheet-v2).
      const migrated = migrateStudioLayoutTo(state(dimensions, layers), 4);
      assert.equal(migrated.layoutVersion, 4);
      const oldPanels = reverseTuckPanels(dimensions), oldBounds = reverseTuckBounds(dimensions);
      const { panels, bounds } = reverseTuckSheetV2(dimensions);
      for (const panel of panels) {
        const old = oldPanels.find(item => item.id === panel.id);
        // Every panel but the bottom moved down by the top tuck's height.
        const shift = panels.find(item => item.id === 'top').y - oldPanels.find(item => item.id === 'top').y;
        // Whether the old bottom printed any layer, which it then keeps.
        const bottomPrinted = migrated.outsideArtworkLayers.some(layer => layer.id.endsWith('-bottom'));
        for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
          // A point in the printed panel, in panel-local millimetres.
          const q = { x: panel.width * (0.02 + 0.96 * i / 8), y: panel.height * (0.02 + 0.96 * j / 8) };
          const now = imageAt(migrated.outsideArtworkLayers, bounds, { x: panel.x + q.x, y: panel.y + q.y }, panel.id);
          // Before, the print file drew the old grid panel, turning the bottom
          // half a turn. Flaps the old grid lacked, and a bottom it printed
          // blank, now print what the layers hold there, moved with the body.
          const before = panel.id === 'bottom' && bottomPrinted
            ? imageAt(layers, oldBounds, { x: old.x + panel.width - q.x, y: old.y + panel.height - q.y }, panel.id)
            : imageAt(layers, oldBounds, { x: panel.x + q.x, y: panel.y + q.y - shift }, panel.id);
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

// Where in a panel's own artwork (0–1) a panel-local point (0–100 %) prints,
// given the artwork's placement and how far the panel turns it on the sheet.
function panelArtworkAt(transform, turned, q) {
  const p = turned ? { x: 100 - q.x, y: 100 - q.y } : q;
  const a = -transform.rotation * Math.PI / 180, dx = p.x - transform.x, dy = p.y - transform.y;
  return { u: (dx * Math.cos(a) - dy * Math.sin(a)) / transform.width + 0.5, v: (dx * Math.sin(a) + dy * Math.cos(a)) / transform.height + 0.5 };
}

test('artwork placed on single panels keeps printing exactly as before', () => {
  const dimensions = { width: 305, height: 45, depth: 305, thickness: 1.5 };
  // Before: the reverse tuck's print file turned the bottom; nothing else turned.
  const cases = [['reverse-tuck-carton', ['Bottom'], ['Front', 'Top']], ['pizza-box', [], ['Front', 'Top', 'Lid Front', 'Back', 'Bottom', 'Left']]];
  for (const [templateId, turnedBefore, plainBefore] of cases) {
    const artwork = {};
    [...turnedBefore, ...plainBefore].forEach((name, i) => {
      for (const key of [name, `Interior ${name}`]) artwork[key] = { name: key, url: `/api/media/${i}`, mode: 'fill', scale: 100, rotation: 0, alignX: 0, alignY: 0, panelTexture: true, transform: { x: 30 + i * 7, y: 60 - i * 5, width: 70, height: 45, rotation: 15 * i - 20 } };
    });
    const migrated = migrateStudioLayout({ ...state(dimensions, [], artwork), templateId });
    assert.equal(migrated.layoutVersion, layoutVersionFor(templateId));
    const panels = getTemplateGeometry(templateId, dimensions).panels;
    for (const key of Object.keys(artwork)) {
      const name = key.replace(/^Interior /, '');
      const panel = panels.find(item => item.label.toLowerCase() === name.toLowerCase());
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
        const q = { x: 2 + i * 16, y: 2 + j * 16 };
        const before = panelArtworkAt(artwork[key].transform, turnedBefore.includes(name), q);
        const now = panelArtworkAt(migrated.artworkByPanel[key].transform, panel.artworkRotation === 180, q);
        assert.ok(Math.abs(before.u - now.u) < 1e-9 && Math.abs(before.v - now.v) < 1e-9, `${templateId} ${key} prints the same at ${q.x},${q.y}`);
      }
    }
  }
});

test('legacy panel placements turn with their panel', () => {
  const placement = { name: 'a', url: '/api/media/a', mode: 'fill', scale: 100, rotation: 30, alignX: 1, alignY: -1, panelTexture: true };
  const migrated = migrateStudioLayout({ ...state({ width: 305, height: 45, depth: 305, thickness: 1.5 }, [], { Front: placement, Back: placement }), templateId: 'pizza-box' });
  assert.deepEqual(migrated.artworkByPanel.Back, placement);
  assert.equal(migrated.artworkByPanel.Front.rotation, -150);
  assert.equal(migrated.artworkByPanel.Front.alignX, -1);
  assert.equal(migrated.artworkByPanel.Front.alignY, 1);
});

test('migration runs once, and only for templates whose grid changed', () => {
  const once = migrateStudioLayout(state({ width: 120, height: 180, depth: 55, thickness: 0.5 }, randomLayers(3, 2)));
  assert.deepEqual(migrateStudioLayout(once), once);
  assert.equal(layoutVersionFor('split-top-box'), 2);
  assert.equal(layoutVersionFor('base-box'), 2);
  assert.equal(layoutVersionFor('reverse-tuck-carton'), 5);
  assert.equal(layoutVersionFor('pizza-box'), 2);
  // A design already on version 2 of the reverse tuck takes only the later steps.
  const bottom = { name: 'b', url: '/api/media/b', mode: 'fill', scale: 100, rotation: 0, alignX: 0, alignY: 0, transform: { x: 20, y: 30, width: 50, height: 50, rotation: 0 } };
  const v2 = { ...state({ width: 120, height: 180, depth: 55, thickness: 0.5 }, randomLayers(5, 2), { Bottom: bottom }), layoutVersion: 2 };
  const v3 = migrateStudioLayoutTo(v2, 4);
  assert.deepEqual(v3.outsideArtworkLayers, v2.outsideArtworkLayers);
  assert.deepEqual(v3.artworkByPanel.Bottom.transform, { x: 80, y: 70, width: 50, height: 50, rotation: 180 });
  assert.equal(v3.layoutVersion, 4);
  assert.equal(migrateStudioLayout(v2).layoutVersion, 5);
});

test('reverse-tuck layers moved earlier print on the flaps they cover, and the bottom prints as before', () => {
  const dimensions = { width: 120, height: 180, depth: 55, thickness: 0.5 };
  const [body, turned] = randomLayers(11, 2);
  // As saved after the move to the cutting template (version 3).
  const v3 = { ...state(dimensions, [{ ...body, panels: ['glue', 'left', 'front', 'right', 'back', 'top'] }, { ...turned, id: `${body.id}-bottom`, panels: ['bottom'] }]), layoutVersion: 3 };
  const v4 = migrateStudioLayoutTo(v3, 4);
  assert.equal(v4.layoutVersion, 4);
  const ids = reverseTuckSheetV2(dimensions).panels.map(panel => panel.id);
  assert.deepEqual(v4.outsideArtworkLayers[0].panels, ids.filter(id => id !== 'bottom'));
  assert.deepEqual(v4.outsideArtworkLayers[1].panels, ['bottom']);
  assert.deepEqual(v4.outsideArtworkLayers.map(layer => layer.transform), v3.outsideArtworkLayers.map(layer => layer.transform));
  assert.deepEqual(v4.insideArtworkLayers, v4.outsideArtworkLayers);
  // With nothing printed on the old bottom, the layer prints everywhere it covers.
  const blankBottom = migrateStudioLayoutTo({ ...state(dimensions, [{ ...body, panels: ['glue', 'left', 'front', 'right', 'back', 'top'] }]), layoutVersion: 3 }, 4);
  assert.equal(blankBottom.outsideArtworkLayers[0].panels, undefined);
});

test('reverse-tuck designs keep their artwork on every panel of the locking die', () => {
  for (const dimensions of [{ width: 120, height: 180, depth: 55, thickness: 0.5 }, { width: 270, height: 430, depth: 28, thickness: 0.5 }, { width: 60, height: 150, depth: 60, thickness: 1 }]) {
    // One image at a time, so overlapping images' edges don't blur the check.
    for (const seed of [1, 7, 42, 99, 1234, 2024]) {
      const v4 = migrateStudioLayoutTo(state(dimensions, randomLayers(seed, 1)), 4);
      const v5 = migrateStudioLayout(v4);
      assert.equal(v5.layoutVersion, 5);
      const before = reverseTuckSheetV2(dimensions), after = getTemplateGeometry('reverse-tuck-carton', dimensions);
      for (const panel of after.panels.filter(item => ['left', 'front', 'right', 'back', 'top', 'bottom'].includes(item.id))) {
        const old = before.panels.find(item => item.id === panel.id);
        for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
          // The same place on the panel, before and after.
          const u = 0.03 + 0.94 * i / 6, v = 0.03 + 0.94 * j / 6;
          const was = imageAt(v4.outsideArtworkLayers, before.bounds, { x: old.x + u * old.width, y: old.y + v * old.height }, panel.id);
          const now = imageAt(v5.outsideArtworkLayers, after.bounds, { x: panel.x + u * panel.width, y: panel.y + v * panel.height }, panel.id);
          if (!was || !now) {
            // Only right at an image's edge may coverage change.
            const hit = was ?? now, layers = was ? v4.outsideArtworkLayers : v5.outsideArtworkLayers, bounds = was ? before.bounds : after.bounds;
            if (!hit) continue;
            const t = layers.find(item => item.url === hit.layer).transform;
            const near = 1.5 * dimensions.thickness + 0.1;
            const edge = Math.min(hit.u, 1 - hit.u) * t.width / 100 * bounds.width < near || Math.min(hit.v, 1 - hit.v) * t.height / 100 * bounds.height < near;
            assert.ok(edge, `${panel.id} coverage changed away from an image edge at ${u},${v}`);
            continue;
          }
          assert.equal(now.layer, was.layer);
          // Within about a board thickness of where it printed: each panel is
          // now creased up to one board wider and starts up to one board in.
          const layer = v4.outsideArtworkLayers.find(item => item.url === was.layer);
          const mm = Math.hypot((now.u - was.u) * layer.transform.width / 100 * before.bounds.width, (now.v - was.v) * layer.transform.height / 100 * before.bounds.height);
          assert.ok(mm < 1.5 * dimensions.thickness + 0.1, `${panel.id} artwork moved ${mm.toFixed(3)} mm`);
        }
      }
    }
  }
});

test('base box designs keep their artwork on every wall and lid of the straight tuck end', () => {
  const { baseBoxSheetV1 } = require('../src/lib/packaging/templates/base-box/sheet-v1.ts');
  for (const openingMode of ['closed', 'lid_from_back', 'lid_from_left', 'lid_from_right', 'door_left']) {
    for (const dimensions of [{ width: 240, height: 100, depth: 160, thickness: 0.5 }, { width: 80, height: 200, depth: 40, thickness: 1 }]) {
      for (const seed of [3, 17, 256]) {
        const v1 = { ...state(dimensions, randomLayers(seed, 1)), templateId: 'base-box', openingMode };
        const v2 = migrateStudioLayout(v1);
        assert.equal(v2.layoutVersion, 2);
        const before = baseBoxSheetV1(dimensions, openingMode), after = getTemplateGeometry('base-box', dimensions, { openingMode });
        for (const panel of after.panels.filter(item => ['left', 'front', 'right', 'back', 'top', 'bottom'].includes(item.id))) {
          const old = before.panels.find(item => item.id === panel.id);
          for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
            const u = 0.03 + 0.94 * i / 6, v = 0.03 + 0.94 * j / 6;
            const was = imageAt(v1.outsideArtworkLayers, before.bounds, { x: old.x + u * old.width, y: old.y + v * old.height }, panel.id);
            const now = imageAt(v2.outsideArtworkLayers, after.bounds, { x: panel.x + u * panel.width, y: panel.y + v * panel.height }, panel.id);
            const near = 1.5 * dimensions.thickness + 0.1;
            if (!was || !now) {
              // Only right at the image's edge may coverage change.
              const hit = was ?? now, bounds = was ? before.bounds : after.bounds, t = (was ? v1 : v2).outsideArtworkLayers[0].transform;
              if (!hit) continue;
              assert.ok(Math.min(hit.u, 1 - hit.u) * t.width / 100 * bounds.width < near || Math.min(hit.v, 1 - hit.v) * t.height / 100 * bounds.height < near, `${openingMode} ${panel.id} coverage changed at ${u},${v}`);
              continue;
            }
            const t = v1.outsideArtworkLayers[0].transform;
            const mm = Math.hypot((now.u - was.u) * t.width / 100 * before.bounds.width, (now.v - was.v) * t.height / 100 * before.bounds.height);
            assert.ok(mm < near, `${openingMode} ${panel.id} artwork moved ${mm.toFixed(3)} mm`);
          }
        }
      }
    }
  }
});

test('split top designs keep their artwork on every wall of the slotted box', () => {
  const { splitTopSheetV1 } = require('../src/lib/packaging/templates/split-top/sheet-v1.ts');
  for (const splitTopHingeSide of ['side_a', 'side_b']) {
    for (const dimensions of [{ width: 400, height: 300, depth: 300, thickness: 0.5 }, { width: 240, height: 100, depth: 160, thickness: 2 }]) {
      for (const seed of [5, 23, 404]) {
        const v1 = { ...state(dimensions, randomLayers(seed, 1)), templateId: 'split-top-box', splitTopHingeSide };
        const v2 = migrateStudioLayout(v1);
        assert.equal(v2.layoutVersion, 2);
        const before = splitTopSheetV1(dimensions, splitTopHingeSide), after = getTemplateGeometry('split-top-box', dimensions, { splitTopHingeSide });
        for (const panel of after.panels.filter(item => ['front', 'right', 'back', 'left'].includes(item.id))) {
          const old = before.panels.find(item => item.id === panel.id);
          for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
            const u = 0.03 + 0.94 * i / 6, v = 0.03 + 0.94 * j / 6;
            const was = imageAt(v1.outsideArtworkLayers, before.bounds, { x: old.x + u * old.width, y: old.y + v * old.height }, panel.id);
            const now = imageAt(v2.outsideArtworkLayers, after.bounds, { x: panel.x + u * panel.width, y: panel.y + v * panel.height }, panel.id);
            // Walls are scored a board wider and two boards taller, and the
            // joint is wider: within about two boards of where it printed.
            const near = 2 * dimensions.thickness + 0.1;
            if (!was || !now) {
              const hit = was ?? now, bounds = was ? before.bounds : after.bounds, t = (was ? v1 : v2).outsideArtworkLayers[0].transform;
              if (!hit) continue;
              assert.ok(Math.min(hit.u, 1 - hit.u) * t.width / 100 * bounds.width < near || Math.min(hit.v, 1 - hit.v) * t.height / 100 * bounds.height < near, `${panel.id} coverage changed at ${u},${v}`);
              continue;
            }
            const t = v1.outsideArtworkLayers[0].transform;
            const mm = Math.hypot((now.u - was.u) * t.width / 100 * before.bounds.width, (now.v - was.v) * t.height / 100 * before.bounds.height);
            assert.ok(mm < near, `${splitTopHingeSide} ${panel.id} artwork moved ${mm.toFixed(3)} mm`);
          }
        }
      }
    }
  }
  // Front-and-back designs' top flaps take those walls' names.
  const flap = { name: 'f', url: '/api/media/f', mode: 'fill', scale: 100, rotation: 0, alignX: 0, alignY: 0 };
  const sideB = migrateStudioLayout({ ...state({ width: 400, height: 300, depth: 300, thickness: 0.5 }, [], { 'Top Left': flap, 'Interior Top Right': flap }), templateId: 'split-top-box', splitTopHingeSide: 'side_b' });
  assert.deepEqual(Object.keys(sideB.artworkByPanel).sort(), ['Interior Top Back', 'Top Front']);
  const sideA = migrateStudioLayout({ ...state({ width: 400, height: 300, depth: 300, thickness: 0.5 }, [], { 'Top Left': flap }), templateId: 'split-top-box', splitTopHingeSide: 'side_a' });
  assert.deepEqual(Object.keys(sideA.artworkByPanel), ['Top Left']);
});
