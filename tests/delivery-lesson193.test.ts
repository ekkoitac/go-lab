import test from 'node:test';
import assert from 'node:assert/strict';
import { canStep, createState, exampleObservation, hasCompletionPath, initialConfig, protocol, run, step, transferFeedback, validateProtocol } from '../src/components/delivery-lab/lesson193/model';

test('193 elapsed sleep is not task completion; done establishes the positive observation', () => {
  const result = run(initialConfig);
  assert.equal(result.sleepVerdict, 'early');
  assert.equal(result.handshakeVerdict, 'passed');
  assert.equal(result.tick, 6);
  assert.equal(result.accepted, true);
  assert.equal(result.written, true);
  assert.equal(result.done, true);
});

test('193 increasing sleep can observe a written value but never manufactures synchronization', () => {
  const result = run({ ...initialConfig, sleep: 9 });
  assert.equal(result.sleepVerdict, 'unproven');
  assert.equal(result.handshakeVerdict, 'passed');
  assert.equal(result.tick, 9);
});

test('193 identical sleep fails under a slower schedule while handshake remains valid within budget', () => {
  const fast = run({ ...initialConfig, delay: 1, sleep: 4 });
  const slow = run({ ...initialConfig, delay: 6, sleep: 4 });
  assert.equal(fast.sleepVerdict, 'unproven');
  assert.equal(slow.sleepVerdict, 'early');
  assert.equal(fast.handshakeVerdict, 'passed');
  assert.equal(slow.handshakeVerdict, 'passed');
});

test('193 missing completion signal times out despite a written result; repair preserves schedule', () => {
  const broken = run({ ...initialConfig, omitDone: true });
  const repaired = run({ ...initialConfig, omitDone: false });
  assert.equal(broken.written, true);
  assert.equal(broken.done, false);
  assert.equal(broken.handshakeVerdict, 'timeout');
  assert.equal(broken.tick, initialConfig.budget);
  assert.equal(repaired.handshakeVerdict, 'passed');
  assert.equal(broken.sleepVerdict, repaired.sleepVerdict);
});

test('193 insufficient overall budget remains failure even after closing responsibility is repaired', () => {
  assert.equal(run({ ...initialConfig, budget: 3 }).handshakeVerdict, 'timeout');
  assert.equal(run({ ...initialConfig, delay: 8, budget: 3, sleep: 9 }).sleepVerdict, 'timeout');
});

test('193 explicit deterministic tie rule processes worker before timeout at the same tick', () => {
  const result = run({ ...initialConfig, budget: 6 });
  assert.equal(result.done, true);
  assert.equal(result.handshakeVerdict, 'passed');
  assert.equal(result.tick, 6);
});

test('193 transitions preserve prior snapshots and gate release does not imply acceptance', () => {
  const initial = createState();
  const original = JSON.stringify(initial);
  const released = step(initial);
  assert.equal(JSON.stringify(initial), original);
  assert.equal(released.gate, true);
  assert.equal(released.tick, 0);
  assert.equal(released.accepted, false);
  assert.deepEqual(step(initial), released);
  const completed = run(initialConfig);
  assert.equal(canStep(completed), false);
  assert.equal(step(completed), completed);
});

test('193 receipt confirmation and completion confirmation differ before and after result write', () => {
  assert.deepEqual(exampleObservation(1, 'accepted'), { received: true, resultWritten: false, safeRead: false });
  assert.deepEqual(exampleObservation(2, 'accepted'), { received: true, resultWritten: true, safeRead: false });
  assert.equal(exampleObservation(2, 'done').received, false);
  assert.equal(exampleObservation(3, 'done').safeRead, true);
});

test('193 removing any ordering or synchronization premise breaks the completion proof', () => {
  assert.equal(hasCompletionPath([true, true, true]), true);
  for (let index = 0; index < 3; index++) {
    assert.equal(hasCompletionPath([0, 1, 2].map(i => i !== index)), false);
  }
  assert.equal(hasCompletionPath([]), false);
});

test('193 protocol reconstruction detects premature read and accepts required owner ordering', () => {
  assert.equal(validateProtocol(protocol).valid, true);
  const wrong = [...protocol];
  [wrong[4], wrong[5]] = [wrong[5], wrong[4]];
  assert.deepEqual(validateProtocol(wrong), { valid: false, mismatch: 4 });
  assert.equal(validateProtocol([]).valid, false);
  assert.match(transferFeedback('join'), /退出确认/);
  assert.match(transferFeedback('cancel'), /只能证明/);
});
