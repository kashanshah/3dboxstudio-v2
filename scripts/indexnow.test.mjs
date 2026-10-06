import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INDEXNOW_KEY, changedUrls, pageFingerprint, parseSitemap, requestBody, withFingerprints } from './indexnow.mjs';

const xml = `<?xml version="1.0"?><urlset>
  <url><loc>https://www.3dboxstudio.com/</loc><changefreq>weekly</changefreq></url>
  <url><loc>https://www.3dboxstudio.com/blog/a</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
  <url><loc>https://www.3dboxstudio.com/blog/b?x=1&amp;y=2</loc><lastmod>2026-10-02T00:00:00.000Z</lastmod></url>
</urlset>`;

test('the key file served from public/ matches the key the script submits', () => {
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/);
  assert.equal(fs.readFileSync(new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url), 'utf8').trim(), INDEXNOW_KEY);
});

test('parses loc and lastmod, unescaping ampersands', () => {
  assert.deepEqual(parseSitemap(xml), [
    { loc: 'https://www.3dboxstudio.com/', lastmod: null },
    { loc: 'https://www.3dboxstudio.com/blog/a', lastmod: '2026-10-01T00:00:00.000Z' },
    { loc: 'https://www.3dboxstudio.com/blog/b?x=1&y=2', lastmod: '2026-10-02T00:00:00.000Z' },
  ]);
});

test('submits everything without state, then only new or changed URLs', () => {
  const entries = parseSitemap(xml).map(entry => ({ ...entry, hash: entry.lastmod ? null : 'h1' }));
  assert.equal(changedUrls(entries, null).length, 3);
  const previous = {
    'https://www.3dboxstudio.com/': { lastmod: null, hash: 'h1' },
    'https://www.3dboxstudio.com/blog/a': { lastmod: '2026-09-01T00:00:00.000Z', hash: null },
  };
  assert.deepEqual(changedUrls(entries, previous), ['https://www.3dboxstudio.com/blog/a', 'https://www.3dboxstudio.com/blog/b?x=1&y=2']);
  const same = Object.fromEntries(entries.map(e => [e.loc, { lastmod: e.lastmod, hash: e.hash }]));
  assert.deepEqual(changedUrls(entries, same), []);
});

test('pages without lastmod are resubmitted when their content changes, not when fetching fails', () => {
  const loc = 'https://www.3dboxstudio.com/';
  const previous = { [loc]: { lastmod: null, hash: 'old' } };
  assert.deepEqual(changedUrls([{ loc, lastmod: null, hash: 'new' }], previous), [loc]);
  assert.deepEqual(changedUrls([{ loc, lastmod: null, hash: 'old' }], previous), []);
  assert.deepEqual(changedUrls([{ loc, lastmod: null, hash: null }], previous), []);
});

test('fingerprints only the visible text inside <main>', () => {
  const page = (main, extra = '') => `<html><head><script src="/_next/${extra}.js"></script></head><body><header>Nav ${extra}</header><main id="main"><h1>Title</h1><script>self.__next_f.push(["${extra}"])</script><p>Body  text</p></main><footer>${extra}</footer></body></html>`.replace('Body', main);
  assert.equal(pageFingerprint(page('Body', 'build-a')), pageFingerprint(page('Body', 'build-b')));
  assert.notEqual(pageFingerprint(page('Body')), pageFingerprint(page('Changed')));
});

test('only pages without lastmod are fetched for a fingerprint', async () => {
  const fetched = [];
  const entries = await withFingerprints(parseSitemap(xml), async url => { fetched.push(url); return { ok: true, text: async () => '<main><p>Hi</p></main>' }; });
  assert.deepEqual(fetched, ['https://www.3dboxstudio.com/']);
  assert.match(entries[0].hash, /^[0-9a-f]{64}$/);
  assert.equal(entries[1].hash, null);
  const failed = await withFingerprints([{ loc: 'https://www.3dboxstudio.com/x', lastmod: null }], async () => ({ ok: false, status: 500 }));
  assert.equal(failed[0].hash, null);
});

test('request body names the host and key location and drops other hosts', () => {
  const body = requestBody(['https://www.3dboxstudio.com/faq', 'https://example.com/x']);
  assert.deepEqual(body, { host: 'www.3dboxstudio.com', key: INDEXNOW_KEY, keyLocation: `https://www.3dboxstudio.com/${INDEXNOW_KEY}.txt`, urlList: ['https://www.3dboxstudio.com/faq'] });
});
