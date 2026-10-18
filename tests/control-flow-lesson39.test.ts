import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, run, step, type Mode } from '../src/components/control-flow-lab/lesson39/model';

test('39: a deferred closure that directly recovers returns failure at its boundary', () => {
  const result = run(createState('direct'));
  assert.equal(result.recoverValue, 'boom');
  assert.equal(result.panicActive, false);
  assert.equal(result.outcome, 'returned-failure');
  assert.equal(result.failure, 'plugin panic: boom');
  assert.deepEqual(result.stack, ['调用者']);
});
test('39: defer catch() is effective but defer wrapper calling catch is not', () => {
  const directNamed = run(createState('named'));
  const wrapped = run(createState('indirect'));
  assert.equal(directNamed.recoverValue, 'boom');
  assert.equal(directNamed.outcome, 'returned-failure');
  assert.equal(wrapped.recoverValue, 'nil');
  assert.equal(wrapped.outcome, 'unhandled');
  assert.equal(wrapped.panicActive, true);
  assert.equal(wrapped.failure, null);
});
test('39: recover on another goroutine cannot intercept the failing goroutine', () => {
  const result = run(createState('other'));
  assert.equal(result.goroutine, 'g1');
  assert.equal(result.recoverValue, '未调用');
  assert.equal(result.outcome, 'unhandled');
  assert.deepEqual(result.stack, []);
  assert.ok(result.events.some(event => event.includes('g0 的 defer 不会因 g1')));
});
test('39: recovery never resumes the faulting callback or rolls back prior effects', () => {
  for (const mode of ['direct', 'named', 'indirect', 'other', 'none'] as Mode[]) {
    const result = run(createState(mode));
    assert.equal(result.afterPanicRan, false);
    assert.equal(result.dirty, true);
    assert.equal(result.phase, 'done');
  }
});
test('39: step distinguishes plugin mutation, panic, unwind and direct recovery', () => {
  let state = createState('direct');
  state = step(step(state));
  assert.deepEqual(state.stack, ['调用者', '执行边界', '插件回调']);
  assert.equal(state.dirty, false);
  state = step(state);
  assert.equal(state.dirty, true);
  assert.equal(state.panicActive, false);
  state = step(state);
  assert.equal(state.panicActive, true);
  state = step(state);
  assert.deepEqual(state.stack, ['调用者', '执行边界']);
  state = step(state);
  assert.equal(state.stack.at(-1), 'defer 闭包');
  state = step(state);
  assert.equal(state.phase, 'return');
  assert.equal(state.recoverValue, 'boom');
  assert.equal(state.outcome, 'pending');
  state = step(state);
  assert.deepEqual(state.stack, ['调用者']);
  assert.equal(state.phase, 'caller');
  assert.equal(step(state).outcome, 'returned-failure');
});
test('39: indirect helper is an extra ordinary frame and unhandled panic terminates', () => {
  let state = createState('indirect');
  for (let i = 0; i < 6; i++) state = step(state);
  assert.deepEqual(state.stack.slice(-2), ['defer 闭包', 'catch（普通调用）']);
  state = step(state);
  assert.equal(state.phase, 'escape');
  assert.equal(state.recoverValue, 'nil');
  assert.equal(run(state).outcome, 'unhandled');
});
test('39: immutable histories support rewind and deterministic replay', () => {
  const before = createState('named');
  const after = step(before);
  assert.deepEqual(before.stack, ['调用者']);
  assert.deepEqual(before.events, []);
  assert.deepEqual(step(before), after);
  const done = run(before);
  assert.strictEqual(step(done), done);
});
test('39: absence of recovery produces no fabricated returned error', () => {
  const result = run(createState('none'));
  assert.equal(result.outcome, 'unhandled');
  assert.equal(result.failure, null);
  assert.equal(result.recoverValue, '未调用');
});