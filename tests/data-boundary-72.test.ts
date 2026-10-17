import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, decode, initialConfig, intended, request, trace, type Input, type Strategy, type Target } from '../src/components/data-boundary-lab/lesson72/model';
test('72 fresh targets lose different pieces of PATCH intent', () => {
  assert.equal(decode({ ...initialConfig, input: 'missing' }).value, 0);
  assert.equal(decode({ ...initialConfig, input: 'null' }).value, 0);
  assert.equal(decode({ ...initialConfig, input: 'missing', strategy: 'pointer' }).value, null);
  assert.equal(decode({ ...initialConfig, input: 'null', strategy: 'pointer' }).value, null);
  assert.equal(apply(initialConfig), 0);
  assert.equal(apply({ ...initialConfig, input: 'null', strategy: 'pointer' }), 100);
});
test('72 reused int ignores null; reused pointer becomes nil; missing preserves both', () => {
  for (const strategy of ['plain', 'pointer'] as Strategy[]) assert.equal(decode({ ...initialConfig, strategy, target: 'reuse' }).value, 100);
  assert.equal(decode({ ...initialConfig, input: 'null', target: 'reuse' }).value, 100);
  assert.equal(decode({ ...initialConfig, input: 'null', strategy: 'pointer', target: 'reuse' }).value, null);
});
test('72 presence strategy satisfies all intents under both target controls', () => {
  for (const input of ['missing', 'null', 'zero', 'value'] as Input[]) for (const target of ['fresh', 'reuse'] as Target[]) {
    const c = { ...initialConfig, input, target, strategy: 'presence' as const, old: 240 };
    assert.equal(apply(c), intended(c));
    assert.equal(decode(c).present, input !== 'missing');
    assert.equal(decode(c).explicitNull, input === 'null');
  }
});
test('72 explicit zero and nonzero update every receiver', () => {
  for (const strategy of ['plain', 'pointer', 'presence'] as Strategy[]) for (const target of ['fresh', 'reuse'] as Target[]) {
    assert.equal(apply({ ...initialConfig, strategy, target, input: 'zero' }), 0);
    assert.equal(apply({ ...initialConfig, strategy, target, input: 'value' }), 25);
  }
});
test('72 trace applies only at last frame and is deterministic for back/replay/reset', () => {
  const c = { ...initialConfig, input: 'null' as const, strategy: 'presence' as const };
  const snapshot = JSON.stringify(c), frames = trace(c);
  assert.equal(frames.length, 4);
  assert.deepEqual(frames.slice(0, 3).map(s => s.result), [100, 100, 100]);
  assert.equal(frames[3].result, null);
  assert.equal(frames[2].applied, false);
  assert.deepEqual(trace(c)[3], frames[3]);
  assert.deepEqual(trace(initialConfig)[0].decoded, null);
  assert.equal(JSON.stringify(c), snapshot);
  const next = trace({ ...c, input: 'zero' });
  assert.equal(next[0].result, 100);
  assert.equal(next[0].decoded, null);
  assert.equal(next[3].result, 0);
  assert.equal(request(initialConfig), '{}');
});
