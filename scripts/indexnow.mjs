// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver) about new or
// changed pages after a production deploy. Google does not use IndexNow.
//
//   node scripts/indexnow.mjs [--all] [--dry-run] [--state <file>]
//
// Reads the live sitemap and submits URLs that are new or whose <lastmod>
// changed since the state file was written (all URLs on the first run, or
// with --all), then rewrites the state file. The key is public by design:
// search engines verify it at https://<host>/<key>.txt.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const INDEXNOW_KEY = '05beeff425d0f085ad0f0b8adf2cec30';
export const SITE = 'https://www.3dboxstudio.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH = 10000;

/** <loc> and optional <lastmod> for each <url> in a sitemap. */
export function parseSitemap(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: body.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim().replaceAll('&amp;', '&'),
    lastmod: body.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? null,
  })).filter(entry => entry.loc);
}

/** URLs to submit: new ones, and ones whose lastmod changed. Everything when there is no previous state. */
export function changedUrls(entries, previous) {
  if (!previous) return entries.map(entry => entry.loc);
  return entries.filter(entry => !(entry.loc in previous) || previous[entry.loc] !== entry.lastmod).map(entry => entry.loc);
}

export function requestBody(urls) {
  const host = new URL(SITE).host;
  return { host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: urls.filter(url => new URL(url).host === host) };
}

async function main(args) {
  const statePath = args.includes('--state') ? args[args.indexOf('--state') + 1] : '.indexnow-state.json';
  const dryRun = args.includes('--dry-run');
  const previous = !args.includes('--all') && fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null;

  const keyResponse = await fetch(`${SITE}/${INDEXNOW_KEY}.txt`);
  if (!keyResponse.ok || (await keyResponse.text()).trim() !== INDEXNOW_KEY) throw new Error('The IndexNow key file is not live yet; deploy public/<key>.txt first.');

  const sitemap = await fetch(`${SITE}/sitemap.xml`);
  if (!sitemap.ok) throw new Error(`Sitemap request failed: ${sitemap.status}`);
  const entries = parseSitemap(await sitemap.text());
  const urls = changedUrls(entries, previous);
  console.log(`${entries.length} sitemap URLs, ${urls.length} to submit${previous ? '' : ' (no previous state: submitting all)'}.`);

  for (let i = 0; i < urls.length; i += BATCH) {
    const body = requestBody(urls.slice(i, i + BATCH));
    if (dryRun) { console.log(body.urlList.join('\n')); continue; }
    const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
    // 200 and 202 both mean accepted; anything else is a configuration problem worth failing on.
    if (response.status !== 200 && response.status !== 202) throw new Error(`IndexNow rejected the batch: ${response.status} ${await response.text()}`);
    console.log(`Submitted ${body.urlList.length} URLs (HTTP ${response.status}).`);
  }
  if (!dryRun) fs.writeFileSync(statePath, JSON.stringify(Object.fromEntries(entries.map(entry => [entry.loc, entry.lastmod])), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(1); });
}
