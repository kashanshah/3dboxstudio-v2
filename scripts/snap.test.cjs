/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { alignTo, artworkBox, panelUnder, snapLines, snapMove } = require('../src/lib/packaging/snap.ts');

const sheet = { width: 400, height: 200 };
const panels = [{ x: 0, y: 0, width: 100, height: 200 }, { x: 100, y: 50, width: 200, height: 100 }];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('a turned artwork covers its turned box', () => {
  const box = artworkBox({ x: 50, y: 50, width: 10, height: 10, rotation: 90 }, sheet);
  near(box.right - box.left, 20); near(box.bottom - box.top, 40);
});

test('snap lines are the sheet and every panel edge and centre', () => {
  const lines = snapLines(sheet, panels);
  assert.deepEqual(lines.x, [0, 50, 100, 200, 300, 400]);
  assert.deepEqual(lines.y, [0, 50, 100, 150, 200]);
});

test('a drag snaps the nearest edge or centre within reach, each axis on its own', () => {
  const lines = snapLines(sheet, panels);
  // Left edge at 102 mm snaps to the panel edge at 100; top at 72 is out of reach of 50/100.
  const result = snapMove({ x: 30, y: 40, width: 10, height: 10, rotation: 0 }, sheet, lines, 3);
  near(artworkBox(result.transform, sheet).left, 100);
  near(result.transform.y, 40);
  assert.deepEqual(result.guides, { x: [100], y: [] });
  // Nothing within reach: nothing moves.
  const free = snapMove({ x: 31.25, y: 40, width: 2.5, height: 10, rotation: 0 }, sheet, lines, 0.5);
  assert.deepEqual(free.guides, { x: [], y: [] });
});

test('align buttons line up with the panel under the artwork', () => {
  const art = { x: 50, y: 50, width: 10, height: 10, rotation: 0 };
  const panel = panelUnder(art, sheet, panels);
  assert.deepEqual(panel, panels[1]);
  near(artworkBox(alignTo(art, sheet, panel, 'left'), sheet).left, 100);
  near(artworkBox(alignTo(art, sheet, panel, 'right'), sheet).right, 300);
  near(artworkBox(alignTo(art, sheet, panel, 'bottom'), sheet).bottom, 150);
  near(alignTo(art, sheet, panel, 'middle').y, 50);
  // Off every panel: the sheet.
  assert.deepEqual(panelUnder({ ...art, x: 90, y: 90 }, sheet, panels), { x: 0, y: 0, width: 400, height: 200 });
});
