import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeTrace, transferResult } from '../src/components/foundations-lab/lesson1/model';

test('1: nested declaration has a distinct identity and does not copy back on scope exit', () => {
  const trace = scopeTrace({ original: 100, replacement: 80, operator: ':=', branch: true });
  assert.equal(trace[1].inner, null);
  assert.deepEqual([trace[2].outer, trace[2].inner], [100, 80]);
  assert.equal(trace[3].read, 'inner');
  assert.deepEqual([trace[4].outer, trace[4].inner], [100, null]);
  assert.equal(trace[5].read, 'outer');
  assert.equal(trace[5].output, 100);
});
test('1: assignment mutates the existing outer binding and reads resolve to it', () => {
  const trace = scopeTrace({ original: 100, replacement: 80, operator: '=', branch: true });
  assert.deepEqual([trace[2].outer, trace[2].inner], [80, null]);
  assert.equal(trace[3].read, 'outer');
  assert.equal(trace[5].output, 80);
});
test('1: a false branch executes neither declaration nor assignment', () => {
  for (const operator of [':=', '='] as const) {
    const trace = scopeTrace({ original: 0, replacement: 999, operator, branch: false });
    assert.ok(trace.every(frame => frame.outer === 0 && frame.inner === null && !frame.inBlock));
    assert.equal(trace[3].read, null);
    assert.equal(trace[5].output, 0);
  }
});
test('1: equal values hide output differences but must preserve different binding identities', () => {
  const declared = scopeTrace({ original: 7, replacement: 7, operator: ':=', branch: true });
  const assigned = scopeTrace({ original: 7, replacement: 7, operator: '=', branch: true });
  assert.equal(declared[5].output, assigned[5].output);
  assert.equal(declared[3].read, 'inner');
  assert.equal(assigned[3].read, 'outer');
});
test('1: later assignment cannot bypass an already declared shadowing variable', () => {
  assert.deepEqual(transferResult(true), { outer: 3, inside: 9, writesTo: 'B' });
  assert.deepEqual(transferResult(false), { outer: 9, inside: 9, writesTo: 'A' });
  assert.equal(transferResult(true, 0).outer, 0);
});
test('1: input domain is explicit, traces are repeatable and earlier snapshots remain intact', () => {
  const config = { original: 0, replacement: 999, operator: '=' as const, branch: true };
  const a = scopeTrace(config);
  const b = scopeTrace(config);
  assert.deepEqual(a, b);
  assert.equal(a[0].outer, 0);
  assert.equal(a[5].output, 999);
  assert.deepEqual(config, { original: 0, replacement: 999, operator: '=', branch: true });
  for (const original of [-1, 1000, 0.5, NaN, Infinity]) assert.throws(() => scopeTrace({ ...config, original }), RangeError);
});
