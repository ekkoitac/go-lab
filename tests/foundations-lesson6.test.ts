import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectText, rangeSnapshot, ownerAt, sliceBytes, countText } from '../src/components/foundations-lab/lesson6/model';
test('6: UTF-8 maps bytes to code points and Go range uses byte offsets', () => {
  const model = inspectText('A中🙂');
  assert.deepEqual(model.bytes, [0x41, 0xe4, 0xb8, 0xad, 0xf0, 0x9f, 0x99, 0x82]);
  assert.deepEqual(model.runes.map(r => [r.offset, r.width, r.code]), [[0, 1, 'U+0041'], [1, 3, 'U+4E2D'], [4, 4, 'U+1F642']]);
  assert.deepEqual(model.bytes.map((_, i) => ownerAt(model, i)), [0, 1, 1, 1, 2, 2, 2, 2]);
  assert.equal(ownerAt(model, 8), -1);
});
test('6: range replay is deterministic and rollback restores the earlier boundary', () => {
  assert.equal(rangeSnapshot('A中🙂', 0).current, null);
  assert.equal(rangeSnapshot('A中🙂', 1).nextOffset, 1);
  assert.equal(rangeSnapshot('A中🙂', 2).nextOffset, 4);
  assert.equal(rangeSnapshot('A中🙂', 3).nextOffset, 8);
  assert.equal(rangeSnapshot('A中🙂', 3).done, true);
  assert.equal(rangeSnapshot('A中🙂', 2).done, false);
  assert.deepEqual(rangeSnapshot('A中🙂', 1).visited.map(r => r.text), ['A']);
  for (const n of [-1, 4, 1.5, NaN]) assert.throws(() => rangeSnapshot('A中🙂', n), RangeError);
});
test('6: rune count is not grapheme count for combining marks and emoji sequences', () => {
  assert.deepEqual(['bytes', 'runes', 'graphemes'].map(unit => countText('e\u0301', unit as 'bytes' | 'runes' | 'graphemes')), [3, 2, 1]);
  const family = inspectText('👨‍👩‍👧‍👦');
  assert.equal(family.runes.length, 7);
  assert.equal(family.graphemes.length, 1);
  assert.equal(inspectText('é').runes.length, 1);
});
test('6: cutting valid byte offsets can yield invalid UTF-8 but never silently moves the boundary', () => {
  assert.equal(sliceBytes('A中🙂', 2).valid, false);
  assert.equal(sliceBytes('A中🙂', 4).valid, true);
  assert.deepEqual(sliceBytes('A中🙂', 2).bytes, [0x41, 0xe4]);
  assert.equal(sliceBytes('A中🙂', 2).display, 'A�');
  assert.equal(sliceBytes('e\u0301', 1).valid, true);
  assert.equal(sliceBytes('e\u0301', 1).display, 'e');
  for (const n of [-1, 9, 1.2]) assert.throws(() => sliceBytes('A中🙂', n), RangeError);
});
test('6: empty input and browser surrogate normalization have explicit behavior', () => {
  assert.equal(rangeSnapshot('', 0).done, true);
  assert.deepEqual(inspectText('').runes, []);
  assert.equal(sliceBytes('', 0).valid, true);
  assert.equal(inspectText('\ud800').text, '�');
  assert.equal(inspectText('\ud800').bytes.length, 3);
});
test('6: a leading U+FEFF is a real rune and three bytes, not a removable transport BOM', () => {
  const model = inspectText('\ufeffA');
  assert.equal(model.text, '\ufeffA');
  assert.deepEqual(model.bytes, [0xef, 0xbb, 0xbf, 0x41]);
  assert.deepEqual(model.runes.map(r => r.offset), [0, 3]);
  assert.equal(sliceBytes('\ufeffA', 3).display, '\ufeff');
});
