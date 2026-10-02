import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('../src/components/features-hero-video.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mount({ loaded = true } = {}) {
  const events = new Map();
  const frames = new Map();
  let frameId = 0;
  const emitter = (prefix) => ({
    addEventListener: (event, fn) => events.set(prefix + event, fn),
    removeEventListener: (event) => events.delete(prefix + event),
  });
  const style = () => ({ setProperty() {}, removeProperty() {} });
  const motion = { matches: false, ...emitter('motion:') };
  const timeline = { value: '0', ...emitter('input:') };
  const percentage = {};
  const instruction = {};
  const figure = {
    style: style(), getBoundingClientRect: () => ({ height: 685 }),
    querySelector: (selector) => selector.includes('range') ? timeline : selector.includes('percentage') ? percentage : instruction,
  };
  const aside = { getBoundingClientRect: () => ({ top: 99 - window.scrollY, height: 1205 }) };
  const hero = {};
  const track = { dataset: {}, style: style(), querySelector: (selector) => selector.includes('aside') ? aside : hero };
  const video = { readyState: loaded ? 2 : 1, duration: 4.89, currentTime: 0, seeking: false, closest: () => track, ...emitter('video:') };
  const window = {
    scrollY: 0, innerHeight: 800, matchMedia: () => motion,
    requestAnimationFrame: (fn) => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: (id) => frames.delete(id), ...emitter('window:'),
  };
  let effect;
  let refs = 0;
  const compiledModule = { exports: {} };
  vm.runInNewContext(source, {
    module: compiledModule, exports: compiledModule.exports, window,
    document: { querySelector: () => ({ getBoundingClientRect: () => ({ height: 83 }) }) },
    ResizeObserver: class { observe() {} disconnect() {} },
    require: (name) => name === 'react' ? {
      useRef: () => ({ current: refs++ === 0 ? video : figure }), useEffect: (fn) => { effect = fn; },
    } : name === 'react/jsx-runtime' ? { jsx: () => null, jsxs: () => null } : {},
  });
  compiledModule.exports.FeaturesHeroVideo();
  const cleanup = effect();
  const flush = () => { for (const [id, fn] of [...frames]) { frames.delete(id); fn(); } };
  const emit = (name) => { events.get(name)?.(); flush(); };
  const scroll = (position) => { window.scrollY = position; emit('window:scroll'); };
  flush();
  return { track, video, timeline, percentage, motion, events, frames, emit, scroll, cleanup };
}

test('seeking and buffering cannot collapse the scroll layout after the first decoded frame', () => {
  const app = mount();
  app.scroll(130);
  assert.equal(app.track.dataset.scrollReady, 'true');
  const firstTime = app.video.currentTime;
  app.video.readyState = 1;
  app.video.seeking = true;
  app.scroll(200);
  assert.equal(app.track.dataset.scrollReady, 'true', 'buffering must not swap the page layout');
  assert.equal(app.video.currentTime, firstTime, 'wait for the pending seek');
  app.video.seeking = false;
  app.emit('video:seeked');
  assert.ok(app.video.currentTime > firstTime);
  app.video.readyState = 0;
  app.scroll(300);
  assert.equal(app.track.dataset.scrollReady, 'true');
  app.cleanup();
});

test('loads once, scrubs in both directions, and completes before the preview releases', () => {
  const app = mount({ loaded: false });
  assert.equal(app.track.dataset.scrollReady, 'false');
  app.video.readyState = 2;
  app.emit('video:loadeddata');
  assert.equal(app.track.dataset.scrollReady, 'true');
  app.scroll(260);
  const forwardTime = app.video.currentTime;
  app.scroll(130);
  assert.ok(app.video.currentTime < forwardTime);
  app.scroll(480); // 40 px remain before the sticky stage releases.
  assert.equal(app.percentage.textContent, '100%');
  assert.ok(app.video.currentTime < app.video.duration);
  assert.ok(app.video.currentTime > 4.8);
  app.cleanup();
  assert.equal(app.events.size, 0);
  assert.equal(app.frames.size, 0);
});

test('direct timeline works and reduced motion or genuine loading failure removes the extended section', () => {
  const app = mount();
  app.timeline.value = '75';
  app.emit('input:input');
  assert.ok(app.video.currentTime > 3.6 && app.video.currentTime < 3.7);
  assert.equal(app.percentage.textContent, '75%');
  app.motion.matches = true;
  app.emit('motion:change');
  assert.equal(app.track.dataset.scrollReady, 'false');
  assert.equal(app.video.currentTime, 0);
  app.motion.matches = false;
  app.emit('motion:change');
  assert.equal(app.track.dataset.scrollReady, 'true');
  app.emit('video:error');
  assert.equal(app.track.dataset.scrollReady, 'false');
  app.cleanup();
});
