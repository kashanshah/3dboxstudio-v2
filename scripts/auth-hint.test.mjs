import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const transpile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

function hint(cookie, stored = {}) {
  const exports = {};
  const localStorage = {getItem:key => stored[key] ?? null, setItem:(key, value) => { stored[key] = String(value); }};
  vm.runInNewContext(transpile('src/lib/auth-hint.ts'), {exports, document:{cookie}, window:{localStorage}});
  return {...exports, stored};
}

test('the provider asks /api/auth/me only with a hint, or once per browser for sessions older than the hint', () => {
  assert.equal(hint('a=1; 3dbs_signed_in=1').shouldCheckSession(), true);
  assert.equal(hint('3dbs_signed_in=1', {'3dbs_session_checked':'1'}).shouldCheckSession(), true, 'a hint always asks');
  assert.equal(hint('x3dbs_signed_in=1; 3dbs_signed_in=').hasSignedInHint(), false);
  const fresh = hint('');
  assert.equal(fresh.shouldCheckSession(), true, 'a browser that has never asked asks once');
  fresh.markSessionChecked();
  assert.equal(hint('', fresh.stored).shouldCheckSession(), false, 'then anonymous page views skip /me');
  const blocked = {};
  vm.runInNewContext(transpile('src/lib/auth-hint.ts'), {exports:blocked, document:{cookie:''}, window:{get localStorage() { throw Error('denied'); }}});
  assert.equal(blocked.shouldCheckSession(), true, 'without storage, correctness wins over the saved request');
});

async function me({sessionUser, hintCookie, lookupFails = false}) {
  const set = [];
  const exports = {};
  vm.runInNewContext(transpile('src/app/api/auth/me/route.ts'), {exports, require:name => {
    if (name === 'next/headers') return {cookies:async () => ({has:key => key === '3dbs_signed_in' && hintCookie})};
    if (name === 'next/server') return {NextResponse:{json:(body, init) => ({body, status:init?.status ?? 200})}};
    if (name === '@/server/db') return {ensureV2Schema:async () => {}};
    if (name === '@/server/auth/session') return {
      lookupCurrentUser:async () => { if (lookupFails) throw Error('db down'); return sessionUser; },
      setSignedInHint:async signedIn => { set.push(signedIn); },
    };
    if (name === '@/lib/auth-hint') return {SIGNED_IN_HINT_COOKIE:'3dbs_signed_in'};
    throw Error('unexpected import ' + name);
  }});
  return {response:await exports.GET(), set};
}

test('/api/auth/me sets the hint for a valid session, clears a stale one, and keeps it when the lookup fails', async () => {
  let result = await me({sessionUser:{id:'u'}, hintCookie:false});
  assert.deepEqual(result.set, [true], 'sessions created before the hint get one');
  assert.equal(result.response.body.user.id, 'u');
  result = await me({sessionUser:null, hintCookie:true});
  assert.deepEqual(result.set, [false]);
  assert.equal(result.response.body.user, null);
  result = await me({sessionUser:null, hintCookie:false});
  assert.deepEqual(result.set, [], 'anonymous responses carry no cookie');
  result = await me({lookupFails:true, hintCookie:true});
  assert.equal(result.response.status, 503);
  assert.deepEqual(result.set, [], 'a database error is not a sign-out');
});

test('every place that sets or clears the session cookie also sets or clears the hint', () => {
  const session = fs.readFileSync('src/server/auth/session.ts', 'utf8');
  assert.match(session, /export async function setSessionCookie[^}]+?maxAge:SESSION_TTL_DAYS\*24\*60\*60,\n  \}\);\n  await setSignedInHint\(true\);/);
  assert.match(session, /export async function clearSessionCookie[^}]+?maxAge:0\}\);\n  await setSignedInHint\(false\);/);
  assert.match(session, /httpOnly:false/);
});
