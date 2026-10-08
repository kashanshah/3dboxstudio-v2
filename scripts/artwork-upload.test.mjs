import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadTs(file, mocks = {}) {
  const absolute = path.resolve(file);
  const loadedModule = new Module(absolute);
  loadedModule.require = (id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('node:')) return require(id);
    throw new Error(`Unexpected dependency: ${id}`);
  };
  loadedModule._compile(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, absolute);
  return loadedModule.exports;
}

const upload = loadTs('src/lib/artwork-upload.ts');

test('empty browser MIME types are inferred from the extension', () => {
  assert.equal(upload.inferArtworkMimeType('logo.svg', ''), 'image/svg+xml');
  assert.equal(upload.inferArtworkMimeType('photo.JPG', ''), 'image/jpeg');
  assert.equal(upload.inferArtworkMimeType('photo.jpeg', ''), 'image/jpeg');
  assert.equal(upload.inferArtworkMimeType('art.png', ''), 'image/png');
  assert.equal(upload.inferArtworkMimeType('art.webp', ''), 'image/webp');
  assert.equal(upload.inferArtworkMimeType('notes.txt', ''), '');
  assert.equal(upload.inferArtworkMimeType('mislabelled.svg', 'image/png'), 'image/png');
  assert.deepEqual({ ...upload.checkArtworkFile({ name: 'logo.svg', type: '', size: 5 }) }, { ok: true, mimeType: 'image/svg+xml' });
});

test('HEIC, unsupported, empty and oversized files get friendly reasons', () => {
  const code = (file) => upload.checkArtworkFile(file).error?.code;
  assert.equal(code({ name: 'IMG_1.HEIC', type: '', size: 5 }), 'heic');
  assert.equal(code({ name: 'x.bin', type: 'image/heif', size: 5 }), 'heic');
  assert.equal(code({ name: 'doc.pdf', type: 'application/pdf', size: 5 }), 'unsupported_type');
  assert.equal(code({ name: 'a.png', type: 'image/png', size: 0 }), 'empty');
  assert.equal(code({ name: 'a.png', type: 'image/png', size: upload.MAX_ARTWORK_BYTES + 1 }), 'too_large');
  assert.equal(
    upload.summarizeArtworkUpload(5, [{ name: 'a.png', code: 'too_large' }, { name: 'b.pdf', code: 'unsupported_type' }], 'ok'),
    "3 of 5 images uploaded. Couldn't upload: a.png (too large), b.pdf (unsupported type).",
  );
  assert.equal(
    upload.summarizeArtworkUpload(1, [{ name: 'b.heic', code: 'heic' }], 'ok'),
    "Couldn't upload: b.heic (HEIC photo). Convert HEIC photos to JPG or PNG first.",
  );
  assert.equal(upload.summarizeArtworkUpload(2, [], '2 images saved'), '2 images saved');
});

function mediaServer({ objects, rows }) {
  const deleted = [];
  const inserted = [];
  class Command { constructor(input) { this.input = input; } }
  class HeadObjectCommand extends Command {}
  class GetObjectCommand extends Command {}
  class DeleteObjectCommand extends Command {}
  class PutObjectCommand extends Command {}
  class CopyObjectCommand extends Command {}
  class S3Client {
    async send(command) {
      const bytes = objects.get(command.input.Key);
      if (command instanceof HeadObjectCommand) return { ContentLength: bytes.length, ContentType: 'image/svg+xml' };
      if (command instanceof GetObjectCommand) {
        return { Body: { transformToWebStream: () => new Blob([bytes]).stream() } };
      }
      if (command instanceof DeleteObjectCommand) { deleted.push(command.input.Key); objects.delete(command.input.Key); return {}; }
      throw new Error('unexpected S3 command');
    }
  }
  const sql = (strings, ...values) => {
    const text = strings.join('?');
    if (text.includes('SELECT') && text.includes('fingerprint=')) {
      const [userId, fingerprint, excludeId] = values;
      return Promise.resolve(rows.filter(row => row.user_id === userId && row.fingerprint === fingerprint && row.id !== excludeId));
    }
    if (text.includes('INSERT INTO media_assets')) {
      const [id, user_id, name, mime_type, byte_size, width, height, storage_key, fingerprint] = values;
      const row = { id, user_id, name, mime_type, byte_size, width, height, storage_key, fingerprint, created_at: new Date().toISOString() };
      inserted.push(row);
      rows.push(row);
      return Promise.resolve([row]);
    }
    throw new Error('unexpected SQL: ' + text);
  };
  const media = loadTs('src/server/media-assets.ts', {
    '@aws-sdk/client-s3': { S3Client, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, PutObjectCommand, CopyObjectCommand },
    '@aws-sdk/s3-request-presigner': { getSignedUrl: async () => 'https://signed.example/put' },
    '@/server/db': { ensureV2Schema: async () => {}, getSql: () => sql },
    '@/server/env': { optionalEnv: (_name, fallback = '') => fallback, requireEnv: () => 'test' },
    '@/lib/artwork-upload': upload,
  });
  return { media, deleted, inserted };
}

