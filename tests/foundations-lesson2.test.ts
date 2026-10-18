import test from 'node:test';
import assert from 'node:assert/strict';
import { initialInput, resolveConfig, scheduled, trace } from '../src/components/foundations-lab/lesson2/model';
test('2: declaration recursively zeroes all fields, not business defaults', () => {
  const states = trace(initialInput);
  assert.equal(states[0].config, null);
  assert.deepEqual(states[1].config, { limit: 0, enabled: false, name: '' });
  assert.equal(states[2].started, null);
  assert.equal(states[3].started, 0);
  assert.deepEqual(trace({ ...initialInput, policy: 'defaults' })[1], states[1]);
  assert.equal(trace({ ...initialInput, policy: 'defaults' })[3].started, 3);
});
test('2: explicit zero must survive presence-aware initialization', () => {
  const explicit = { ...initialInput, policy: 'presence' as const, provided: true, limit: 0 };
  assert.equal(resolveConfig(explicit).limit, 0);
  assert.equal(resolveConfig({ ...explicit, provided: false }).limit, 3);
  assert.equal(resolveConfig({ ...explicit, policy: 'replace-zero' }).limit, 3);
  assert.equal(trace(explicit)[3].started, 0);
  assert.equal(trace({ ...explicit, policy: 'replace-zero' })[3].started, 3);
});
test('2: enabled gate and pending capacity independently bound scheduling', () => {
  for (let limit = 0; limit <= 6; limit++) for (let pending = 0; pending <= 8; pending++) {
    assert.equal(scheduled({ limit, enabled: true, name: '' }, pending), Math.min(limit, pending));
    assert.equal(scheduled({ limit, enabled: false, name: '' }, pending), 0);
    const input = { ...initialInput, policy: 'presence' as const, provided: true, limit, pending };
    assert.equal(trace(input)[3].started, Math.min(limit, pending));
  }
});
test('2: replay is deterministic and leaves input intact for rollback', () => {
  const input = Object.freeze({ ...initialInput, policy: 'defaults' as const });
  const first = trace(input);
  first[1].config!.limit = 99;
  assert.equal(trace(input)[1].config!.limit, 0);
  assert.equal(trace(input)[3].started, 3);
  assert.equal(input.limit, 0);
});
test('2: finite integer domain is explicit', () => {
  for (const limit of [-1, 7, 1.5, NaN, Infinity]) assert.throws(() => trace({ ...initialInput, limit }), RangeError);
  for (const pending of [-1, 9, 1.5, NaN, Infinity]) assert.throws(() => trace({ ...initialInput, pending }), RangeError);
});
