/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const {
  DEFAULT_IMAGE_SETTINGS, IMAGE_LONG_SIDE, IMAGE_SHOTS, crc32, imageBackground, imageFileName, imageFrame, imageLongSide, imageMimeType, zipFiles,
} = require('../src/lib/packaging/image-export.ts');

test('defaults to a transparent 4K PNG of the current view, as before', () => {
  assert.deepEqual(DEFAULT_IMAGE_SETTINGS, { size: '4k', format: 'png', background: { kind: 'transparent' }, angles: 'current' });
  assert.equal(imageMimeType('png'), 'image/png');
  assert.equal(imageMimeType('jpg'), 'image/jpeg');
});

test('the long side follows the size, capped on phones and by the GPU', () => {
  assert.deepEqual([imageLongSide('hd', false), imageLongSide('2k', false), imageLongSide('4k', false)], [1920, 2560, 3840]);
  assert.equal(imageLongSide('4k', true), 2560);
  assert.equal(imageLongSide('hd', true), 1920);
  assert.equal(imageLongSide('4k', false, 2048), 2048);
});

test('frames keep the view\'s shape with the long side at the chosen size', () => {
  assert.deepEqual(imageFrame(3840, 16 / 9), { width: 3840, height: 2160 });
  assert.deepEqual(imageFrame(1920, 0.5), { width: 960, height: 1920 });
  assert.deepEqual(imageFrame(2560, 1), { width: 2560, height: 2560 });
  assert.deepEqual(imageFrame(1920, NaN), { width: 1920, height: 1920 });
  for (const size of Object.values(IMAGE_LONG_SIDE)) assert.ok(size >= 1920);
});

test('a JPG cannot be transparent, so it goes on white; other backgrounds stay', () => {
  const jpg = { ...DEFAULT_IMAGE_SETTINGS, format: 'jpg' };
  assert.deepEqual(imageBackground(jpg), { kind: 'color', color: '#ffffff' });
  assert.deepEqual(imageBackground(DEFAULT_IMAGE_SETTINGS), { kind: 'transparent' });
  assert.deepEqual(imageBackground({ ...jpg, background: { kind: 'studio' } }), { kind: 'studio' });
  assert.deepEqual(imageBackground({ ...jpg, background: { kind: 'color', color: '#112233' } }), { kind: 'color', color: '#112233' });
});

test('the standard views are front, three-quarter, back and top, named in the files', () => {
  assert.deepEqual(IMAGE_SHOTS.map(shot => shot.id), ['front', 'three-quarter', 'back', 'top']);
  const top = IMAGE_SHOTS.find(shot => shot.id === 'top');
  assert.ok(top.pitch > 1 && top.pitch < Math.PI / 2, 'top looks down without going over');
  assert.equal(imageFileName('mailer-box', 'png'), '3d-box-studio-mailer-box.png');
  assert.equal(imageFileName('mailer-box', 'jpg', 'three-quarter'), '3d-box-studio-mailer-box-three-quarter.jpg');
});

test('crc32 matches zlib', () => {
  const data = new TextEncoder().encode('3D Box Studio');
  assert.equal(crc32(data), zlib.crc32(data));
  assert.equal(crc32(new Uint8Array()), 0);
});

test('the ZIP of views is a valid stored archive', () => {
  const files = [
    { name: 'front.png', data: new Uint8Array([1, 2, 3, 4]) },
    { name: 'back.png', data: new TextEncoder().encode('back view') },
  ];
  const zip = Buffer.from(zipFiles(files, new Date(2026, 9, 14, 12, 30, 10)));
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  assert.equal(zip.readUInt16LE(end + 10), 2);
  let at = zip.readUInt32LE(end + 16);
  for (const file of files) {
    assert.equal(zip.readUInt32LE(at), 0x02014b50);
    const size = zip.readUInt32LE(at + 24), nameLength = zip.readUInt16LE(at + 28), offset = zip.readUInt32LE(at + 42);
    assert.equal(zip.toString('utf8', at + 46, at + 46 + nameLength), file.name);
    assert.equal(zip.readUInt32LE(offset), 0x04034b50);
    const local = offset + 30 + zip.readUInt16LE(offset + 26);
    assert.deepEqual(new Uint8Array(zip.subarray(local, local + size)), file.data);
    assert.equal(zip.readUInt32LE(at + 16), zlib.crc32(file.data));
    assert.equal(zip.readUInt16LE(offset + 12), ((2026 - 1980) << 9) | (10 << 5) | 14);
    at += 46 + nameLength;
  }
  assert.equal(at, end);
});
