import assert from 'node:assert/strict';
import test from 'node:test';
import { defaults, initial, leaseSnapshot, snapshot, transition } from '../src/components/cache-message-lab/lesson144/model';

test('20 independent Group objects cannot combine into one cluster call', () => {
  const running = snapshot(defaults, 1);
  assert.equal(running.origin, 20);
  assert.equal(running.running, 20);
  assert.equal(running.waiting, 40);
  assert.equal(snapshot(defaults, 2).returned, 60);
  assert.equal(snapshot(defaults, 4).origin, 40);
});
test('Group identity, key and overlap independently bound duplicate suppression', () => {
  const local = { ...defaults, instances: 1 };
  assert.equal(snapshot(local, 2).origin, 1);
  assert.equal(snapshot({ ...local, groups: 2 }, 2).origin, 2);
  assert.equal(snapshot({ ...local, keys: 2 }, 2).origin, 2);
  assert.equal(snapshot({ ...local, overlap: false }, 2).origin, 3);
  assert.equal(snapshot({ ...local, overlap: false }, 1).waiting, 0);
  assert.equal(snapshot({ ...local, overlap: false }, 1).origin, 1);
});
test('cache is independent of singleflight and only removes the fully later wave here', () => {
  const config = { ...defaults, cache: true };
  assert.equal(snapshot(config, 2).origin, 20);
  assert.equal(snapshot(config, 3).origin, 20);
  assert.equal(snapshot(config, 3).cacheHits, 60);
  assert.equal(snapshot(config, 3).returned, 120);
  assert.equal(snapshot(config, 3).running, 0);
  assert.equal(snapshot(config, 4).origin, 20);
});
test('nonoverlapping later calls execute and all callers return', () => {
  const config = { ...defaults, groups: 2, keys: 2, overlap: false };
  assert.equal(snapshot(config, 1).origin, 80);
  assert.equal(snapshot(config, 2).origin, 240);
  assert.equal(snapshot(config, 3).origin, 320);
  assert.equal(snapshot(config, 4).origin, 480);
  assert.equal(snapshot(config, 4).returned, 480);
});
test('observation requires both prediction and reason, changing conditions clears them', () => {
  let state = initial();
  assert.equal(transition(state, { type: 'step' }).phase, 0);
  state = transition(state, { type: 'predict', value: '40' });
  assert.equal(transition(state, { type: 'step' }).phase, 0);
  state = transition(state, { type: 'reason', value: '每实例各合并一次，完成后下一波重新执行' });
  state = transition(state, { type: 'step' });
  assert.equal(state.phase, 1);
  assert.equal(transition(state, { type: 'predict', value: '1' }).prediction, '40');
  state = transition(state, { type: 'back' });
  assert.equal(state.phase, 0);
  assert.equal(state.prediction, '40');
  state = transition(state, { type: 'configure', patch: { instances: 1 } });
  assert.equal(state.prediction, '');
  assert.equal(state.submitted, false);
  assert.deepEqual(transition(state, { type: 'reset' }), initial());
});
test('lease expiry permits two queries; fencing guards the late write rather than execution count', () => {
  assert.equal(leaseSnapshot(1, false).oldAStillRunning, true);
  assert.equal(leaseSnapshot(1, false).queries, 2);
  assert.equal(leaseSnapshot(3, false).value, 'A 的旧值');
  assert.equal(leaseSnapshot(3, true).value, 'B 的新值');
  assert.equal(leaseSnapshot(3, true).rejected, true);
  assert.equal(leaseSnapshot(3, true).queries, 2);
});
