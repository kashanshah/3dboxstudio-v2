/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, file);
const { placeSizeHandles } = require('../src/lib/packaging/size-handles.ts');
const { getTemplateGeometry, getTemplateRuntime } = require('../src/lib/packaging/template-runtime.ts');

const TEMPLATES = ['reverse-tuck-carton', 'base-box', 'auto-lock-bottom-box', 'snap-lock-bottom-box', 'sleeve-box', 'mailer-box', 'pizza-box', 'rigid-lid-base', 'split-top-box', 'pillow-box'];
function handlesFor(templateId, dims) {
  const sheet = getTemplateGeometry(templateId, dims, {});
  const sizes = getTemplateRuntime(templateId).getPanelSizes?.(dims, {});
  if (!sizes) return { sheet, handles: [] };
  const handles = placeSizeHandles(sheet.panels, sizes, (size) => {
    const value = size.value + 1 <= size.max ? size.value + 1 : size.value - 1;
    return getTemplateGeometry(templateId, { ...dims, [size.key]: value }, {}).panels;
  });
  return { sheet, handles };
}
const base = { width: 60, height: 120, depth: 40, thickness: 0.5 };

test('every side of the box gets width, height and depth handles; each flap size one', () => {
  const { sheet, handles } = handlesFor('reverse-tuck-carton', base);
  const on = (id) => [...new Set(handles.filter((handle) => handle.panel === id).map((handle) => handle.size.key))].sort();
  assert.deepEqual(on('front'), ['height', 'width']);
  assert.deepEqual(on('back'), ['height', 'width']);
  assert.deepEqual(on('left'), ['depth', 'height']);
  assert.deepEqual(on('right'), ['depth', 'height']);
  for (const handle of handles) {
    const panel = sheet.panels.find((item) => item.id === handle.panel);
    if (handle.size.kind === 'dimension') assert.equal(panel.kind, 'body', handle.id);
  }
  const flapKeys = handles.filter((handle) => handle.size.kind === 'adjustment').map((handle) => handle.size.key);
  assert.equal(new Set(flapKeys).size, flapKeys.length);
});

test('box sizes can be dragged from both ends: the height from the top and the bottom', () => {
  for (const templateId of TEMPLATES) {
    const { sheet, handles } = handlesFor(templateId, base);
    for (const panel of sheet.panels.filter((item) => item.kind === 'body')) {
      for (const handle of handles.filter((item) => item.panel === panel.id && item.size.kind === 'dimension')) {
        const [low, high] = handle.axis === 'x' ? [panel.x, panel.x + panel.width] : [panel.y, panel.y + panel.height];
        const at = (edge) => handles.some((item) => item.axis === handle.axis && Math.abs((item.axis === 'x' ? item.x : item.y) - edge) < 1e-6
          && Math.abs((item.axis === 'x' ? item.y : item.x) - (handle.axis === 'x' ? handle.y : handle.x)) < 6);
        // Both ends of the panel along the size have a handle (its own, or a neighbour's on a shared crease).
        assert.ok(at(low) && at(high), `${templateId} ${panel.id} ${handle.size.key} has handles at both ends`);
      }
    }
    // The reverse tuck's front takes its height from the top and the bottom.
    if (templateId === 'reverse-tuck-carton') {
      const front = handles.filter((item) => item.panel === 'front' && item.size.key === 'height');
      assert.deepEqual(front.map((item) => item.direction).sort(), [-1, 1]);
    }
  }
});

test('a handle sits on the edge that moves, and dragging it out grows the size by as much', () => {
  for (const templateId of TEMPLATES) {
    const { sheet, handles } = handlesFor(templateId, base);
    for (const handle of handles.filter((item) => item.size.kind === 'dimension')) {
      const grown = handlesFor(templateId, { ...base, [handle.size.key]: base[handle.size.key] + 10 });
      const before = sheet.panels.find((item) => item.id === handle.panel);
      const after = grown.sheet.panels.find((item) => item.id === handle.panel);
      const span = (panel) => handle.axis === 'x' ? panel.width : panel.height;
      // The panel grows by the size's change, measured from its anchored edge.
      assert.ok(Math.abs(span(after) - span(before) - 10) < 1, `${templateId} ${handle.id}`);
      const moved = grown.handles.find((item) => item.id === handle.id);
      assert.ok(moved, `${templateId} ${handle.id} still there`);
      const shift = (handle.axis === 'x' ? moved.x - moved.anchor : moved.y - moved.anchor) - (handle.axis === 'x' ? handle.x - handle.anchor : handle.y - handle.anchor);
      assert.ok(Math.abs(shift - 10 * handle.direction) < 1, `${templateId} ${handle.id}: ${shift}`);
    }
  }
});

test('handles keep their order as the box changes size', () => {
  // A handle that moved in the page would lose the pointer mid-drag.
  for (const templateId of TEMPLATES) {
    const ids = handlesFor(templateId, base).handles.map((handle) => handle.id);
    for (const dims of [{ ...base, width: 140 }, { ...base, depth: 90 }, { ...base, height: 40 }]) {
      const next = handlesFor(templateId, dims).handles.map((handle) => handle.id);
      const shared = (list, other) => list.filter((id) => other.includes(id));
      assert.deepEqual(shared(next, ids), shared(ids, next), `${templateId} ${JSON.stringify(dims)}`);
      assert.ok(shared(ids, next).length >= ids.length - 2, `${templateId} keeps its handles`);
    }
  }
});
