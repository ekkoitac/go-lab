import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyCache, execute, initialConfig, keyOf, records, type Config} from '../src/components/security-lab/lesson182/model';
const fixed: Config = {...initialConfig, write: 'tuple', read: 'tuple', invalidate: 'tuple'};
test('same local ID overwrites across tenants and authorized target still reads foreign data', () => {
  const start = emptyCache();
  const a = execute(start, initialConfig, 'writeA');
  const b = execute(a, initialConfig, 'writeB');
  assert.equal(b.outcome, 'overwritten');
  assert.equal(execute(b, initialConfig, 'readA').outcome, 'foreign');
  assert.deepEqual(start.entries, {});
  assert.equal(a.entries['42'].tenant, 'A');
});
test('structured keys isolate writes, reads and invalidation', () => {
  let state = execute(emptyCache(), fixed, 'writeA');
  state = execute(state, fixed, 'writeB');
  assert.equal(Object.keys(state.entries).length, 2);
  assert.equal(execute(state, fixed, 'readA').outcome, 'own');
  const deleted = execute(state, fixed, 'invalidateA');
  assert.equal(execute(deleted, fixed, 'readA').outcome, 'miss');
  assert.equal(execute(deleted, {...fixed, actor: 'B'}, 'readB').outcome, 'own');
  assert.equal(Object.keys(state.entries).length, 2, 'prior snapshot remains usable for undo');
});
test('naive delimiter encoding aliases distinct tuples; structured encoding retains boundaries', () => {
  const [a,b] = records(true);
  assert.equal(keyOf(a, 'joined'), keyOf(b, 'joined'));
  assert.notEqual(keyOf(a, 'tuple'), keyOf(b, 'tuple'));
  const joined = {...fixed, boundary:true, write:'joined' as const, read:'joined' as const};
  const state = execute(execute(emptyCache(), joined, 'writeA'), joined, 'writeB');
  assert.equal(execute(state, joined, 'readA').outcome, 'foreign');
});
test('invalidation using the old key leaves a stale composite entry', () => {
  const config = {...fixed, invalidate: 'id' as const};
  const state = execute(emptyCache(), config, 'writeA');
  const invalidated = execute(state, config, 'invalidateA');
  assert.equal(invalidated.outcome, 'unchanged');
  assert.equal(execute(invalidated, config, 'readA').outcome, 'own');
});
test('a structured key is not authorization and denied invalidation preserves entries', () => {
  const state = execute(emptyCache(), fixed, 'writeB');
  assert.equal(execute(state, fixed, 'readB').outcome, 'denied');
  assert.equal(execute(state, {...fixed, authorize:false}, 'readB').outcome, 'own');
  const denied = execute(state, {...fixed, actor:'B'}, 'invalidateA');
  assert.equal(denied.outcome, 'denied');
  assert.deepEqual(denied.entries, state.entries);
});
