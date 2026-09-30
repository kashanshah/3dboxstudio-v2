import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationMode, runAllMigrations } from './migrate-all.mjs';

const env = {
  LEGACY_DATABASE_URL: 'postgres://user:pass@source.example/db',
  DATABASE_URL: 'postgres://user:pass@target.example/db',
  AWS_REGION: 'ca-central-1', AWS_S3_BUCKET: 'test-bucket',
};

test('unified command runs database before assets and forwards apply/dry-run', async () => {
  for (const args of [[], ['--apply']]) {
    const calls = [], logs = [];
    await runAllMigrations({ args, env, run: async (...call) => calls.push(call), log: message => logs.push(message) });
    const mode = args.length ? '--apply' : '--dry-run';
    assert.deepEqual(calls, [['./migrate-legacy-users.mjs', mode], ['./legacy-asset-sync.mjs', mode], ['./migrate-legacy-shares.mjs', mode]]);
    assert.ok(logs.some(line => line.includes('[1/3]')));
    assert.ok(logs.some(line => line.includes('[2/3]')));
    assert.ok(logs.some(line => line.includes('[3/3]')));
    assert.match(logs.at(-1), /represented in V2-owned storage\/data/);
  }
});

test('unified command stops on failed stage and does not report completion', async () => {
  const calls = [], logs = [];
  await assert.rejects(runAllMigrations({ args: ['--apply'], env, run: async script => {
    calls.push(script); throw new Error('database failed');
  }, log: message => logs.push(message) }), /database failed/);
  assert.equal(calls.length, 1);
  assert.ok(!logs.some(line => line.includes('All migration stages completed')));
});

test('invalid flags or missing/overlapping asset configuration fail before any stage', async () => {
  assert.throws(() => migrationMode(['--apply', '--dry-run']), /Choose/);
  assert.throws(() => migrationMode(['--force']), /Supported/);
  for (const badEnv of [{ ...env, AWS_REGION: '' }, { ...env, LEGACY_AWS_S3_PREFIX: 'v2/' }]) {
    let called = false;
    await assert.rejects(runAllMigrations({ args: ['--apply'], env: badEnv, run: async () => { called = true; }, log: () => {} }));
    assert.equal(called, false);
  }
});
