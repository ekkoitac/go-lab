import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,createTimeline,initialState,legalPredictions,predictionFeedback,readyBranches,seek,transition,type SelectState,type Stage} from '../src/components/select-lab/model';

const supply=(s:SelectState,branch:'a'|'b')=>transition(s,{type:'supply',branch});
const both=(stage:Stage=2)=>supply(supply(initialState(stage),'a'),'b');
const finish=(s:SelectState)=>transition(transition(s,{type:'next'}),{type:'next'});

test('single ready branch is selected, consumed exactly once and leaves select',()=>{
  const start=supply(initialState(),'b');
  assert.deepEqual(legalPredictions(start.board),['b']);
  const chosen=transition(start,{type:'execute'},()=>{throw Error('single branch needs no randomness');});
  assert.equal(chosen.phase,'ready');assert.equal(chosen.choice,'b');assert.equal(chosen.board.b,true);
  const end=finish(chosen);
  assert.equal(end.phase,'done');assert.equal(end.board.b,false);assert.equal(end.runs.length,1);
  assert.equal(transition(end,{type:'execute'}),end);assert.equal(transition(end,{type:'next'}),end);
  assert.equal(start.board.b,true,'input is immutable');
});

test('both legal choices preserve the unselected message regardless of case order',()=>{
  for(const sample of [0,0.499,0.5,0.999])for(const swapped of [false,true]){
    let start=both();if(swapped)start=transition(start,{type:'swap'});
    const choice=sample<0.5?'a':'b';
    const end=finish(transition(start,{type:'execute'},()=>sample));
    assert.equal(end.choice,choice);assert.equal(end.board.a,choice!=='a');assert.equal(end.board.b,choice!=='b');
    assert.deepEqual(legalPredictions(end.snapshot!),['a','b']);
    assert.deepEqual(start.board.order,swapped?['b','a']:['a','b']);
  }
});

test('choice is sampled once and conditions cannot change during reveal',()=>{
  let calls=0;const chosen=transition(both(),{type:'execute'},()=>{calls++;return .9;});
  for(const action of [{type:'swap'},{type:'default',enabled:true},{type:'supply',branch:'a'},{type:'clear'}] as const)assert.equal(transition(chosen,action),chosen);
  const next=transition(chosen,{type:'next'},()=>{throw Error('must not sample');});
  assert.equal(next.choice,'b');assert.equal(transition(next,{type:'next'}).choice,'b');assert.equal(calls,1);
});

test('arrival order matters through readiness at selection, not cross-channel priority',()=>{
  const aFirst=supply(initialState(4),'a');
  assert.equal(finish(transition(aFirst,{type:'execute'},()=>.9)).choice,'a');
  const bLater=supply(aFirst,'b');
  assert.equal(finish(transition(bLater,{type:'execute'},()=>.9)).choice,'b');
  const bFirst=supply(supply(initialState(4),'b'),'a');
  assert.equal(finish(transition(bFirst,{type:'execute'},()=>0)).choice,'a');
});

test('waiting select wakes on first event and cannot retroactively include a second event',()=>{
  const waiting=transition(initialState(4),{type:'execute'});
  assert.equal(waiting.phase,'waiting');assert.equal(waiting.snapshot,null);
  const awakened=supply(waiting,'b');assert.equal(awakened.choice,'b');assert.equal(awakened.phase,'ready');
  assert.equal(supply(awakened,'a'),awakened);assert.equal(awakened.runStart!.b,false);assert.equal(awakened.snapshot!.b,true);
  const retry=transition(finish(awakened),{type:'retry'});assert.equal(retry.board.b,true);assert.equal(retry.board.a,false);
});

