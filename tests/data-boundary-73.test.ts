import assert from 'node:assert/strict';
import {test} from 'node:test';
import {evaluate,snapshot,changeDigit,changedPositions,validateInput,MIN_INT64,MAX_INT64,type Strategy} from '../src/components/data-boundary-lab/lesson73/model';

test('73 float64 neighboring integers reveal rounding without parsing text first',()=>{
 for(const [input,decoded,outcome] of [['9007199254740991','9007199254740991','exact'],['9007199254740992','9007199254740992','exact'],['9007199254740993','9007199254740992','changed'],['9007199254740994','9007199254740994','exact'],['9007199254740995','9007199254740996','changed'],['-9007199254740993','-9007199254740992','changed']]){
 const r=evaluate(input,'float64');assert.equal(r.raw,input);assert.equal(r.decoded,decoded);assert.equal(r.outcome,outcome);
 }
 assert.equal(changeDigit('9007199254740992',1n),'9007199254740993');
 assert.equal(changedPositions('9007199254740993','9007199254740992').filter(d=>d.changed).length,1);
});
test('73 both int64 endpoints and overflow are validated for explicit and deferred conversion',()=>{
 for(const strategy of ['number','int64'] as Strategy[]){
  for(const raw of [MIN_INT64.toString(),MAX_INT64.toString()]){const r=evaluate(raw,strategy);assert.equal(r.outcome,'exact');assert.equal(r.converted,raw)}
  for(const raw of [(MIN_INT64-1n).toString(),(MAX_INT64+1n).toString()]){const r=evaluate(raw,strategy);assert.equal(r.outcome,'error');assert.ok(r.error);assert.equal(r.decoded,strategy==='number'?raw:'解码失败')}
 }
 assert.equal(evaluate(MAX_INT64.toString(),'float64').outcome,'error');
 assert.equal(evaluate(MIN_INT64.toString(),'float64').outcome,'exact');
});
test('73 string ID retains arbitrarily large teaching identifier; UseNumber preserves but cannot Int64 it',()=>{
 const raw='123456789012345678901234567890';
 assert.equal(evaluate(raw,'string').converted,raw);assert.equal(evaluate(raw,'string').outcome,'exact');
 assert.equal(evaluate(raw,'number').decoded,raw);assert.equal(evaluate(raw,'number').outcome,'error');
});
test('73 rejects malformed or out-of-scope JSON integer input explicitly',()=>{
 for(const raw of ['', '01','+1','1.5','1e3',' 2','2 ','NaN','Infinity','1;alert(1)','9'.repeat(121)]){
  assert.ok(validateInput(raw));for(const strategy of ['float64','number','int64','string'] as Strategy[])assert.equal(evaluate(raw,strategy).outcome,'error');
 }
 assert.equal(validateInput('-0'),null);assert.equal(evaluate('-0','number').converted,'0');
});
test('73 snapshots hide results until their stage and are deterministic on rewind/reset',()=>{
 const raw='9007199254740993';const before=snapshot(raw,'float64',0);assert.equal(before.decoded,null);assert.equal(before.outcome,null);
 assert.equal(snapshot(raw,'float64',1).decoded,'9007199254740992');assert.equal(snapshot(raw,'float64',1).converted,null);
 assert.equal(snapshot(raw,'float64',2).outcome,null);const end=snapshot(raw,'float64',3);
 snapshot(raw,'float64',2);assert.deepEqual(snapshot(raw,'float64',3),end);assert.deepEqual(snapshot(raw,'float64',0),before);
 assert.equal(snapshot(raw,'number',0).decoded,null);assert.equal(snapshot('42','float64',0).converted,null);
 assert.doesNotThrow(()=>JSON.stringify(end));
});
