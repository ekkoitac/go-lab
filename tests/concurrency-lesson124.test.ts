import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, current, defaults, initial, outcome, rewind, run } from '../src/components/concurrency-lab/lesson124/model';
const safe = { ...defaults, plan: ['stop', 'cancel', 'wait', 'close'] as typeof defaults.plan };
test('cancel requests cleanup without confirming completion', () => {
  const s = advance(advance(initial(safe)));
  assert.equal(current(s).canceled, true); assert.equal(current(s).worker, 'cleaning');
  assert.equal(current(s).confirmed, false); assert.equal(current(s).databaseOpen, true);
});
test('dependency stays open until final write is acknowledged', () => {
  const s = run(safe);
  assert.equal(outcome(s), 'safe');
  assert.ok(s.history.filter(f => f.worker !== 'done').every(f => f.databaseOpen));
  assert.equal(current(s).confirmed, true); assert.equal(current(s).databaseOpen, false);
});
test('closing before cleanup gives a failed completion rather than false success', () => {
  const s = run(defaults); assert.equal(outcome(s), 'unsafe');
  assert.equal(current(s).worker, 'failed'); assert.equal(current(s).confirmed, true);
});
test('insufficient budget preserves unfinished worker and open dependency', () => {
  const s = run({ ...safe, cleanupTicks: 3, budget: 2 });
  assert.equal(outcome(s), 'timeout'); assert.equal(current(s).remaining, 1);
  assert.equal(current(s).worker, 'cleaning'); assert.equal(current(s).databaseOpen, true);
  assert.equal(current(s).confirmed, false); assert.equal(advance(s), s);
});
test('completion exactly at budget succeeds; longer wait cannot repair noncooperation', () => {
  assert.equal(outcome(run({ ...safe, cleanupTicks: 3, budget: 3 })), 'safe');
  const s = run({ ...safe, cooperative: false, budget: 6 });
  assert.equal(outcome(s), 'timeout'); assert.equal(current(s).worker, 'running');
  assert.equal(current(s).waited, 6);
});
test('waiting before cancel cannot make progress and consumes finite budget', () => {
  const s = run({ ...safe, plan: ['stop', 'wait', 'cancel', 'close'] });
  assert.equal(outcome(s), 'timeout'); assert.equal(current(s).canceled, false);
});
test('rewind replays exactly and initial config is copied', () => {
  const config = { ...safe, plan: [...safe.plan] }; const s = initial(config);
  config.plan.reverse(); const a = advance(s); const b = advance(a);
  assert.deepEqual(advance(rewind(b)), b); assert.deepEqual(current(s).cursor, 0);
  assert.deepEqual(s.config.plan, safe.plan); assert.equal(rewind(s), s);
});
test('reject invalid plans and budgets', () => {
  assert.throws(() => initial({ ...safe, plan: ['stop', 'stop', 'wait', 'close'] }));
  for (const budget of [0, 7, 1.5, NaN]) assert.throws(() => initial({ ...safe, budget }));
});