test('direct-upload finalize returns the existing asset for duplicate bytes and deletes the new object', async () => {
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const existingRow = { id: 'old', user_id: 'u1', name: 'logo.svg', mime_type: 'image/svg+xml', byte_size: bytes.length, width: null, height: null, storage_key: 'v2/uploads/users/u1/artwork/old/logo.svg', fingerprint: sha, created_at: '2026-01-01T00:00:00Z' };
  const newKey = 'v2/uploads/users/u1/artwork/new/logo.svg';
  const { media, deleted, inserted } = mediaServer({ objects: new Map([[newKey, bytes]]), rows: [existingRow] });

  const result = await media.finalizeMediaUpload('u1', { id: 'new', key: newKey, name: 'logo.svg', mimeType: '', byteSize: bytes.length });
  assert.equal(result.existing, true);
  assert.equal(result.asset.id, 'old');
  assert.deepEqual(deleted, [newKey]);
  assert.equal(inserted.length, 0);
});

test('direct-upload finalize stores the SHA-256 fingerprint for new artwork, and prepare short-circuits on a known hash', async () => {
  const bytes = Buffer.from('fresh artwork');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const key = 'v2/uploads/users/u1/artwork/fresh/art.svg';
  const { media, deleted, inserted } = mediaServer({ objects: new Map([[key, bytes]]), rows: [] });

  const result = await media.finalizeMediaUpload('u1', { id: 'fresh', key, name: 'art.svg', mimeType: '', byteSize: bytes.length });
  assert.equal(result.existing, false);
  assert.equal(result.asset.fingerprint, sha);
  assert.equal(inserted[0].mime_type, 'image/svg+xml');
  assert.equal(deleted.length, 0);

  const prepared = await media.createMediaUpload('u1', { name: 'again.svg', mimeType: '', byteSize: bytes.length, fingerprint: sha });
  assert.equal(prepared.existing, true);
  assert.equal(prepared.asset.id, 'fresh');
  const other = await media.createMediaUpload('u2', { name: 'again.svg', mimeType: '', byteSize: bytes.length, fingerprint: sha });
  assert.equal(other.mimeType, 'image/svg+xml');
  assert.ok(other.uploadUrl);

  await assert.rejects(
    media.createMediaUpload('u1', { name: 'IMG_2.heic', mimeType: 'image/heic', byteSize: 10 }),
    (error) => error.code === 'heic' && /Convert HEIC photos to JPG or PNG first/.test(error.message),
  );
});

test('presigned artwork upload URLs carry no precomputed body checksum', async () => {
  // With the SDK's default checksum, the URL pins the CRC32 of an empty body
  // and S3 rejects every real browser upload.
  const env = { AWS_REGION: 'us-east-1', AWS_S3_BUCKET: 'bucket', AWS_ACCESS_KEY_ID: 'AKIDEXAMPLE', AWS_SECRET_ACCESS_KEY: 'secret' };
  const media = loadTs('src/server/media-assets.ts', {
    '@aws-sdk/client-s3': require('@aws-sdk/client-s3'),
    '@aws-sdk/s3-request-presigner': require('@aws-sdk/s3-request-presigner'),
    '@/server/db': { ensureV2Schema: async () => {}, getSql: () => async () => [] },
    '@/server/env': { optionalEnv: (name, fallback = '') => env[name] ?? fallback, requireEnv: (name) => env[name] },
    '@/lib/artwork-upload': upload,
  });
  const prepared = await media.createMediaUpload('u1', { name: 'art.png', mimeType: 'image/png', byteSize: 65_000 });
  const params = new URL(prepared.uploadUrl).searchParams;
  assert.equal(params.get('x-amz-checksum-crc32'), null);
  assert.equal(params.get('x-amz-sdk-checksum-algorithm'), null);
  assert.ok(params.get('X-Amz-Signature'));
});

test('upload errors keep the failing stage and status for analytics', () => {
  const error = new upload.ArtworkUploadError('Could not reach image storage.', 'failed', { stage: 'storage', status: 0, timedOut: true });
  assert.equal(upload.artworkUploadErrorCode(error), 'failed');
  assert.equal(error.stage, 'storage');
  assert.equal(error.status, 0);
  assert.equal(error.timedOut, true);
  assert.equal(upload.isRetryableArtworkFailure('failed'), true);
  assert.equal(upload.isRetryableArtworkFailure('rate_limited'), true);
  assert.equal(upload.isRetryableArtworkFailure('heic'), false);
});
