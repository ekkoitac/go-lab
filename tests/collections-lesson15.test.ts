import test from 'node:test';
import assert from 'node:assert/strict';
import { baseline, snapshot, shrink } from '../src/components/collections-lab/lesson15/model';
test('spare capacity shares elements but never automatically shares caller length', () => {
  const appended = snapshot(baseline, 2);
  assert.equal(appended.caller.len, 1);
  assert.equal(appended.local?.len, 2);
  assert.equal(appended.caller.array, appended.local?.array);
  assert.deepEqual(appended.callerValues, [7]);
  assert.deepEqual(appended.localValues, [7,8]);
  const edited = snapshot(baseline, 3);
  assert.deepEqual(edited.callerValues, [9]);
  assert.equal(edited.caller.len, 1);
  assert.deepEqual(snapshot(baseline, 5).callerValues, [9]);
});
test('insufficient capacity separates storage without assuming exact growth', () => {
  const state = snapshot({ ...baseline, capacity: 1 }, 3);
  assert.equal(state.caller.array,'A');
  assert.equal(state.local?.array,'B');
  assert.equal(state.local?.cap,'≥ 2');
  assert.deepEqual(state.callerValues,[7]);
  assert.deepEqual(state.localValues,[9,8]);
});
test('return and assignment are both needed across either capacity path', () => {
  for (const capacity of [1,3] as const) {
    const returned = snapshot({...baseline, capacity, returns:true},4);
    assert.equal(returned.local,null);
    assert.equal(returned.returned?.len,2);
    assert.equal(returned.caller.len,1);
    assert.equal(snapshot({...baseline,capacity,returns:true},5).caller.len,1);
    const received = snapshot({...baseline,capacity,returns:true,receives:true},5);
    assert.equal(received.caller.len,2);
    assert.deepEqual(received.callerValues,[9,8]);
  }
});
test('rewind reconstructs earlier state without leaking writes or return descriptors', () => {
  snapshot(baseline,5);
  assert.deepEqual(snapshot(baseline,1).arrays.A,[7,0,0]);
  assert.equal(snapshot(baseline,1).local?.len,1);
  assert.equal(snapshot(baseline,1).returned,null);
  assert.deepEqual(snapshot({...baseline,edit:false},3).callerValues,[7]);
  assert.throws(() => snapshot({...baseline,receives:true},3));
});
test('shortened slice result is concealed until checked and assignment controls caller length', () => {
  assert.equal(shrink(false,10,false),null);
  assert.deepEqual(shrink(false,10,true),{len:3,values:[10,20,30]});
  assert.deepEqual(shrink(true,5,true),{len:1,values:[5]});
});
