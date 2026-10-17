import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAct53, initial53, transition53, type Action53 } from '../src/components/channel-lessons/model53';
const play = (...actions: Action53[]) => actions.reduce(transition53, initial53());
test('53: early receiver close succeeds, later producer send panics without discarding buffer', () => {
  const state = play({type:'send',actor:'A'},{type:'close',actor:'receiver'});
  assert.equal(state.closed,true); assert.deepEqual(state.queue,[1]); assert.equal(state.panic,null);
  const failed=transition53(state,{type:'send',actor:'B'});
  assert.equal(failed.outcome,'panic'); assert.match(failed.panic!,/send on closed/);
  assert.deepEqual(failed.queue,[1]); assert.deepEqual(state.sent,{A:true,B:false});
  assert.equal(transition53(failed,{type:'receive'}),failed);
});
test('53: Wait persists until both Done and closes once; buffered values survive', () => {
  const waiting=play({type:'close',actor:'coordinator'},{type:'send',actor:'A'},{type:'done',actor:'A'});
  assert.equal(waiting.coordinatorWaiting,true); assert.equal(waiting.closed,false);
  assert.equal(canAct53(waiting,{type:'close',actor:'coordinator'}),false);
  const both=transition53(transition53(waiting,{type:'send',actor:'B'}),{type:'done',actor:'B'});
  assert.equal(both.closed,true); assert.equal(both.coordinatorWaiting,false); assert.deepEqual(both.queue,[1,2]);
  let drained=transition53(transition53(both,{type:'receive'}),{type:'receive'});
  assert.deepEqual(drained.received,[1,2]); assert.equal(drained.outcome,'received');
  drained=transition53(drained,{type:'receive'});
  assert.equal(drained.outcome,'ended'); assert.equal(drained.ended,true);
});
test('53: pending receive is fulfilled by send and cannot execute receiver close while blocked',()=>{
  const waiting=transition53(initial53(),{type:'receive'});
  assert.equal(waiting.receiverWaiting,true);
  assert.equal(canAct53(waiting,{type:'close',actor:'receiver'}),false);
  assert.equal(transition53(waiting,{type:'close',actor:'receiver'}),waiting);
  const next=transition53(waiting,{type:'send',actor:'B'});
  assert.equal(next.receiverWaiting,false); assert.deepEqual(next.received,[2]); assert.deepEqual(next.queue,[]);
});
test('53: close wakes empty pending receive with ok=false',()=>{
  const state=play({type:'receive'},{type:'close',actor:'A'});
  assert.equal(state.closed,true); assert.equal(state.receiverWaiting,false); assert.equal(state.ended,true);
});
test('53: double close panics, including a waiting coordinator resuming after unsafe close',()=>{
  const double=play({type:'close',actor:'receiver'},{type:'close',actor:'A'});
  assert.match(double.panic!,/close of closed/);
  const deferred=play({type:'send',actor:'A'},{type:'send',actor:'B'},{type:'close',actor:'coordinator'},{type:'close',actor:'receiver'},{type:'done',actor:'A'},{type:'done',actor:'B'});
  assert.match(deferred.panic!,/close of closed/);
});
test('53: producer cannot Done before send or act again after exit; history snapshots stay immutable',()=>{
  const initial=initial53(); assert.equal(canAct53(initial,{type:'done',actor:'A'}),false);
  const after=transition53(transition53(initial,{type:'send',actor:'A'}),{type:'done',actor:'A'});
  assert.equal(canAct53(after,{type:'close',actor:'A'}),false);
  assert.deepEqual(initial.queue,[]); assert.deepEqual(initial.sent,{A:false,B:false});
});

