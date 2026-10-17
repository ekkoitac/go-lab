import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, feedback, initial, timeline } from '../src/components/io-lab/lesson63/model';

test('63 loop boundary retains handles and defer calls execute LIFO on outer return', () => {
  const frames = timeline({ total: 3, limit: 3, scope: 'outer' });
  const afterFirstIteration = frames.find(s => s.processed === 1 && s.phase === 'open')!;
  assert.deepEqual(afterFirstIteration.open, [1]);
  assert.deepEqual(afterFirstIteration.deferred, [1]);
  const beforeReturn = frames.find(s => s.phase === 'outerReturn')!;
  assert.deepEqual(beforeReturn.open, [1, 2, 3]);
  const end = frames.at(-1)!;
  assert.equal(end.peak, 3); assert.equal(end.processed, 3);
  assert.deepEqual(end.closed, [3, 2, 1]); assert.deepEqual(end.open, []);
});

test('63 registration alone does not close and does not mutate input', () => {
  const start = initial({ total: 2, limit: 2, scope: 'outer' });
  const opened = advance(start); const registered = advance(opened);
  assert.deepEqual(start.open, []); assert.deepEqual(opened.deferred, []);
  assert.deepEqual(registered.open, [1]); assert.deepEqual(registered.deferred, [1]);
});

test('63 resource limit fails before registering invalid handle then returns and cleans existing handles', () => {
  const frames = timeline({ total: 5, limit: 2, scope: 'outer' });
  const failed = frames.find(s => s.failedAt !== null)!;
  assert.equal(failed.failedAt, 3); assert.equal(failed.processed, 2);
  assert.deepEqual(failed.open, [1, 2]); assert.deepEqual(failed.deferred, [1, 2]);
  const end = frames.at(-1)!;
  assert.deepEqual(end.closed, [2, 1]); assert.equal(end.peak, 2); assert.deepEqual(end.open, []);
});

test('63 per-item function always closes before opening the next resource', () => {
  for (const total of [1, 3, 8]) for (const limit of [1, 2, 8]) {
    const frames = timeline({ total, limit, scope: 'iteration' });
    const end = frames.at(-1)!;
    assert.equal(end.peak, 1); assert.equal(end.failedAt, null); assert.equal(end.processed, total);
    assert.deepEqual(end.closed, Array.from({ length: total }, (_, i) => i + 1));
    for (const frame of frames) {
      assert.ok(frame.open.length <= 1);
      if (frame.phase === 'open') assert.equal(frame.open.length, 0);
    }
  }
});

test('63 completion with final zero does not hide peak or earlier error', () => {
  const failed = timeline({ total: 4, limit: 3, scope: 'outer' }).at(-1)!;
  assert.equal(feedback({ outcome: 'complete', peak: 1, reason: '循环结束就关闭' }, failed).correct, false);
  assert.equal(feedback({ outcome: 'limit', peak: 3, reason: '等批次函数返回' }, failed).correct, true);
  assert.match(feedback({ outcome: 'limit', peak: 3, reason: '等批次函数返回' }, failed).text, /F4/);
  assert.equal(advance(failed), failed);
  assert.throws(() => initial({ total: 0, limit: 2, scope: 'outer' }), RangeError);
});
