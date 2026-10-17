import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canStep, completed, createRaceState, raceEvidence, runSchedule, stepRace, type Actor, type Protection } from '../src/components/testing-lab/lesson85/model';

test('unsynchronized serialized-looking accesses still have race evidence even with correct count', () => {
  const s = runSchedule('none', ['A', 'A', 'B', 'B']);
  assert.equal(s.value, 2); assert.equal(raceEvidence(s), true); assert.equal(completed(s), true);
});
test('interleaving loses update, with independent data race and business results', () => {
  for (const p of ['none', 'split'] as Protection[]) { const s = runSchedule(p, ['A', 'B', 'A', 'B'], 7); assert.equal(s.value, 8); assert.equal(raceEvidence(s), p === 'none'); }
});
test('whole-update mutex blocks other goroutine until write and preserves increment', () => {
  const start = createRaceState('whole'); const read = stepRace(start, 'A'); assert.equal(canStep(read, 'B'), false); assert.equal(stepRace(read, 'B'), read); assert.equal(start.local.A, null);
  const s = runSchedule('whole', ['A', 'B', 'A', 'B', 'B']); assert.equal(s.value, 2); assert.equal(s.owner, null); assert.equal(raceEvidence(s), false);
});
test('unexecuted branch provides no evidence and cannot change shared state', () => {
  const s = runSchedule('none', ['A', 'B', 'A', 'B'], 3, false); assert.equal(s.value, 3); assert.equal(s.accesses.length, 0); assert.equal(raceEvidence(s), false); assert.equal(canStep(s, 'A'), false);
});
test('read-read alone is not yet conflicting and completed goroutine cannot execute again', () => {
  const reads = runSchedule('none', ['A', 'B']); assert.equal(raceEvidence(reads), false); const written = stepRace(reads, 'A'); assert.equal(raceEvidence(written), true); assert.equal(stepRace(written, 'A'), written);
});
test('all legal four-step schedules with a whole mutex preserve both updates', () => {
  function visit(s: ReturnType<typeof createRaceState>) { if (completed(s)) { assert.equal(s.value, 11); assert.equal(raceEvidence(s), false); return; } for (const actor of ['A', 'B'] as Actor[]) if (canStep(s, actor)) visit(stepRace(s, actor)); }
  visit(createRaceState('whole', 9));
});
