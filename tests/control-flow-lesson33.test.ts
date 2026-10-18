import test from 'node:test';
import assert from 'node:assert/strict';
import { bound, createState, run, step } from '../src/components/control-flow-lab/lesson33/model';

test('33: range retains initial bound while dynamic queue processes appended child', () => {
  const finished = run(createState(['A'], 'once', 8));
  assert.deepEqual(finished.lanes.map(l => l.processed), [['A'], ['A', 'A′']]);
  assert.deepEqual(finished.lanes.map(l => l.tasks.map(t => t.name)), [['A', 'A′'], ['A', 'A′']]);
  assert.deepEqual(finished.lanes.map(bound), [1, 2]);
});
test('33: append is distinct from processing and does not mutate prior snapshots', () => {
  const initial = createState(['A', 'B'], 'once', 8);
  const checked = step(initial);
  const processed = step(checked);
  const appended = step(processed);
  assert.equal(initial.lanes[0].phase, 'check');
  assert.deepEqual(initial.lanes[0].processed, []);
  assert.deepEqual(processed.lanes[0].processed, ['A']);
  assert.equal(processed.lanes[0].tasks.length, 2);
  assert.equal(appended.lanes[0].tasks.length, 3);
  assert.equal(appended.lanes[0].cursor, 0);
  assert.deepEqual(appended.lanes.map(bound), [2, 3]);
  assert.equal(step(appended).lanes[0].cursor, 1);
  assert.deepEqual(step(processed), appended, 'rewinding then re-stepping reproduces the same append');
});
test('33: repeated growth is bounded explicitly and refused tasks are not processed', () => {
  const result = run(createState(['A'], 'repeat', 4));
  assert.equal(result.lanes[1].tasks.length, 4);
  assert.equal(result.lanes[1].processed.length, 4);
  assert.equal(result.lanes[1].rejected, 1);
  assert.equal(result.lanes[1].phase, 'done');
  assert.equal(result.lanes[0].processed.length, 1);
  assert.equal(result.lanes[0].rejected, 0);
});
test('33: empty slices terminate without processing or growth', () => {
  const result = run(createState([], 'repeat', 4));
  assert.deepEqual(result.lanes.map(l => [l.tasks.length, l.processed.length, l.phase]), [[0, 0, 'done'], [0, 0, 'done']]);
  assert.strictEqual(step(result), result);
});
test('33: no growth is a control condition and fully consuming initial tasks respects cap', () => {
  assert.deepEqual(run(createState(['A', 'B', 'C'], 'none', 4)).lanes.map(l => l.processed.length), [3, 3]);
  const capped = run(createState(['A', 'B', 'C'], 'once', 4));
  assert.deepEqual(capped.lanes.map(l => l.processed.length), [3, 4]);
  assert.deepEqual(capped.lanes.map(l => l.rejected), [2, 2]);
});
test('33: initial domain rejects invalid budgets and ambiguous names', () => {
  for (const limit of [0, -1, 13, 2.5, NaN, Infinity]) assert.throws(() => createState(['A'], 'once', limit), RangeError);
  assert.throws(() => createState(['A', 'B'], 'once', 1), RangeError);
  assert.throws(() => createState(['A', 'A']), RangeError);
  assert.throws(() => createState(['']), RangeError);
});
test('33: transfer predictions derive from new report count and budget', () => {
  for (const count of [2, 3]) for (const limit of [4, 8]) {
    const result = run(createState(Array.from({ length: count }, (_, i) => `报告${i + 1}`), 'once', limit));
    assert.equal(result.lanes[0].processed.length, count);
    assert.equal(result.lanes[1].processed.length, Math.min(count * 2, limit));
  }
});