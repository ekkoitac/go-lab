import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canStep, initialState, step} from '../src/components/sync-lab/lesson41/model';

test('main returning before background work ends terminates pending work', () => {
  const start = initialState('return', 3);
  assert.equal(canStep(start, 'worker'), false);
  const launched = step(start, 'main');
  assert.equal(launched.saved, false);
  const end = step(step(launched, 'worker'), 'main');
  assert.equal(end.main, 'exited');
  assert.equal(end.remaining, 2);
  assert.equal(end.worker, 'stopped');
  assert.equal(step(end, 'worker'), end);
  assert.equal(start.worker, 'absent', 'transition must not mutate input');
});
test('done closes only after work; waiting main resumes on the explicit completion event', () => {
  let state = step(step(initialState('receipt', 2), 'main'), 'main');
  assert.equal(state.main, 'waiting');
  assert.equal(step(state, 'main'), state);
  state = step(step(state, 'worker'), 'worker');
  assert.equal(state.saved, true);
  assert.equal(state.receipt, false);
  assert.equal(canStep(state, 'main'), false);
  state = step(state, 'worker');
  assert.equal(state.receipt, true);
  state = step(state, 'main');
  assert.equal(state.main, 'acknowledged');
  assert.equal(step(state, 'main').main, 'exited');
});
test('all legal finite receipt schedules preserve work before main exit', () => {
  function visit(state: ReturnType<typeof initialState>) {
    if (state.main === 'exited') {assert.equal(state.saved, true); assert.equal(state.receipt, true); return;}
    for (const actor of ['main', 'worker'] as const) if (canStep(state, actor)) visit(step(state, actor));
  }
  for (const work of [1,2,3,4]) visit(initialState('receipt', work));
});
test('a lucky unjoined schedule can finish but does not make launch a completion event', () => {
  let state = step(initialState('return', 1), 'main');
  state = step(step(state, 'worker'), 'worker');
  assert.equal(step(state, 'main').saved, true);
  assert.equal(step(step(initialState('return', 1), 'main'), 'main').saved, false);
  assert.throws(() => initialState('receipt', 0));
});
