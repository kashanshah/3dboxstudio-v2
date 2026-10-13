import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { NextResponse } = require('next/server');
function loadTs(file, mocks = {}) {
  const absolute = path.resolve(file);
  const loadedModule = new Module(absolute);
  loadedModule.require = (id) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  };
  loadedModule._compile(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, absolute);
  return loadedModule.exports;
}
const helper = loadTs('src/server/media-response-headers.ts');
const names = ['Screenshot 2026-09-30 at 8.29.07\u202fPM.png', 'تصویر.png', '包装📦.png', 'quote"slash\\.png', "a'b*(c).png", 'line\r\nbreak.png', '\ud800.png'];
test('Unicode filenames produce valid ASCII headers and retain an encoded filename', () => {
  for (const name of names) {
    const value = helper.inlineContentDisposition(name);
    assert.match(value, /^[\x20-\x7e]+$/);
    assert.equal(new Headers({ 'Content-Disposition': value }).get('Content-Disposition'), value);
    assert.equal(decodeURIComponent(value.split("filename*=UTF-8''")[1]), name.toWellFormed().replace(/[\r\n\x00-\x1f\x7f]/g, '_'));
  }
});
// The admin route streams only SVGs (with a locked-down policy); other images
// are sent to S3 by a redirect, tested below.
const routes = ['src/app/api/shares/[id]/legacy-media/[face]/route.ts', 'src/app/api/shares/[id]/media/[assetId]/route.ts', 'src/app/api/media/[id]/route.ts', 'src/app/api/admin/media/file/route.ts'];
for (const route of routes) {
  test(`${route} serves Unicode-named artwork without a ByteString failure`, async () => {
    const mime = route.includes('/admin/') ? 'image/svg+xml' : 'image/png';
    for (const name of names) {
      const bytes = Buffer.from([1, 2, 3, 4]);
      const meta = { name, storageKey: 'image', storage_key: 'image', mime, mime_type: mime, mimeType: mime };
      const loadedModule = loadTs(route, {
        'next/server': { NextResponse },
        '@/server/media-response-headers': helper,
        '@/server/design-shares': { getMigratedShareAsset: async () => meta, getShareMedia: async () => meta },
        '@/server/media-assets': {
          readStoredObject: async () => ({ body: new Blob([bytes]).stream(), byteSize: bytes.length, contentType: 'image/png' }),
          readMediaAsset: async () => ({ body: new Blob([bytes]).stream(), byteSize: bytes.length, contentType: 'image/png', row: meta }),
          contentLengthHeader: byteSize => byteSize == null ? {} : { 'Content-Length': String(byteSize) },
        },
        '@/server/auth/session': { getCurrentUser: async () => ({ id: 'user' }) },
        '@/server/auth/action-request': {},
        '@/server/admin/auth': { requireAdminApi: async () => null },
        '@/server/admin/catalog': { findListedMedia: async () => meta },
        '@/lib/admin-media': { storageKeyFromMediaFileId: () => 'image' },
      });
      const response = await loadedModule.GET(new Request('https://example.test/api/media?id=image'), { params: Promise.resolve({ id: 'share', face: 'left', assetId: 'image' }) });
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
      assert.equal(response.headers.get('Content-Type'), mime);
      assert.equal(response.headers.get('Content-Disposition'), helper.inlineContentDisposition(name));
    }
  });
}

test('the admin media route sends other images straight to S3 with their name and type', async () => {
  for (const name of names) {
    const meta = { name, mimeType: 'image/png' };
    const signed = [];
    const loadedModule = loadTs('src/app/api/admin/media/file/route.ts', {
      'next/server': { NextResponse },
      '@/server/media-response-headers': helper,
      '@/server/media-assets': {
        readStoredObject: async () => { throw new Error('PNG must not be streamed'); },
        contentLengthHeader: () => ({}),
        presignedReadUrl: async (key, options) => { signed.push({ key, options }); return 'https://bucket.s3.amazonaws.com/image?signed=1'; },
      },
      '@/server/admin/auth': { requireAdminApi: async () => null },
      '@/server/admin/catalog': { findListedMedia: async () => meta },
      '@/lib/admin-media': { storageKeyFromMediaFileId: () => 'image' },
    });
    const response = await loadedModule.GET(new Request('https://example.test/api/admin/media/file?id=image'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), 'https://bucket.s3.amazonaws.com/image?signed=1');
    assert.deepEqual(signed, [{ key: 'image', options: { contentType: 'image/png', fileName: name } }]);
  }
});