test('default only executes when no communication is ready; switching it off clears hidden predictions',()=>{
  let s=transition(initialState(2),{type:'default',enabled:true});
  assert.deepEqual(legalPredictions(s.board),['default']);
  const end=finish(transition(s,{type:'execute'}));assert.equal(end.choice,'default');assert.equal(end.board.a,false);assert.equal(end.board.b,false);
  s=supply(s,'a');assert.equal(finish(transition(s,{type:'execute'})).choice,'a');
  s=transition(s,{type:'predict',value:'default'});s=transition(s,{type:'default',enabled:false});assert.deepEqual(s.prediction,[]);
  assert.deepEqual(legalPredictions(initialState().board),['wait']);
});

test('cancellation is persistent and neither receives a fictitious message nor prioritizes first case',()=>{
  const start=both(5);assert.deepEqual(start.board.order,['b','a']);
  const result=finish(transition(start,{type:'execute'},()=>0));assert.equal(result.choice,'a');assert.equal(result.board.cancelled,true);
  const cancel=finish(transition(start,{type:'execute'},()=>.9));assert.equal(cancel.choice,'b');assert.equal(cancel.board.cancelled,true);assert.equal(cancel.board.a,true);assert.equal(cancel.board.b,false);
  assert.deepEqual(readyBranches(cancel.board),['a','b']);
  const awakened=supply(transition(initialState(5),{type:'execute'}),'b');assert.equal(awakened.choice,'b');assert.equal(finish(awakened).board.cancelled,true);
});

test('retry restores snapshot and alternative path is explicit, deterministic and separately recorded',()=>{
  const end=finish(transition(both(),{type:'execute'},()=>0));
  const retry=transition(end,{type:'retry'});assert.deepEqual(retry.board,end.snapshot);assert.equal(retry.phase,'setup');
  assert.equal(finish(transition(retry,{type:'execute'},()=>.9)).choice,'b');
  const demo=finish(transition(end,{type:'alternative'},()=>{throw Error('demo must not sample');}));
  assert.equal(demo.choice,'b');assert.equal(demo.source,'demo');assert.deepEqual(demo.runs.map(r=>r.source),['random','demo']);
  const next=finish(transition(transition(demo,{type:'retry'}),{type:'execute'},()=>.9));assert.equal(next.source,'random');
});

test('rewind and forward retain results; a new action truncates future history and records',()=>{
  let t=createTimeline(2);t=applyAction(t,{type:'supply',branch:'a'});t=applyAction(t,{type:'supply',branch:'b'});
  const before=t.cursor;t=applyAction(t,{type:'execute'},()=>0);t=applyAction(t,{type:'next'});t=applyAction(t,{type:'next'});
  const end=t.cursor;let back=seek(t,before);assert.equal(seek(back,end).states[end].choice,'a');
  back=applyAction(back,{type:'execute'},()=>.9);assert.equal(back.states.length,before+2);assert.equal(back.states[back.cursor].choice,'b');
  assert.equal(back.states[back.cursor].runs.length,0);
});

test('predictions assess all possible outcomes and give misconception-specific feedback',()=>{
  const board=both().board;
  assert.match(predictionFeedback(board,['a','b']),/预测正确/);
  assert.match(predictionFeedback(board,['a']),/排在后面/);
  assert.match(predictionFeedback(board,['both']),/只执行一个分支/);
  assert.match(predictionFeedback(board,['wait']),/无需继续等待/);
  assert.match(predictionFeedback({...board,withDefault:true},['default']),/default 只在/);
  assert.equal(transition(both(),{type:'execute'},()=>0).feedback,null,'observing without a prediction is not a wrong answer');
});

test('new conditions retain comparison records but reset signal, snapshots, prediction and execution',()=>{
  const end=finish(transition(both(5),{type:'execute'},()=>.9));
  const fresh=transition(end,{type:'clear'});
  assert.equal(fresh.board.cancelled,false);assert.equal(fresh.board.a,false);assert.equal(fresh.snapshot,null);assert.equal(fresh.phase,'setup');assert.equal(fresh.runs.length,1);
  assert.deepEqual(fresh.board.order,['b','a']);
});
