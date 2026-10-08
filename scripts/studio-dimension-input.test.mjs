import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(path.resolve('src/components/studio/studio-shell.tsx'), 'utf8');
const ast = ts.createSourceFile('studio-shell.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const pick = name => {
  let found;
  ast.forEachChild(node => { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast); });
  assert.ok(found, name);
  return found;
};
const sandbox = {};
vm.runInNewContext(ts.transpileModule([pick('parseDimension'), pick('parseDimensionDraft')].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nthis.parse=parseDimensionDraft;', sandbox);

test('size fields never commit empty, zero, negative or out-of-range values', () => {
  const parse = (text, unit = 'mm') => sandbox.parse(text, unit, 1, 3000);
  for (const bad of ['', ' ', '0', '-50', '-', 'abc', '3001', 'Infinity']) assert.equal(parse(bad), null, bad);
  assert.equal(parse('120'), 120);
  assert.equal(parse('1'), 1);
  assert.equal(parse('2', 'in'), 50.8);
  assert.equal(parse('0.01', 'in'), null);
  assert.equal(sandbox.parse('0.05', 'mm', 0.1, 2), null);
  assert.equal(sandbox.parse('1.5', 'mm', 0.1, 2), 1.5);
});
