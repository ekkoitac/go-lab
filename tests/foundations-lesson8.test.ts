import test from 'node:test';
import assert from 'node:assert/strict';
import { initialInput, trace, type Input, type Setup } from '../src/components/foundations-lab/lesson8/model';
const run = (patch: Partial<Input>) => trace({ ...initialInput, ...patch })[2];
test('8: append assigns returned slice while map read preserves nil and map write panics', () => {
  const slice = run({ kind: 'slice', operation: 'append' });
  assert.deepEqual(slice.cells, ['7']); assert.equal(slice.nil, false); assert.equal(slice.outcome, 'success');
  const read = run({ operation: 'read' });
  assert.equal(read.nil, true); assert.equal(read.output, 'v=0 · ok=false'); assert.deepEqual(read.cells, []);
  assert.equal(run({}).outcome, 'panic'); assert.equal(run({}).nil, true);
  assert.deepEqual(run({ setup: 'ready' }).cells, ['a: 7']);
});
test('8: pointer needs a target; allocating target produces zero int', () => {
  assert.equal(run({ kind: 'pointer', operation: 'deref' }).outcome, 'panic');
  const ready = run({ kind: 'pointer', operation: 'deref', setup: 'ready' });
  assert.equal(ready.outcome, 'success'); assert.equal(ready.output, 'v=0'); assert.deepEqual(ready.cells, ['0']);
});
test('8: nil, empty, full, and closed channels have different send and receive behavior', () => {
  const expected: Record<Setup, [string, string]> = { nil: ['blocked', 'blocked'], ready: ['success', 'blocked'], filled: ['blocked', 'success'], closed: ['panic', 'success'] };
  for (const setup of Object.keys(expected) as Setup[]) {
    assert.equal(run({ kind: 'channel', operation: 'send', setup }).outcome, expected[setup][0]);
    assert.equal(run({ kind: 'channel', operation: 'receive', setup }).outcome, expected[setup][1]);
  }
  const receive = run({ kind: 'channel', operation: 'receive', setup: 'filled', value: 9 });
  assert.equal(receive.output, 'v=9 · ok=true'); assert.deepEqual(receive.cells, []);
  assert.equal(run({ kind: 'channel', operation: 'receive', setup: 'closed' }).output, 'v=0 · ok=false');
  assert.deepEqual(run({ kind: 'channel', operation: 'send', setup: 'ready', value: 9 }).cells, ['9']);
});
test('8: replay does not mutate prior snapshots or frozen inputs', () => {
  const input = Object.freeze({ ...initialInput, setup: 'ready' as const });
  const states = trace(input); assert.deepEqual(states[0].cells, []); assert.deepEqual(states[1].cells, []);
  states[2].cells.push('x'); assert.deepEqual(trace(input)[2].cells, ['a: 7']);
  assert.throws(() => trace({ ...initialInput, kind: 'slice' }), RangeError);
  assert.throws(() => trace({ ...initialInput, setup: 'closed' }), RangeError);
  assert.throws(() => trace({ ...initialInput, value: NaN }), RangeError);
});
