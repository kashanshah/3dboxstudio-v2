import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INDEXNOW_KEY, changedUrls, parseSitemap, requestBody } from './indexnow.mjs';

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
  const entries = parseSitemap(xml);
  assert.equal(changedUrls(entries, null).length, 3);
  const previous = { 'https://www.3dboxstudio.com/': null, 'https://www.3dboxstudio.com/blog/a': '2026-09-01T00:00:00.000Z' };
  assert.deepEqual(changedUrls(entries, previous), ['https://www.3dboxstudio.com/blog/a', 'https://www.3dboxstudio.com/blog/b?x=1&y=2']);
  assert.deepEqual(changedUrls(entries, Object.fromEntries(entries.map(e => [e.loc, e.lastmod]))), []);
});

test('request body names the host and key location and drops other hosts', () => {
  const body = requestBody(['https://www.3dboxstudio.com/faq', 'https://example.com/x']);
  assert.deepEqual(body, { host: 'www.3dboxstudio.com', key: INDEXNOW_KEY, keyLocation: `https://www.3dboxstudio.com/${INDEXNOW_KEY}.txt`, urlList: ['https://www.3dboxstudio.com/faq'] });
});
