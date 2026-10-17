import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cases,readState} from '../src/components/io-lab/lesson61/model';
test('data and EOF coexist; only data-first consumes the final bytes',()=>{
  const good=readState(cases.final,'data-first',3),bad=readState(cases.final,'error-first',3);
  assert.equal(good.saved,'XYZ');assert.equal(good.status,'eof');assert.equal(bad.saved,'');assert.equal(bad.lost,'XYZ');
});
test('non-EOF error retains valid prefix without claiming success',()=>{
  const result=readState(cases.partial,'data-first',3);assert.equal(result.saved,'AB');assert.equal(result.status,'error');assert.ok(!result.saved.includes('?'));
});
test('zero nil does not terminate as EOF; successful reads work in either order',()=>{
  for(const policy of ['data-first','error-first'] as const){assert.equal(readState(cases.empty,policy,3).status,'no-progress');assert.equal(readState(cases.normal,policy,3).saved,'OK');assert.equal(readState(cases.normal,policy,3).status,'continue');}
});
test('rewind recomputes state without duplicate consumption or mutation',()=>{
  const original=JSON.stringify(cases.final);assert.equal(readState(cases.final,'data-first',2).saved,'XYZ');assert.equal(readState(cases.final,'data-first',1).saved,'');assert.equal(readState(cases.final,'data-first',3).saved,'XYZ');assert.equal(JSON.stringify(cases.final),original);
});
test('invalid byte counts and non-ASCII model inputs are rejected',()=>{
  for(const n of [-1,5,1.2])assert.throws(()=>readState({...cases.final,n},'data-first',3));assert.throws(()=>readState({bytes:'汉',n:1,error:null},'data-first',3));
});
