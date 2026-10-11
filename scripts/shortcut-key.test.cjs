/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { shortcutKey } = require('../src/lib/shortcut-key.ts');

test('a key is lowercased', () => {
  assert.equal(shortcutKey({ key: 'S' }), 's');
  assert.equal(shortcutKey({ key: 'z' }), 'z');
});

test('a keydown without a key gives an empty key', () => {
  assert.equal(shortcutKey({}), '');
  assert.equal(shortcutKey({ key: undefined }), '');
  assert.equal(shortcutKey(new Event('keydown')), '');
});
