/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { videoPose, videoColor, VIDEO_SECONDS, DEFAULT_VIDEO_SETTINGS } = require('../src/lib/packaging/video-timeline.ts');

const start = { yaw: 0.6, pitch: 0.3 };
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, `${message}: ${a} vs ${b}`);

test('fold and turn starts flat and ends closed, one turn on, at any length', () => {
  for (const seconds of Object.values(VIDEO_SECONDS)) {
    const first = videoPose(0, seconds, 'fold', start, true), last = videoPose(seconds, seconds, 'fold', start, true);
    close(first.progress, 0, 'starts flat'); close(last.progress, 100, 'ends closed');
    close(last.yaw - first.yaw, 2 * Math.PI + 0.35, 'drifts then turns once');
  }
  assert.equal(DEFAULT_VIDEO_SETTINGS.motion, 'fold'); assert.equal(VIDEO_SECONDS[DEFAULT_VIDEO_SETTINGS.length], 10);
});

test('turntable keeps the box closed and loops seamlessly', () => {
  const seconds = 6, fps = 30, frames = seconds * fps;
  const step = videoPose(1 / fps, seconds, 'turntable', start, true).yaw - videoPose(0, seconds, 'turntable', start, true).yaw;
  const lastFrame = videoPose((frames - 1) / fps, seconds, 'turntable', start, true);
  close(lastFrame.yaw + step - 2 * Math.PI, start.yaw, 'the frame after the last is the first');
  for (let i = 0; i < frames; i += 17) close(videoPose(i / fps, seconds, 'turntable', start, false).progress, 100, 'closed');
});

test('open and close opens the lid when there is one, otherwise unfolds, and loops', () => {
  const seconds = 10;
  const lid = [0, 2, 5, 8, 10].map(time => videoPose(time, seconds, 'open-close', start, true));
  close(lid[0].progress, 100, 'starts closed'); close(lid[2].progress, 70, 'fully open at the middle'); close(lid[4].progress, 100, 'ends closed');
  assert.ok(lid.every(pose => pose.progress >= 70), 'never folds below assembled');
  close(lid[4].yaw - lid[0].yaw, 2 * Math.PI, 'one full turn');
  const fold = videoPose(5, seconds, 'open-close', start, false);
  close(fold.progress, 0, 'a box without a lid unfolds to the sheet');
});

test('background colours must be #rrggbb', () => {
  assert.equal(videoColor('#A1B2C3'), '#a1b2c3');
  for (const bad of ['red', '#fff', 'url(x)', null, '#12345g']) assert.equal(videoColor(bad), null);
});
