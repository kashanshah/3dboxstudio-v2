/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

// What the browser sends to Admin → Errors (src/lib/error-reporting.ts): the
// site's own errors, but not the hydration errors a browser translator causes
// by rewriting the page before React takes it over.

const SOURCE = path.resolve(__dirname, '../src/lib/error-reporting.ts');
const HYDRATION = 'Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message';

/** A fresh copy of the module on a page with `html`, and the reports it sends. */
function load(html = '<html><body><p>Choose a box</p></body></html>') {
  const dom = new JSDOM(html, { url: 'https://www.3dboxstudio.com/studio' });
  const sent = [];
  const loaded = { exports: {} };
  const window = dom.window;
  window.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return { ok: true }; };
  const run = new Function('exports', 'module', 'window', 'document', 'fetch', ts.transpileModule(fs.readFileSync(SOURCE, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  run(loaded.exports, loaded, window, window.document, window.fetch);
  return { api: loaded.exports, window, sent };
}
const ownError = (message) => { const error = new Error(message); error.stack = `Error: ${message}\n    at rJ (https://www.3dboxstudio.com/_next/static/immutable/chunks/0twuz2ww_172v.js:1:63333)`; return error; };

test('a hydration error on a page as the site rendered it is reported', () => {
  const { api, sent } = load();
  api.reportClientError('uncaught_error', ownError(HYDRATION));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/api/errors');
  assert.equal(sent[0].body.path, '/studio');
});

test('a hydration error on a page a translator rewrote is not', () => {
  const pages = {
    'Google Translate': '<html class="translated-ltr"><body><p><font style="vertical-align: inherit;"><font style="vertical-align: inherit;">Elige una caja</font></font></p></body></html>',
    'Google Translate, right to left': '<html class="translated-rtl"><body><p>اختر صندوقًا</p></body></html>',
    'Google Translate, before it marks the page': '<html><body><p><font style="vertical-align: inherit;">Novo projeto</font></p></body></html>',
    'Microsoft Translator (Edge)': '<html><body><p _msttexthash="12345" _msthash="9">使用模板</p></body></html>',
  };
  for (const [translator, html] of Object.entries(pages)) {
    const { api, sent } = load(html);
    assert.equal(api.isPageTranslated(), true, translator);
    api.reportClientError('uncaught_error', ownError(HYDRATION));
    api.reportClientError('uncaught_error', ownError('Hydration failed because the server rendered HTML didn\'t match the client.'));
    assert.equal(sent.length, 0, translator);
  }
});

test('other errors on a translated page are still reported', () => {
  const { api, sent } = load('<html class="translated-ltr"><body></body></html>');
  api.reportClientError('studio_view_crashed', ownError("Cannot read properties of undefined (reading 'width')"), { view: 'canvas' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.details.view, 'canvas');
});

test('the page listener applies the same rule to uncaught errors', () => {
  for (const [html, expected] of [['<html><body></body></html>', 1], ['<html class="translated-ltr"><body></body></html>', 0]]) {
    const { api, window, sent } = load(html);
    api.installErrorReporting();
    const error = ownError(HYDRATION);
    window.dispatchEvent(new window.ErrorEvent('error', { message: error.message, error, filename: 'https://www.3dboxstudio.com/_next/static/immutable/chunks/0twuz2ww_172v.js' }));
    assert.equal(sent.length, expected, html);
  }
});
