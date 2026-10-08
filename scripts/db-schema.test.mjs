import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const transpile = file => ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const legacySchema = () => { const exports = {}; vm.runInNewContext(transpile('src/server/legacy-schema.ts'), {exports}); return exports.LEGACY_SYNC_SCHEMA; };

// A fresh module instance per call, as on a cold serverless instance.
function loadDb(sql, legacy = legacySchema()) {
  const exports = {};
  vm.runInNewContext(transpile('src/server/db.ts'), {exports, process:{env:{DATABASE_URL:'postgres://test'}}, require:name => {
    if (name === 'node:crypto') return crypto;
    if (name === '@neondatabase/serverless') return {neon:() => sql};
    if (name === './env') return {requireEnv:key => key};
    if (name === './legacy-schema') return {LEGACY_SYNC_SCHEMA:legacy};
    throw new Error('unexpected import ' + name);
  }});
  return exports;
}

function fakeSql(db) {
  const calls = [];
  let failNext = null;
  const sql = () => { throw new Error('schema setup uses sql.query only'); };
  sql.query = async (text, params) => {
    calls.push(text.trim());
    if (failNext && failNext(text)) { failNext = null; throw new Error('connection reset'); }
    try { return (await db.query(text, params)).rows; }
    catch (error) { throw Object.assign(new Error(error.message), {code:error.code}); }
  };
  return {sql, calls, failOnce:match => { failNext = match; }};
}

test('schema DDL runs on a fresh database, then costs one query until the DDL changes', async () => {
  const db = new PGlite();
  try {
    const fake = fakeSql(db);
    const first = loadDb(fake.sql);
    await first.ensureV2Schema();
    assert.ok(fake.calls.length > 40, 'fresh database runs every statement');
    assert.match(fake.calls.at(-1), /^INSERT INTO app_schema_meta/, 'fingerprint is written last');
    assert.equal((await db.query("SELECT value FROM app_schema_meta WHERE key='v2_schema'")).rows[0].value, first.SCHEMA_FINGERPRINT);
    await first.ensureV2Schema();
    assert.equal(fake.calls.filter(text => text.startsWith('INSERT INTO app_schema_meta')).length, 1, 'cached per instance');

    fake.calls.length = 0;
    await loadDb(fake.sql).ensureV2Schema();
    assert.deepEqual(fake.calls, ['SELECT value FROM app_schema_meta WHERE key=$1'], 'matching fingerprint: one read, no DDL');

    fake.calls.length = 0;
    const changed = loadDb(fake.sql, legacySchema() + '\nCREATE TABLE IF NOT EXISTS added_later (id TEXT PRIMARY KEY);');
    assert.notEqual(changed.SCHEMA_FINGERPRINT, first.SCHEMA_FINGERPRINT);
    await changed.ensureV2Schema();
    assert.ok(fake.calls.some(text => text.startsWith('CREATE TABLE IF NOT EXISTS added_later')), 'changed DDL reruns on an existing database');
    assert.equal((await db.query("SELECT value FROM app_schema_meta WHERE key='v2_schema'")).rows[0].value, changed.SCHEMA_FINGERPRINT);
  } finally { await db.close(); }
});

test('a failed migration rejects, leaves the fingerprint unwritten and is retried', async () => {
  const db = new PGlite();
  try {
    const fake = fakeSql(db);
    const instance = loadDb(fake.sql);
    fake.failOnce(text => text.includes('CREATE TABLE IF NOT EXISTS sessions'));
    await assert.rejects(instance.ensureV2Schema(), /connection reset/);
    assert.equal((await db.query("SELECT to_regclass('app_schema_meta') AS t")).rows[0].t, null, 'no fingerprint after a partial run');
    await instance.ensureV2Schema();
    assert.equal((await db.query("SELECT value FROM app_schema_meta WHERE key='v2_schema'")).rows[0].value, instance.SCHEMA_FINGERPRINT);

    fake.failOnce(text => text.startsWith('SELECT value FROM app_schema_meta'));
    const cold = loadDb(fake.sql);
    await assert.rejects(cold.ensureV2Schema(), /connection reset/, 'a failed read is not treated as a missing schema');
    fake.calls.length = 0;
    await cold.ensureV2Schema();
    assert.equal(fake.calls.length, 1);
  } finally { await db.close(); }
});
