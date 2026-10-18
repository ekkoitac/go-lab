import test from 'node:test';
import assert from 'node:assert/strict';
import { baseline, initial, transition, inspect, replay, comparison, allowed, transferTasks } from '../src/components/collections-lab/lesson17/model';
test('capacity limits retain the entire backing array after the original reference is removed', () => {
  const s = replay(baseline,['cap','drop-buffer']);
  assert.equal(s.capacity,2);
  assert.equal(s.bytes,1024);
  assert.equal(s.reachablePayloadBytes,1024);
  assert.equal(s.aReachable,true);
  assert.deepEqual(s.roots,['token']);
  assert.equal(s.copiedBytes,0);
});
test('independent copy changes target and cost but other references still retain A', () => {
  const copied = replay(baseline,['copy']);
  assert.equal(copied.token,'B');
  assert.equal(copied.copiedBytes,2);
  assert.equal(copied.reachablePayloadBytes,1026);
  assert.deepEqual(copied.roots,['buffer']);
  const released = replay(baseline,['copy','drop-buffer']);
  assert.equal(released.eligible,true);
  assert.equal(released.aReachable,false);
  assert.equal(released.reachablePayloadBytes,2);
  assert.equal('collected' in released,false);
});
test('a second alias blocks eligibility until the last reference disappears', () => {
  const actions = ['keep-alias','copy','drop-buffer'] as const;
  const s = replay(baseline,[...actions]);
  assert.deepEqual(s.roots,['other']);
  assert.equal(s.eligible,false);
  const final = inspect(transition(s,'drop-alias'));
  assert.equal(final.eligible,true);
  assert.equal(final.reachablePayloadBytes,2);
  assert.equal(replay(baseline,actions.slice(0,-1)).buffer,true);
});
test('replay supports exact rewind and branch without mutating previous snapshots', () => {
  const start = initial();
  const cap = transition(start,'cap');
  assert.equal(start.capacity,1024);
  assert.equal(cap.capacity,2);
  const branch = replay(baseline,['cap','copy','drop-buffer']);
  assert.equal(branch.eligible,true);
  assert.deepEqual(replay(baseline,[]),inspect(start));
  const noBuffer = transition(start,'drop-buffer');
  assert.equal(allowed(noBuffer,'keep-alias'),false);
  assert.equal(transition(noBuffer,'keep-alias'),noBuffer);
});
test('controlled comparison keeps window fixed and shows retained alias counterexample', () => {
  const pair = comparison({bytes:4096,window:8,alias:false});
  assert.equal(pair.cap.reachablePayloadBytes,4096);
  assert.equal(pair.clone.reachablePayloadBytes,8);
  assert.equal(pair.clone.copiedBytes,8);
  const withAlias = comparison({bytes:4096,window:8,alias:true});
  assert.equal(withAlias.clone.reachablePayloadBytes,4104);
  assert.equal(withAlias.clone.eligible,false);
});
test('transfer cases distinguish remaining alias, small capacity, and last reference removal', () => {
  assert.deepEqual(transferTasks.map(t=>replay(t,t.actions).aReachable),[true,true,false]);
  assert.deepEqual(transferTasks.map(t=>replay(t,t.actions).copiedBytes),[8,0,6]);
  assert.throws(()=>initial({bytes:2,window:3,alias:false}));
  assert.throws(()=>initial({bytes:2,window:0,alias:false}));
});
