import test from 'node:test';
import assert from 'node:assert/strict';
import {advance, initial, inspect, rewind, run, type Actor, type Strategy} from '../src/components/sync-lab/lesson43/model';
const interleave: Actor[] = ['A','B','A','B','A','B'];
test('both old snapshots overwrite one contribution; unchanged write has causal evidence', () => {
  const state = run('unsafe', interleave);
  assert.equal(state.value, 1); assert.equal(inspect(state).lostUpdate, true);
  assert.match(state.trace.at(-1)!, /数值没变/);
});
test('correct numeric outcome does not establish synchronization', () => {
  const state = run('unsafe', ['A','A','A','B','B','B']);
  assert.equal(state.value, 2); assert.equal(inspect(state).raceRisk, true);
});
test('write-only locks retain race risk; separately locked accesses eliminate data race but not lost updates', () => {
  const write = inspect(run('write-lock', interleave)); const split = inspect(run('access-lock', interleave));
  assert.equal(write.raceRisk, true); assert.equal(split.raceRisk, false);
  assert.equal(write.lostUpdate, true); assert.equal(split.lostUpdate, true);
});
test('whole lock prevents second read until write and unlock; rewind restores ownership', () => {
  const start = initial('whole-lock'); const aRead = advance(start, 'A'); const attempt = advance(aRead, 'B');
  assert.equal(attempt.workers.B.local, null); assert.equal(attempt.owner, 'A');
  assert.match(attempt.trace.at(-1)!, /等待/); assert.deepEqual(rewind(attempt), aRead);
  const afterWrite = advance(advance(attempt, 'A'), 'A');
  assert.equal(afterWrite.owner, null); assert.equal(advance(afterWrite, 'B').workers.B.local, 1);
  assert.equal(start.workers.A.phase, 'read');
});
test('all interleavings preserve full increments for complete lock and expose split-lock counterexample', () => {
  function schedules(a: number, b: number, prefix: Actor[] = []): Actor[][] {
    if (!a && !b) return [prefix];
    return [...(a ? schedules(a-1,b,[...prefix,'A']) : []), ...(b ? schedules(a,b-1,[...prefix,'B']) : [])];
  }
  let witnessedLoss = false;
  for (const order of schedules(3,3)) {
    const split = run('access-lock', order, 10, 2); witnessedLoss ||= inspect(split).lostUpdate;
    let whole = run('whole-lock', order, 10, 2);
    for (let i=0; i<6; i++) { whole = advance(whole, 'A'); whole = advance(whole, 'B'); }
    assert.equal(whole.value, 14); assert.equal(inspect(whole).raceRisk, false);
  }
  assert.equal(witnessedLoss, true);
});
test('atomic Add uses current shared value and completed actors cannot apply increment again', () => {
  const state = run('atomic', ['B','A'], 20, 3);
  assert.equal(state.value, 26); assert.equal(inspect(state).done, true);
  assert.equal(advance(state, 'A'), state);
});
test('reset inputs and model history stay independent across every strategy', () => {
  for (const strategy of ['unsafe','write-lock','access-lock','whole-lock','atomic'] as Strategy[]) {
    const state = initial(strategy, 5, -1); const next = advance(state, 'A');
    assert.equal(state.trace.length, 0); assert.equal(state.value, 5);
    assert.equal(rewind(next), state); assert.equal(rewind(state), state);
  }
});
