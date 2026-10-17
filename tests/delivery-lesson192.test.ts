import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverage,defaults,simulate,sortContract} from '../src/components/delivery-lab/lesson192/model';

test('192 concurrent map reports two successful writes but loses one increment',()=>{
 const state=simulate(defaults,5);
 assert.equal(state.fake.successes,2); assert.equal(state.fake.value,110); assert.equal(state.fakeLost,10);
 assert.equal(state.reference.successes,1); assert.equal(state.reference.conflicts,1); assert.equal(state.referenceLost,0);
 assert.equal(state.reference.reads.B?.version,1);
});
test('192 rereading on reported conflict repairs reference model without repairing silent fake loss',()=>{
 const state=simulate({...defaults,retry:true,delta:27},5);
 assert.equal(state.reference.value,154); assert.equal(state.reference.successes,2); assert.equal(state.reference.conflicts,1);
 assert.equal(state.reference.reads.B?.version,2); assert.equal(state.referenceLost,0);
 assert.equal(state.fake.value,127); assert.equal(state.fakeLost,27);
});
test('192 serial execution passes both models and does not establish concurrent semantics',()=>{
 for(const retry of [false,true]) {
 const state=simulate({...defaults,concurrent:false,retry,delta:3},5);
 assert.equal(state.fake.value,106); assert.equal(state.reference.value,106);
 assert.equal(state.reference.conflicts,0);assert.equal(state.fakeLost,0);
 }
});
test('192 replay and rewind preserve inputs and show conflicting commit leaves value unchanged',()=>{
 const original={...defaults};const initial=simulate(original,0),read=simulate(original,2);
 const before=simulate(original,3),after=simulate(original,4);
 assert.deepEqual(original,defaults); assert.deepEqual(simulate(original,0),initial);
 assert.equal(read.reference.reads.A?.version,1);assert.equal(read.reference.reads.B?.version,1);
 assert.equal(before.reference.value,after.reference.value);assert.equal(before.reference.version,after.reference.version);
 assert.equal(after.reference.conflicts,before.reference.conflicts+1);
 assert.deepEqual(simulate(original,3),before);
 assert.equal(simulate(original,NaN).cursor,0); assert.equal(simulate(original,99).cursor,5);
 assert.equal(simulate({...original,delta:NaN},1).options.delta,10);
});
test('192 sorting contract has explicit null and tie ordering and does not mutate supplied rows',()=>{
 const rows=[{id:'B',rank:2},{id:'A',rank:null},{id:'D',rank:1},{id:'C',rank:1}];
 assert.deepEqual(sortContract(rows,false).map(x=>x.id),['B','A','D','C']);
 assert.deepEqual(sortContract(rows,true).map(x=>x.id),['C','D','B','A']);
 assert.equal(rows[0].id,'B');assert.notEqual(sortContract(rows,false)[0],rows[0]);
});
test('192 shared tests cannot confer real driver coverage on fake',()=>{
 assert.deepEqual(coverage(false,false),{fake:[],real:[]});
 assert.equal(coverage(true,false).real.includes('真实隔离级别'),false);
 assert.equal(coverage(true,true).real.includes('真实隔离级别'),true);
 assert.equal(coverage(true,true).fake.includes('真实隔离级别'),false);
 assert.deepEqual(coverage(false,true).fake,[]);
});

test('192 output contract detects loss while private call count passes both implementations',async()=>{
 const {evaluateAssertions}=await import('../src/components/delivery-lab/lesson192/model');
 const observable=evaluateAssertions('value'),internal=evaluateAssertions('calls');
 assert.equal(observable.fake.passed,false);assert.equal(observable.reference.passed,true);
 assert.equal(internal.fake.passed,true);assert.equal(internal.reference.passed,true);
 assert.equal(observable.fake.value,internal.fake.value);
});
