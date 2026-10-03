import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/packaging/preview-loop.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports });
const { previewLoopProgress } = exports;

test('preview loop holds open and closed poses and repeats without a jump', () => {
  for (const open of [0, 70]) {
    assert.equal(previewLoopProgress(0, open), 100);
    assert.equal(previewLoopProgress(799, open), 100);
    assert.equal(previewLoopProgress(2300, open), (100 + open) / 2);
    assert.equal(previewLoopProgress(3800, open), open);
    assert.equal(previewLoopProgress(4599, open), open);
    assert.equal(previewLoopProgress(6100, open), (100 + open) / 2);
    assert.ok(Math.abs(previewLoopProgress(7599, open) - 100) < .001);
    assert.equal(previewLoopProgress(7600, open), 100);
    assert.equal(previewLoopProgress(9900, open), previewLoopProgress(2300, open));
    let previous = 100;
    for (let time = 800; time <= 3800; time += 100) {
      const progress = previewLoopProgress(time, open);
      assert.ok(progress <= previous && progress >= open);
      previous = progress;
    }
    for (let time = 4600; time <= 7600; time += 100) {
      const progress = previewLoopProgress(time, open);
      assert.ok(progress >= previous && progress <= 100);
      previous = progress;
    }
  }
});
