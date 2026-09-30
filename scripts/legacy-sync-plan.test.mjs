import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, planMirror, planUserUpdate, userSnapshot } from './legacy-sync-plan.mjs';
const user = {id:'u1',name:'Old',password_hash:'old-hash',email_verified_at:null};
test('week-later sync imports new records and catches edits without updated_at',()=>{
  const original = {id:'d1',view_count:1,images:{front:'a'}};
  const changed = {...original,view_count:10};
  const plan = planMirror([changed,{id:'d2',images:{}}],[{source_id:'d1',source_hash:fingerprint(original)}]);
  assert.equal(plan.inserted,1); assert.equal(plan.updated,1); assert.equal(plan.changed.length,2);
  const rerun = planMirror(plan.changed.map(row=>row.payload),plan.changed.map(row=>({source_id:row.id,source_hash:row.hash})));
  assert.equal(rerun.changed.length,0); assert.equal(rerun.unchanged,2);
});
test('deletions are marked once and restored records are imported again',()=>{
  assert.deepEqual(planMirror([],[{source_id:'d1',source_hash:'x'}]).deleted,['d1']);
  assert.deepEqual(planMirror([],[{source_id:'d1',source_hash:'x',deleted_at:'today'}]).deleted,[]);
  assert.equal(planMirror([{id:'d1'}],[{source_id:'d1',source_hash:fingerprint({id:'d1'}),deleted_at:'today'}]).updated,1);
});
test('three-way merge updates V1 changes while preserving V2 password and profile changes',()=>{
  const next = {...user,name:'V1 new',password_hash:'V1 password',email_verified_at:'verified'};
  const target = {...user,name:'V2 new',password_hash:'V2 password'};
  const plan = planUserUpdate(next,target,userSnapshot(user));
  assert.deepEqual(plan.updates,{email_verified_at:'verified'});
  assert.deepEqual(plan.conflicts,['name','password_hash']);
  assert.deepEqual(planUserUpdate(next,user,userSnapshot(user)).updates,{name:'V1 new',password_hash:'V1 password',email_verified_at:'verified'});
});
test('old ledgers with no merge baseline preserve imported accounts',()=>{
  assert.deepEqual(planUserUpdate({...user,name:'new'},user,undefined).updates,{});
});
test('JSON order does not trigger reimports; duplicate IDs are rejected',()=>{
  assert.equal(fingerprint({a:1,b:{c:2,d:3}}),fingerprint({b:{d:3,c:2},a:1}));
  assert.throws(()=>planMirror([{id:'a'},{id:'a'}],[]),/duplicate/);
});
