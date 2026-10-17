import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, initial, step, finish, totals } from '../src/components/concurrency-lab/lesson125/model';
test('125 same input FIFO excludes B this round, rotation gives B second opportunity', () => {
  const start = initial(); const end = finish(defaults);
  assert.deepEqual(end.fifo.selected.map(j => j.id), ['A1', 'A2', 'A3']);
  assert.deepEqual(end.roundRobin.selected.map(j => j.id), ['A1', 'B1', 'A2']);
  assert.deepEqual(end.roundRobin.waiting.map(j => j.id), ['A3']);
  assert.equal(start.fifo.selected.length, 0); assert.equal(start.fifo.waiting.length, 4);
});
test('125 empty tenant lends every unused opportunity; empty queues terminate', () => {
  for (const config of [{ ...defaults, b: 0 }, { ...defaults, a: 0, b: 3 }]) {
    const end = finish(config); assert.equal(end.roundRobin.selected.length, 3); assert.equal(end.roundRobin.waiting.length, 0);
    assert.equal(step(end), end);
  }
  const empty = initial({ ...defaults, a: 0, b: 0 }); assert.equal(step(empty), empty);
});
test('125 equal start counts do not imply equal work; changes preserve both comparison inputs', () => {
  const end = finish({ a: 3, b: 3, slots: 4, costA: 6, costB: 1 });
  assert.deepEqual(totals(end.roundRobin, 'A'), { count: 2, cost: 12 });
  assert.deepEqual(totals(end.roundRobin, 'B'), { count: 2, cost: 2 });
  for (const run of [end.fifo, end.roundRobin]) {
    assert.equal(new Set([...run.selected, ...run.waiting].map(j => j.id)).size, 6);
    assert.equal(run.selected.length + run.waiting.length, 6);
  }
});
test('125 prior snapshots support exact backtracking without dispatch mutation', () => {
  const start = initial(); const first = step(start); const second = step(first);
  assert.equal(first.step, 1); assert.deepEqual(first.roundRobin.selected.map(j => j.id), ['A1']);
  assert.deepEqual(step(first), second); assert.equal(start.roundRobin.waiting.length, 4);
});
