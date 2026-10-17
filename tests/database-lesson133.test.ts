import {test} from 'node:test';
import assert from 'node:assert/strict';
import {feedback,snapshot,total,type Config,type Wiring} from '../src/components/database-lab/lesson133/model';
const base:Config={amount:30,fault:'credit'};
test('133 shared transaction holds debit in draft and rolls both writes back on credit failure',()=>{
 const debit=snapshot(base,'shared',2);
 assert.deepEqual(debit.committed,{a:100,b:20});assert.deepEqual(debit.draft,{a:70,b:20});
 const failed=snapshot(base,'shared',3);assert.ok(failed.draft);assert.equal(failed.outcome,'pending');
 const end=snapshot(base,'shared',4);assert.deepEqual(end.committed,{a:100,b:20});assert.equal(end.draft,null);assert.equal(end.outcome,'rolledback');
});
test('133 split and escaped DB debit survive attempted transaction rollback',()=>{
 for(const wiring of ['split','escape'] as Wiring[]){
  const end=snapshot(base,wiring,4);assert.deepEqual(end.committed,{a:70,b:20});assert.equal(total(end.committed!),90);assert.equal(end.outcome,'partial');
 }
});
test('133 all paths can succeed but only shared path keeps committed total at every checkpoint',()=>{
 for(const wiring of ['split','shared','escape'] as Wiring[]){
  const config:Config={amount:45,fault:'none'};
  const end=snapshot(config,wiring,4);assert.deepEqual(end.committed,{a:55,b:65});assert.equal(end.outcome,'success');
  assert.equal(total(snapshot(config,wiring,2).committed!),wiring==='shared'?120:75);
  assert.deepEqual(snapshot(config,wiring,3).draft,{a:55,b:65});
 }
});
test('133 lost commit acknowledgement never claims success or rollback and retains both possibilities',()=>{
 for(const wiring of ['split','shared','escape'] as Wiring[]){
  const end=snapshot({amount:30,fault:'commit'},wiring,4);
  assert.equal(end.outcome,'unknown');assert.equal(end.committed,null);assert.equal(end.draft,null);
  assert.deepEqual(end.possibilities,[wiring==='shared'?{a:100,b:20}:{a:70,b:20},{a:70,b:50}]);
  assert.match(feedback('rolledback',end),/不同/);assert.match(feedback('unknown',end),/一致/);
 }
});
test('133 shared transaction preserves funds for every legal amount and supported fault',()=>{
 for(let amount=1;amount<=100;amount++)for(const fault of ['none','credit','commit'] as const){
  const end=snapshot({amount,fault},'shared',4);
  if(end.committed)assert.equal(total(end.committed),120);
  for(const possible of end.possibilities)assert.equal(total(possible),120);
 }
});
test('133 replay is deterministic, parameter changes recompute, and inputs are immutable',()=>{
 const frozen=Object.freeze({...base});const state=snapshot(frozen,'escape',4);
 snapshot(frozen,'escape',2);assert.deepEqual(snapshot(frozen,'escape',4),state);
 assert.deepEqual(snapshot({...base,amount:50},'escape',4).committed,{a:50,b:20});
 assert.deepEqual(frozen,base);assert.equal(snapshot(base,'shared',-4).step,0);assert.equal(snapshot(base,'shared',8).step,4);
});
