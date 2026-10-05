import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

function harness(initial = '/', consent = 'granted') {
  const calls = [];
  const stored = consent ? { '3dbs_analytics_consent': consent } : {};
  const listeners = new Map();
  const w = {
    location: new URL(initial, 'https://www.3dboxstudio.com'),
    posthog: {
      set_config(config) { calls.push(['config', config]); },
      stopSessionRecording() { calls.push(['stop']); },
    },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
    localStorage: { getItem: key => stored[key] ?? null, setItem: (key, value) => { stored[key] = String(value); } },
  };
  w.history = Object.fromEntries(['pushState', 'replaceState'].map(name => [name, function (_data, _unused, url) {
    calls.push(['history', w['ga-disable-G-TEST']]);
    if (url === 'invalid') throw Error('invalid navigation');
    if (url != null) w.location = new URL(url, w.location.href);
  }]));
  const context = vm.createContext({ window: w, URL, console, document: {}, process: { env: {
    NODE_ENV: 'production', NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST', NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph-test',
  } } });
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const imports = request => {
      if (request.startsWith('.')) return load(path.resolve(path.dirname(file), request + '.ts'));
      if (request.startsWith('@/')) return load(path.resolve('src', request.slice(2) + '.ts'));
      return {};
    };
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(imports, loadedModule, loadedModule.exports);
    cache.set(file, loadedModule.exports);
    return loadedModule.exports;
  }
  return { w, calls, listeners, context, load };
}

test('admin route boundaries suppress GA, autocapture and replay before SDK history listeners; public routes resume', () => {
  const h = harness('/studio');
  const cleanup = h.load('src/lib/analytics/route-guard.ts').installAnalyticsRouteGuard();
  for (const method of ['pushState', 'replaceState']) {
    h.w.history[method]({}, '', '/admin/users?search=test');
    assert.equal(h.calls.findLast(c => c[0] === 'history')[1], true);
    assert.equal(h.w['ga-disable-G-TEST'], true);
    assert.equal(h.calls.at(-1)[0], 'stop');
    h.w.history[method]({}, '', '/studio');
    assert.equal(h.w['ga-disable-G-TEST'], false);
    assert.equal(h.calls.at(-1)[1].autocapture, true);
    assert.equal(h.calls.at(-1)[1].disable_session_recording, false);
  }
  h.w.location = new URL('https://www.3dboxstudio.com/admin');
  h.listeners.get('popstate')();
  assert.equal(h.w['ga-disable-G-TEST'], true);
  h.w.location = new URL('https://www.3dboxstudio.com/admin-tools');
  h.listeners.get('popstate')();
  assert.equal(h.w['ga-disable-G-TEST'], false);
  assert.throws(() => h.w.history.pushState({}, '', 'invalid'));
  assert.equal(h.w['ga-disable-G-TEST'], false);
  cleanup();
  assert.equal(h.listeners.size, 0);
});

test('direct GA and PostHog dispatch cannot bypass admin exclusion or queue admin events', () => {
  const h = harness('/admin/settings');
  h.load('src/lib/analytics/gtag.ts').sendGaEvent('test');
  h.load('src/lib/analytics/posthog.ts').capturePostHog('test');
  assert.equal(h.w.dataLayer, undefined);
  assert.equal(h.w.__posthogCaptureQueue, undefined);
  h.w.location = new URL('https://www.3dboxstudio.com/studio');
  h.load('src/lib/analytics/gtag.ts').sendGaEvent('test');
  assert.deepEqual(Array.from(h.w.dataLayer, args => args[0]), ['consent', 'js', 'config', 'event'], 'Consent Mode defaults precede config');
  assert.equal(h.w.dataLayer[0][2].analytics_storage, 'granted');
  assert.equal(h.w.dataLayer[0][2].ad_storage, 'denied');
});

test('declined analytics consent keeps GA disabled on public routes too', () => {
  const h = harness('/studio', 'denied');
  const cleanup = h.load('src/lib/analytics/route-guard.ts').installAnalyticsRouteGuard();
  assert.equal(h.w['ga-disable-G-TEST'], true);
  h.w.history.pushState({}, '', '/blog');
  assert.equal(h.w['ga-disable-G-TEST'], true);
  h.load('src/lib/analytics/gtag.ts').sendGaEvent('test');
  cleanup();
});
