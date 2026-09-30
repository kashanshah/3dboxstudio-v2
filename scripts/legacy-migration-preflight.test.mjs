import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseIdentity, preflightMigration } from './legacy-migration-preflight.mjs';
import { scryptSync } from 'node:crypto';
import { verifyPassword } from '../src/server/auth/password.ts';

const user = { id: 'legacy1', email: 'Old@Example.com' };
const account = { provider: 'google', provider_account_id: 'google1', user_id: user.id };
const baseline = { users: [user], oauth: [account], targetUsers: [], targetOAuth: [], ledger: [] };

test('V1 scrypt password hashes work unchanged in V2', async () => {
  const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
  const hash = `${salt.toString('hex')}:${scryptSync('legacy-password', salt, 64).toString('hex')}`;
  assert.equal(await verifyPassword('legacy-password', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('fresh import and recorded rerun keep legacy IDs', () => {
  assert.doesNotThrow(() => preflightMigration(baseline));
  assert.doesNotThrow(() => preflightMigration({ ...baseline, targetUsers: [{ ...user, email: 'old@example.com' }], targetOAuth: [account], ledger: [{ source_id: user.id }] }));
});

test('email or unrecorded ID collision requires reconciliation', () => {
  assert.throws(() => preflightMigration({ ...baseline, targetUsers: [{ id: 'v2', email: user.email }] }), /different user/);
  assert.throws(() => preflightMigration({ ...baseline, targetUsers: [user] }), /ID collision/);
  assert.throws(() => preflightMigration({ ...baseline, targetUsers: [{ ...user, email: 'changed@example.com' }], ledger: [{ source_id: user.id }] }), /changed email/);
});

test('duplicate normalized emails and orphaned OAuth stop the entire import', () => {
  assert.throws(() => preflightMigration({ ...baseline, users: [user, { id: 'legacy2', email: ' old@example.com ' }] }), /duplicate/);
  assert.throws(() => preflightMigration({ ...baseline, oauth: [{ ...account, user_id: 'missing' }] }), /orphaned/);
});

test('OAuth identity cannot be reassigned to an imported user', () => {
  assert.throws(() => preflightMigration({ ...baseline, targetOAuth: [{ ...account, user_id: 'v2' }] }), /different target user/);
});

test('database guard recognizes credential and pooler variants', () => {
  assert.equal(databaseIdentity('postgresql://read:secret@ep-test-pooler.neon.tech/db?sslmode=require'), databaseIdentity('postgresql://write:other@ep-test.neon.tech/db'));
  assert.notEqual(databaseIdentity('postgresql://user@ep-test.neon.tech/db'), databaseIdentity('postgresql://user@ep-test.neon.tech/v2'));
});
