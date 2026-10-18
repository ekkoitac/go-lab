import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, inspect, snapshot, repair, type Config, type Channel} from '../src/components/types-lab/lesson30/model';
test('inference rejects distinct typed arguments but explicit Sender accepts them', () => {
  assert.equal(inspect(initial).allowed, false);
  for (const a of ['Mail','SMS','Push'] as Channel[]) for (const b of ['Mail','SMS','Push'] as Channel[]) {
    const c: Config = {...initial, channels:[a,b]};
    assert.equal(inspect(c).allowed, a === b);
    const fixed = repair(c);
    assert.deepEqual(fixed.channels, c.channels);
    assert.equal(inspect(fixed).allowed, true);
    assert.equal(inspect(fixed).elementType, 'Sender');
    assert.deepEqual(inspect(fixed).output, inspect({...c, route:'queue'}).output);
  }
});
test('Clone preserves concrete or interface element type and validates the input construction', () => {
  assert.equal(inspect({...initial, route:'clone', cloneType:'Mail'}).allowed, false);
  const concrete = inspect({...initial, route:'clone', cloneType:'Mail', channels:['Mail','Mail']});
  assert.equal(concrete.allowed, true);
  assert.equal(concrete.elementType, 'Mail');
  assert.equal(inspect({...initial, route:'clone'}).elementType, 'Sender');
  assert.equal(inspect(repair({...initial, route:'clone', cloneType:'Mail'})).allowed, true);
});
test('compile failure produces no runtime output; replay has reversible incremental dispatch', () => {
  assert.deepEqual(snapshot(initial,4).output, []);
  const c = repair(initial);
  assert.deepEqual(snapshot(c,1).output, []);
  assert.equal(snapshot(c,1).built, false);
  assert.equal(snapshot(c,2).built, true);
  assert.deepEqual(snapshot(c,3).output, ['mail:ok']);
  assert.deepEqual(snapshot(c,4).output, ['mail:ok','sms:ok']);
  assert.deepEqual(snapshot(c,3).output, ['mail:ok']);
  assert.deepEqual(snapshot({...c, channels:['SMS','Mail']},4).output, ['sms:ok','mail:ok']);
});
