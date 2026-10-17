import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advance,back,initial,online,step,type Actor,type State,type Strategy} from '../src/components/database-lab/lesson134/model';
function run(strategy:Strategy,sequence:Actor[]):State{return sequence.reduce((s,a)=>advance(s,a),initial(strategy).state);}
const overlap:Actor[]=['甲','乙','甲','乙','甲','乙','甲','乙'];
const waitThenRead:Actor[]=['甲','乙','甲','甲','甲','乙','乙','乙','乙'];
test('134: separate row locks allow both decisions on two doctors and violate cross-row invariant',()=>{
 const state=run('own',overlap);assert.equal(online(state.rows),0);assert.equal(state.tx.甲.phase,'done');assert.equal(state.tx.乙.phase,'done');
 const sequential=run('own',['甲','甲','甲','甲','乙','乙','乙','乙']);assert.equal(online(sequential.rows),1);
});
test('134: common RC lock waits; new SQL sees committed count and refuses the last departure',()=>{
 let state=run('rc',['甲','乙']);assert.equal(state.effect,'waiting');assert.equal(state.tx.乙.phase,'lock');assert.equal(state.tx.乙.readCount,null);
 state=run('rc',waitThenRead);assert.equal(state.tx.乙.readCount,1);assert.equal(online(state.rows),1);assert.equal(state.lock,null);
});
test('134: unchanged common lock does not refresh RR snapshot after waiting',()=>{
 const state=run('rr',waitThenRead);assert.equal(state.tx.乙.snapshot?.甲,true);assert.equal(state.tx.乙.readCount,2);assert.equal(online(state.rows),0);
 // Starting B after A commits gets a newer transaction snapshot, so schedule matters.
 assert.equal(online(run('rr',['甲','甲','甲','甲','乙','乙','乙','乙']).rows),1);
});
test('134: tentative departure is not committed visibility',()=>{
 const state=run('own',['甲','甲','甲']);assert.equal(state.tx.甲.pending,false);assert.equal(state.rows.甲,true);assert.equal(online(state.rows),2);
});
test('134: serializable abort discards pending write; full retry rereads and preserves one',()=>{
 let state=run('serializable',overlap);assert.equal(state.tx.乙.phase,'aborted');assert.equal(state.tx.乙.pending,null);assert.equal(state.rows.乙,true);assert.equal(online(state.rows),1);
 state=advance(state,'乙');assert.equal(state.effect,'retry');assert.equal(state.tx.乙.attempt,2);assert.equal(state.tx.乙.snapshot,null);assert.equal(state.tx.乙.readCount,null);
 for(let i=0;i<4;i++)state=advance(state,'乙');assert.equal(state.tx.乙.readCount,1);assert.equal(state.tx.乙.phase,'done');assert.equal(online(state.rows),1);
 const reversed=run('serializable',['乙','甲','乙','甲','乙','甲','乙','甲']);assert.equal(reversed.tx.甲.phase,'aborted');assert.equal(online(reversed.rows),1);
});
test('134: immutable history preserves prediction, back restores exact state, finished steps are inert',()=>{
 const start=initial();const prediction={effect:'locked' as const,online:2,reason:'own row'};const first=step(start,'甲',prediction);prediction.reason='edited';assert.equal(first.runs[0].prediction.reason,'own row');assert.equal(start.state.tx.甲.phase,'lock');assert.deepEqual(back(first),start);assert.equal(back(start),start);
 const final=run('own',['甲','甲','甲','甲']);assert.equal(advance(final,'甲'),final);
 assert.throws(()=>step(start,'甲',{effect:'locked',online:2,reason:' '}));assert.throws(()=>step(start,'甲',{effect:'locked',online:3,reason:'x'}));
});
