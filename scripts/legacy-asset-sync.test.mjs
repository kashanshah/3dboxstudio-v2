import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationKeyForLegacyAsset, syncLegacyAssets } from './legacy-asset-sync.mjs';
import { CopyObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

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

const config = { sourceBucket: 'bucket', targetBucket: 'bucket', sourcePrefix: 'shares/', targetPrefix: 'v2/uploads/' };

function fixture() {
  const sources = new Map([
    ['shares/a.png', { ETag: '"a"', ContentLength: 10, ContentType: 'image/png', Metadata: { custom: 'value' } }],
    ['shares/b.png', { ETag: '"b"', ContentLength: 20, ContentType: 'image/png' }],
  ]);
  const targets = new Map();
  let copies = 0;
  const client = { send: async (command, options) => {
    assert.ok(options.abortSignal);
    const input = command.input;
    if (command instanceof ListObjectsV2Command) {
      const keys = [...sources.keys()];
      const index = input.ContinuationToken ? 1 : 0;
      const key = keys[index], object = sources.get(key);
      return { Contents: [{ Key: key, ETag: object.ETag, Size: object.ContentLength }], IsTruncated: index === 0, NextContinuationToken: index === 0 ? 'page2' : undefined };
    }
    if (command instanceof HeadObjectCommand) {
      const object = (input.Key.startsWith('shares/') ? sources : targets).get(input.Key);
      if (!object) throw Object.assign(new Error('not found'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      return object;
    }
    assert.ok(command instanceof CopyObjectCommand);
    copies++;
    const source = sources.get(decodeURIComponent(input.CopySource.slice('bucket/'.length)));
    assert.equal(input.CopySourceIfMatch, source.ETag);
    // Encryption may produce an ETag different from the source.
    targets.set(input.Key, { ...source, ETag: '"encrypted-target"', Metadata: input.Metadata });
    return {};
  } };
  return { client, sources, targets, copies: () => copies };
}

test('paginated dry run, apply, unchanged rerun and same-size source update do not duplicate assets', async () => {
  const f = fixture(), progress = [];
  const dry = await syncLegacyAssets({ ...config, client: f.client, onProgress: event => progress.push(event) });
  assert.equal(dry.wouldCopy, 2);
  assert.equal(f.copies(), 0);
  assert.ok(progress.some(event => event.operation === 'listing source page 2'));
  assert.equal(progress.at(-1).operation, 'finished');
  const first = await syncLegacyAssets({ ...config, client: f.client, apply: true });
  assert.equal(first.copied, 2);
  assert.equal(f.targets.get('v2/uploads/legacy/a.png').Metadata.custom, 'value');
  assert.equal(f.targets.get('v2/uploads/legacy/a.png').ContentType, 'image/png');
  const repeat = await syncLegacyAssets({ ...config, client: f.client, apply: true });
  assert.equal(repeat.copied, 0);
  assert.equal(repeat.unchanged, 2);
  f.sources.get('shares/a.png').ETag = '"changed-same-size"';
  const changed = await syncLegacyAssets({ ...config, client: f.client, apply: true });
  assert.equal(changed.copied, 1);
  assert.equal(changed.unchanged, 1);
  assert.equal(f.targets.size, 2);
});

test('permission errors are not treated as missing destination objects', async () => {
  const f = fixture(), send = f.client.send;
  f.client.send = (command, options) => {
    if (command instanceof HeadObjectCommand) throw Object.assign(new Error('access denied'), { $metadata: { httpStatusCode: 403 } });
    return send(command, options);
  };
  await assert.rejects(syncLegacyAssets({ ...config, client: f.client, apply: true }), /access denied/);
  assert.equal(f.copies(), 0);
});

test('copy failures report partial completion and a rerun copies only missing files', async () => {
  const f = fixture(), send = f.client.send;
  f.client.send = (command, options) => {
    if (command instanceof CopyObjectCommand && command.input.Key.endsWith('/a.png')) throw new Error('copy failed');
    return send(command, options);
  };
  const failed = await syncLegacyAssets({ ...config, client: f.client, apply: true });
  assert.equal(failed.failed, 1);
  assert.equal(failed.copied, 1);
  assert.equal(failed.partial, true);
  f.client.send = send;
  const retry = await syncLegacyAssets({ ...config, client: f.client, apply: true });
  assert.equal(retry.copied, 1);
  assert.equal(retry.unchanged, 1);
  assert.equal(f.targets.size, 2);
});

test('overlapping source/destination prefixes fail before listing', async () => {
  const f = fixture();
  await assert.rejects(syncLegacyAssets({ ...config, client: f.client, sourcePrefix: 'v2/' }), /overlap/);
});

test('a stalled S3 request is aborted with a useful timeout error', async () => {
  const client = { send: (command, { abortSignal }) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(resolve, 1000);
    abortSignal.addEventListener('abort', () => {
      clearTimeout(keepAlive);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }, { once: true });
  }) };
  await assert.rejects(syncLegacyAssets({ ...config, client, requestTimeoutMs: 10 }), /timed out.*listing source page 1/);
});
