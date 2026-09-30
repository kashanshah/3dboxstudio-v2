import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationKeyForLegacyAsset } from './legacy-asset-sync.mjs';

test('maps legacy keys into deterministic v2 legacy subprefix', () => {
  assert.equal(
    destinationKeyForLegacyAsset('shares/abc/front.png', 'shares/', 'v2/uploads/', 'legacy/'),
    'v2/uploads/legacy/abc/front.png',
  );
});

test('normalizes prefixes', () => {
  assert.equal(
    destinationKeyForLegacyAsset('shares/a.png', '/shares', 'v2/uploads', '/legacy'),
    'v2/uploads/legacy/a.png',
  );
});

test('rejects keys outside the configured legacy prefix', () => {
  assert.throws(
    () => destinationKeyForLegacyAsset('other/a.png', 'shares/', 'v2/uploads/', 'legacy/'),
    /outside legacy prefix/,
  );
});
