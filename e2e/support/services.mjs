// Stand-ins for the site's outside services, for the browser tests:
//
//  - a Postgres database that speaks the Neon HTTP protocol the site's
//    database driver uses (PGlite: real Postgres, in memory, nothing to
//    install), on E2E_DB_PORT;
//  - an S3 bucket (path-style, in memory, signatures not checked) for
//    uploaded artwork and design previews, on E2E_S3_PORT;
//  - an inbox standing in for Resend's email API, on E2E_MAIL_PORT. Tests
//    read what was sent from GET /emails (newest first).
//
// Everything is thrown away when the process stops. Started by
// playwright.config.ts; run it alone with `node e2e/support/services.mjs`.

import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';

const DB_PORT = Number(process.env.E2E_DB_PORT || 5490);
const S3_PORT = Number(process.env.E2E_S3_PORT || 5491);
const MAIL_PORT = Number(process.env.E2E_MAIL_PORT || 5492);

// ---------------------------------------------------------------- database

const db = new PGlite('memory://');
await db.waitReady;

// Hand every value back as Postgres text, as Neon's HTTP API does; the
// driver parses it itself.
let parsers = {};
async function refreshParsers() {
  const { rows } = await db.query('SELECT oid::int AS oid FROM pg_type');
  parsers = Object.fromEntries(rows.map(({ oid }) => [oid, (value) => value]));
}
await refreshParsers();

async function runQuery(query, target = db) {
  const result = await target.query(query.query, query.params ?? [], { rowMode: 'array', parsers });
  if (/\bCREATE\s+(TYPE|DOMAIN)\b/i.test(query.query)) await refreshParsers();
  return {
    fields: result.fields.map((field) => ({ name: field.name, dataTypeID: field.dataTypeID })),
    rows: result.rows,
    command: 'SELECT',
    rowCount: result.affectedRows ?? result.rows.length,
    rowAsArray: true,
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

http.createServer(async (req, res) => {
  try {
    const body = JSON.parse((await readBody(req)).toString('utf8'));
    const out = Array.isArray(body.queries)
      ? { results: await db.transaction(async (tx) => { const results = []; for (const query of body.queries) results.push(await runQuery(query, tx)); return results; }) }
      : await runQuery(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out));
  } catch (error) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: error.message, code: error.code, severity: error.severity, detail: error.detail }));
  }
}).listen(DB_PORT, '127.0.0.1');

// ---------------------------------------------------------------------- S3

const objects = new Map(); // "bucket/key" -> { body, type, modified }

// The AWS SDK sends uploads in aws-chunked framing: "<hex size>[;...]\r\n<data>\r\n" … "0\r\n<trailers>".
function decodeAwsChunked(buffer) {
  const parts = [];
  let offset = 0;
  for (;;) {
    const lineEnd = buffer.indexOf('\r\n', offset);
    if (lineEnd < 0) break;
    const size = parseInt(buffer.subarray(offset, lineEnd).toString('ascii').split(';')[0], 16);
    if (!size) break;
    parts.push(buffer.subarray(lineEnd + 2, lineEnd + 2 + size));
    offset = lineEnd + 2 + size + 2;
  }
  return Buffer.concat(parts);
}

const xml = (body) => `<?xml version="1.0" encoding="UTF-8"?>${body}`;
const escapeXml = (value) => value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
const etag = (body) => `"${body.length.toString(16)}"`;

http.createServer(async (req, res) => {
  const cors = {
    'access-control-allow-origin': req.headers.origin || '*',
    'access-control-allow-methods': 'GET,HEAD,PUT,DELETE',
    'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
    'access-control-expose-headers': 'ETag',
  };
  try {
    const url = new URL(req.url, 'http://localhost');
    const [bucket, ...rest] = url.pathname.slice(1).split('/');
    const key = decodeURIComponent(rest.join('/'));
    const id = `${bucket}/${key}`;
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

    if (req.method === 'GET' && !key && url.searchParams.get('list-type') === '2') {
      const prefix = url.searchParams.get('prefix') || '';
      const keys = [...objects.keys()].filter((name) => name.startsWith(`${bucket}/${prefix}`)).map((name) => name.slice(bucket.length + 1));
      const contents = keys.map((name) => `<Contents><Key>${escapeXml(name)}</Key><Size>${objects.get(`${bucket}/${name}`).body.length}</Size></Contents>`).join('');
      res.writeHead(200, { ...cors, 'content-type': 'application/xml' });
      return res.end(xml(`<ListBucketResult><Name>${bucket}</Name><Prefix>${escapeXml(prefix)}</Prefix><KeyCount>${keys.length}</KeyCount><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`));
    }

    if (req.method === 'PUT') {
      const source = req.headers['x-amz-copy-source'];
      if (source) {
        const from = objects.get(decodeURIComponent(String(source)).replace(/^\//, ''));
        if (!from) { res.writeHead(404, cors); return res.end(xml('<Error><Code>NoSuchKey</Code></Error>')); }
        objects.set(id, { ...from, modified: new Date() });
        res.writeHead(200, { ...cors, 'content-type': 'application/xml' });
        return res.end(xml(`<CopyObjectResult><ETag>${etag(from.body)}</ETag><LastModified>${new Date().toISOString()}</LastModified></CopyObjectResult>`));
      }
      let body = await readBody(req);
      if (String(req.headers['content-encoding'] || '').includes('aws-chunked') || req.headers['x-amz-decoded-content-length']) body = decodeAwsChunked(body);
      objects.set(id, { body, type: req.headers['content-type'] || 'application/octet-stream', modified: new Date() });
      res.writeHead(200, { ...cors, etag: etag(body) });
      return res.end();
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const object = objects.get(id);
      if (!object) { res.writeHead(404, { ...cors, 'content-type': 'application/xml' }); return res.end(req.method === 'HEAD' ? undefined : xml('<Error><Code>NoSuchKey</Code></Error>')); }
      res.writeHead(200, { ...cors, 'content-type': object.type, 'content-length': object.body.length, etag: etag(object.body), 'last-modified': object.modified.toUTCString() });
      return res.end(req.method === 'HEAD' ? undefined : object.body);
    }

    if (req.method === 'DELETE') {
      objects.delete(id);
      res.writeHead(204, cors);
      return res.end();
    }

    res.writeHead(405, cors);
    res.end();
  } catch (error) {
    res.writeHead(500, { ...cors, 'content-type': 'text/plain' });
    res.end(String(error?.stack || error));
  }
}).listen(S3_PORT, '127.0.0.1');

// ------------------------------------------------------------------- email

const emails = [];

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('content-type', 'application/json');
  if (req.method === 'POST' && url.pathname === '/emails') {
    const message = JSON.parse((await readBody(req)).toString('utf8'));
    const id = `email_${emails.length + 1}`;
    emails.unshift({ id, created_at: new Date().toISOString(), last_event: 'delivered', ...message, to: [].concat(message.to) });
    return res.end(JSON.stringify({ id }));
  }
  if (req.method === 'GET' && url.pathname === '/emails') return res.end(JSON.stringify({ object: 'list', has_more: false, data: emails }));
  const one = req.method === 'GET' && emails.find((email) => url.pathname === `/emails/${email.id}`);
  if (one) return res.end(JSON.stringify(one));
  res.statusCode = 404;
  res.end(JSON.stringify({ message: 'Not found' }));
}).listen(MAIL_PORT, '127.0.0.1');

console.log(`e2e services ready: database on ${DB_PORT}, S3 on ${S3_PORT}, email on ${MAIL_PORT}`);
