import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyRows, copySnapshot, utf8Length} from '../src/components/engineering-lab/lesson94/model';

test('94 uses UTF-8 bytes including astral emoji, not JS length or rune count', () => {
  assert.equal(utf8Length('你🙂'), 7);
  const rows = copyRows(['Go', '你', '🙂', '!'], true);
  assert.deepEqual(rows.map(row => row.prefix), [2, 5, 9, 10]);
  assert.equal(rows.at(-1)!.concatTotal, 26);
  assert.equal(rows.at(-1)!.builderTotal, 10);
  assert.ok(rows.every(row => row.moved === 0));
});
test('94 lack of reserve adds prefix moves without changing output', () => {
  const parts = ['aa', 'b', 'c', 'd'];
  assert.deepEqual(copyRows(parts, false).map(r => r.moved), [0, 2, 0, 4]);
  assert.equal(copySnapshot(parts, false, 4).builderTotal, 11);
  assert.equal(copySnapshot(parts, true, 4).builderTotal, 5);
  assert.equal(copySnapshot(parts, false, 4).output, copySnapshot(parts, true, 4).output);
});
test('94 order changes repeated prefix cost, not reserved write cost', () => {
  const first = copyRows(['中', 'a', '🙂'], true).at(-1)!;
  const swapped = copyRows(['🙂', 'a', '中'], true).at(-1)!;
  assert.equal(first.concatTotal, 15); assert.equal(swapped.concatTotal, 17);
  assert.equal(first.builderTotal, swapped.builderTotal);
});
test('94 back/reset snapshots restore exact state; empty appends do not move bytes', () => {
  const parts = ['', '你', '', 'a'];
  assert.deepEqual(copyRows(parts, true).map(row => row.concatDelta), [0, 3, 0, 4]);
  const start = copySnapshot(parts, true, 0), previous = copySnapshot(parts, true, 2);
  copySnapshot(parts, true, 4);
  assert.deepEqual(copySnapshot(parts, true, 2), previous);
  assert.equal(start.output, ''); assert.equal(start.concatTotal, 0);
  assert.equal(copySnapshot(parts, true, 99).step, 4);
  assert.equal(copySnapshot(parts, true, -1).step, 0);
});
