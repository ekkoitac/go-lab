import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, defaults, initial, inspect, rewind } from '../src/components/architecture-lab/lesson101/model';

test('shared change on services exposes mixed contract until all three deployments finish', () => {
  const start = initial();
  const first = advance(start);
  assert.deepEqual(inspect(first).versions, [2, 1, 1]);
  assert.equal(inspect(first).blocked, true);
  const second = advance(first);
  assert.deepEqual(inspect(second).versions, [2, 2, 1]);
  assert.equal(inspect(second).blocked, true);
  const final = advance(second);
  assert.deepEqual(inspect(final).versions, [2, 2, 2]);
  assert.equal(inspect(final).blocked, false);
  assert.equal(inspect(final).deployments, 3);
  assert.deepEqual(rewind(first), start);
  assert.deepEqual(advance(final), final);
});
test('atomic monolith updates the same modules together but still has three business modules', () => {
  const state = advance(initial({ ...defaults, topology: 'monolith' }));
  assert.deepEqual(inspect(state).versions, [2, 2, 2]);
  assert.equal(inspect(state).blocked, false);
  assert.equal(inspect(state).deployments, 1);
});
test('compatibility repairs intermediate requests without removing coordination', () => {
  const result = inspect(advance(initial({ ...defaults, compatible: true })));
  assert.equal(result.mixed, true);
  assert.equal(result.blocked, false);
  assert.equal(result.totalDeployments, 3);
});
test('stable external contract allows isolated settlement implementation update', () => {
  const result = inspect(advance(initial({ ...defaults, scope: 'settlement' })));
  assert.deepEqual(result.versions, [1, 1, 2]);
  assert.equal(result.blocked, false);
  assert.equal(result.done, true);
  assert.equal(result.totalDeployments, 1);
});
test('independent scaling affects resource allocation, not correctness', () => {
  const base = { ...defaults, scope: 'settlement' as const, hotSettlement: true };
  const split = inspect(initial(base));
  const combined = inspect(initial({ ...base, topology: 'monolith' }));
  assert.deepEqual(split.replicas, [1, 1, 4]);
  assert.deepEqual(combined.replicas, [4, 4, 4]);
  assert.equal(split.resourceUnits, 6);
  assert.equal(combined.resourceUnits, 12);
  assert.equal(split.blocked, combined.blocked);
});
test('reset config is copied and rewind cannot become negative', () => {
  const config = { ...defaults };
  const state = initial(config);
  config.compatible = true;
  assert.equal(state.config.compatible, false);
  assert.deepEqual(rewind(state), state);
});
