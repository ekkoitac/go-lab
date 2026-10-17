import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorize,back,defaults,initial,observe,step,type Request} from '../src/components/security-lab/lesson181/model';
test('181: trusted identity, tenant and action are separate required gates',()=>{
  assert.equal(authorize(defaults),'tenant');
  assert.equal(authorize({...defaults,trusted:false}),'identity');
  assert.equal(authorize({...defaults,resourceTenant:'A'}),'permission');
  assert.equal(authorize({...defaults,resourceTenant:'A',action:'read'}),'allow');
  assert.equal(authorize({...defaults,resourceTenant:'A',action:'update'}),'permission');
  assert.equal(authorize({...defaults,resourceTenant:'A',role:'editor',action:'update'}),'allow');
});
test('181: unknown and missing claims fail closed, body role cannot elevate privileges',()=>{
  for(const r of [{role:'unknown',action:'read'},{role:'editor',action:'export'},{tenant:'',resourceTenant:'',role:'editor',action:'read'}]) assert.notEqual(authorize({...defaults,resourceTenant:'A',...r} as Request),'allow');
  for(const claimedRole of ['reader','editor','unknown'] as const) assert.equal(authorize({...defaults,claimedRole,resourceTenant:'A',action:'update'}),'permission');
});
test('181: weak login gate deletes foreign resource while secure policy never mutates it',()=>{
  let s=initial();
  assert.throws(()=>step(s));assert.throws(()=>step(s,{value:'tenant',reason:'  '}));
  s=step(s,{value:'tenant',reason:'A is not B'});
  assert.deepEqual(observe(s).gates,['pass','pending','pending']);
  assert.equal(observe(s).verdict,null);
  s=step(s);assert.deepEqual(observe(s).gates,['pass','deny','pending']);
  s=step(s);assert.deepEqual(observe(s).gates,['pass','deny','skip']);
  assert.equal(observe(s).weakOrder,'原始订单');
  s=step(s);assert.equal(observe(s).weakOrder,'已删除');assert.equal(observe(s).secureOrder,'原始订单');
  assert.equal(observe(s).secureExecuted,false);assert.equal(observe(s).weakExecuted,true);
  assert.equal(observe(back(s)).weakOrder,'原始订单');
});
test('181: rewind and deterministic replay preserve inputs without sharing mutable prediction',()=>{
  const request={...defaults};const s=initial(request);request.tenant='B';assert.equal(s.request.tenant,'A');
  const p={value:'tenant' as const,reason:'A and B differ'};const next=step(s,p);p.reason='changed';assert.equal(next.prediction?.reason,'A and B differ');
  assert.deepEqual(back(next),s);assert.equal(s.phase,0);
  let allowed=initial({...defaults,resourceTenant:'A',role:'editor',action:'update'});
  for(let i=0;i<4;i++)allowed=step(allowed,{value:'allow',reason:'same tenant and edit grant'});
  assert.equal(observe(allowed).secureOrder,'已更新');assert.deepEqual(step(allowed),allowed);
});
