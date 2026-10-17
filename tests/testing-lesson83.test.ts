import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyEvent, createFixture, nestedFixture, replay, type Schedule} from '../src/components/testing-lab/lesson83/model';
test('shared map exposes scheduling-dependent reads including missing-key zero', () => {
  assert.deepEqual(replay('shared', 'read-first').read, {value: 0, exists: true, outcome: 'initial'});
  assert.deepEqual(replay('shared', 'write-read-clear').read, {value: 1, exists: true, outcome: 'written'});
  assert.deepEqual(replay('shared', 'write-clear-read').read, {value: 0, exists: false, outcome: 'missing'});
});
test('independent fixtures preserve B under every supported scheduling order', () => {
  for (const order of ['read-first', 'write-read-clear', 'write-clear-read'] as Schedule[]) {
    const state = replay('isolated', order, 3, 23, 99);
    assert.deepEqual(state.read, {value: 23, exists: true, outcome: 'initial'});
    assert.notEqual(state.refs.a, state.refs.b);
    assert.deepEqual(state.maps[state.refs.a], {});
    assert.deepEqual(state.maps[state.refs.b], {count: 23});
  }
});
test('reading snapshots a value, later cleanup does not retroactively change it', () => {
  const beforeCleanup = replay('shared', 'write-read-clear', 2);
  const afterCleanup = applyEvent(beforeCleanup, 'clear');
  assert.deepEqual(afterCleanup.read, beforeCleanup.read);
  assert.deepEqual(beforeCleanup.maps.shared, {count: 1}, 'transition preserves earlier state for rewind');
  assert.deepEqual(afterCleanup.maps.shared, {});
});
test('scheduler rejects duplicate events and cleanup before write', () => {
  const start = createFixture('shared');
  assert.equal(applyEvent(start, 'clear'), start);
  const written = applyEvent(start, 'write');
  assert.equal(applyEvent(written, 'write'), written);
  assert.equal(start.maps.shared.count, 0);
});
test('copying an outer struct leaves a nested slice shared; element copy isolates it', () => {
  assert.deepEqual(nestedFixture('shallow', 7, 99), {a: 99, b: 99, original: 99, sameArray: true});
  assert.deepEqual(nestedFixture('deep', 23, 99), {a: 99, b: 23, original: 23, sameArray: false});
});
