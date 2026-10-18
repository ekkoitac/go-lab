import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, move, requestExit, run, step } from '../src/components/control-flow-lab/lesson35/model';

test('35: registration only pushes, body and loop completion do not execute defer', () => {
  const initial = createState();
  const first = step(initial);
  assert.equal(initial.stack.length, 0);
  assert.equal(first.stack.length, 1);
  assert.equal(first.pending, 3);
  assert.equal(first.open, true);
  assert.deepEqual(first.executed, []);
  assert.strictEqual(requestExit(initial), initial);
  const body = step(step(step(first)));
  assert.equal(body.phase, 'body');
  assert.equal(body.stack.length, 3);
  assert.deepEqual(body.executed, []);
  assert.strictEqual(step(body), body);
});
test('35: wrong registration closes before flushing and retains unwritten buffer', () => {
  const result = run(createState(['report', 'flush', 'close'], 3));
  assert.deepEqual(result.executed.map(c => c.op), ['close', 'flush', 'report']);
  assert.equal(result.open, false);
  assert.equal(result.pending, 3);
  assert.equal(result.written, 0);
  assert.deepEqual(result.errors, ['Flush 失败：连接已关闭']);
  assert.deepEqual(result.reports, ['写入=0，待写=3，错误=1']);
});
test('35: repaired registration flushes before close and report observes completed cleanup', () => {
  const result = run(createState(['report', 'close', 'flush'], 6));
  assert.deepEqual(result.executed.map(c => c.op), ['flush', 'close', 'report']);
  assert.equal(result.pending, 0);
  assert.equal(result.written, 6);
  assert.equal(result.open, false);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.reports, ['写入=6，待写=0，错误=0']);
});
test('35: correct ordering does not hide flush failure and later defer still runs', () => {
  const result = run(createState(['report', 'close', 'flush'], 3, true));
  assert.equal(result.pending, 3);
  assert.equal(result.written, 0);
  assert.equal(result.open, false);
  assert.deepEqual(result.errors, ['Flush 失败：注入的写入错误']);
  assert.equal(result.executed.length, 3);
  assert.deepEqual(result.reports, ['写入=0，待写=3，错误=1']);
});
test('35: reporting too early snapshots incomplete results', () => {
  const result = run(createState(['close', 'flush', 'report'], 1));
  assert.deepEqual(result.reports, ['写入=0，待写=1，错误=0']);
  assert.equal(result.written, 1);
});
test('35: loop defers accumulate until current function returns and pop reverse iterations', () => {
  let state = createState(['report'], 0, false, 3);
  for (let i = 0; i < 6; i++) state = step(state);
  assert.equal(state.phase, 'body');
  assert.equal(state.stack.length, 3);
  assert.equal(state.executed.length, 0);
  const result = run(state);
  assert.deepEqual(result.executed.map(c => c.iteration), [3, 2, 1]);
  assert.equal(result.phase, 'done');
  assert.strictEqual(step(result), result);
});
test('35: keyboard reorder creates new order and immutable snapshots permit replay', () => {
  const order = ['report', 'flush', 'close'] as const;
  const moved = move([...order], 2, -1);
  assert.deepEqual(moved, ['report', 'close', 'flush']);
  assert.deepEqual(order, ['report', 'flush', 'close']);
  assert.deepEqual(move(moved, 0, -1), moved);
  const state = createState(moved);
  const once = step(state);
  assert.deepEqual(step(state), once);
  assert.equal(state.stack.length, 0);
});
test('35: model rejects nonsensical resource and iteration parameters', () => {
  for (const count of [-1, 10, 1.5, NaN]) assert.throws(() => createState(['flush'], count), RangeError);
  for (const rounds of [0, 4, 1.5]) assert.throws(() => createState(['report'], 0, false, rounds), RangeError);
  assert.throws(() => createState([]), RangeError);
  assert.throws(() => createState(['flush', 'flush']), RangeError);
});