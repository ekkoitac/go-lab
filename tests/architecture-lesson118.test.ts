import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, canAdvance, cancel, configure, download, fail, initial, query, rewind, setActor, setDrop, setPage, type LabState } from '../src/components/architecture-lab/lesson118/model';
function steps(state: LabState, count: number) { for (let i = 0; i < count; i++) state = advance(state); return state; }
test('118 acceptance is not completion; worker progress is distinct from client known state', () => {
  let state = advance(initial({ mode: 'poll', duration: 3 }));
  assert.equal(state.current.job?.status, 'accepted'); assert.equal(state.current.known, 'accepted'); assert.equal(state.current.downloaded, false);
  state = advance(state); assert.equal(state.current.job?.status, 'running'); assert.equal(state.current.known, 'accepted');
  state = query(state); assert.equal(state.current.known, 'running');
});
test('118 closing and reopening cannot cancel background work; query restores lost completion', () => {
  let state = steps(initial(), 2); state = setPage(state, false); state = steps(state, 3);
  assert.equal(state.current.job?.status, 'succeeded'); assert.equal(state.current.notification, 'lost');
  assert.equal(state.current.known, 'accepted'); assert.equal(state.current.savedId, true);
  state = setPage(state, true); assert.equal(state.current.known, 'unknown');
  state = query(state); assert.equal(state.current.known, 'succeeded');
  state = download(state); assert.equal(state.current.downloaded, true);
});
test('118 injected notification loss does not change task record or allow notification toggle to fake recovery', () => {
  let state = setDrop(initial(), true); state = steps(state, 5);
  assert.equal(state.current.job?.status, 'succeeded'); assert.equal(state.current.notification, 'lost'); assert.equal(state.current.known, 'accepted');
  state = setDrop(state, false); assert.equal(state.current.known, 'accepted');
  state = query(state); assert.equal(state.current.known, 'succeeded');
});
test('118 failure persists while offline and is discoverable without completion push', () => {
  let state = steps(initial(), 2); state = setPage(state, false); state = fail(state);
  assert.equal(state.current.job?.status, 'failed'); assert.equal(canAdvance(state), false);
  state = query(setPage(state, true)); assert.equal(state.current.known, 'failed');
  assert.equal(download(state).current.downloaded, false);
});
test('118 task IDs grant neither query nor download permission', () => {
  const done = steps(initial(), 5); let other = setActor(done, 'other');
  other = query(other); assert.equal(other.current.known, 'unknown'); assert.match(other.current.notice, /403/);
  other = download(other); assert.equal(other.current.downloaded, false); assert.match(other.current.notice, /403/);
  const cancelled = cancel(other); assert.equal(cancelled.current.job?.status, 'succeeded'); assert.match(cancelled.current.notice, /403/);
  assert.deepEqual(other.current.job, done.current.job);
});
test('118 cancellation first stops work, completion first cannot be undone', () => {
  let state = steps(initial(), 2); state = cancel(state); assert.equal(state.current.job?.status, 'cancelled');
  assert.equal(advance(state), state); assert.equal(fail(state), state);
  const finished = steps(initial(), 5); const lateCancel = cancel(finished);
  assert.equal(lateCancel.current.job?.status, 'succeeded'); assert.equal(lateCancel.current.job?.retention, 2);
  assert.match(lateCancel.current.notice, /不能撤销/);
});
test('118 expiration removes server availability without retracting downloaded local copy', () => {
  const finished = steps(initial(), 5); const downloaded = download(finished); const expired = steps(downloaded, 2);
  assert.equal(expired.current.job?.status, 'expired'); assert.equal(expired.current.downloaded, true);
  assert.match(download(expired).current.notice, /410/);
  assert.equal(query(expired).current.known, 'expired');
  assert.equal(download(steps(finished, 2)).current.downloaded, false);
});
test('118 short synchronous work fits budget; long work times out yet may finish at server', () => {
  const short = steps(initial({ mode: 'sync', duration: 1 }), 3);
  assert.equal(short.current.known, 'succeeded'); assert.equal(short.current.downloaded, true); assert.equal(short.current.savedId, false);
  const long = steps(initial({ mode: 'sync', duration: 3 }), 5);
  assert.equal(long.current.job?.status, 'succeeded'); assert.equal(long.current.known, 'unknown'); assert.equal(long.current.downloaded, false);
  assert.equal(query(long).current.known, 'unknown'); assert.match(query(long).current.notice, /没有独立任务/);
  const boundary = steps(initial({ mode: 'sync', duration: 2 }), 4); assert.equal(boundary.current.known, 'succeeded');
});
test('118 rewind restores all server and client state; a different event discards old future', () => {
  const start = initial(); const accepted = advance(start); assert.deepEqual(rewind(accepted), start);
  const running = advance(accepted); const failed = fail(running);
  const branch = advance(rewind(failed)); assert.equal(branch.current.job?.status, 'running'); assert.equal(branch.current.job?.progress, 1);
  assert.equal(failed.current.job?.status, 'failed'); assert.deepEqual(rewind(branch), running);
  const reset = configure(failed, { mode: 'poll' }); assert.equal(reset.current.job, null); assert.equal(reset.history.length, 0);
});
test('118 disabled or closed page cannot create jobs and closed client cannot query facts', () => {
  const closed = setPage(initial(), false); assert.equal(canAdvance(closed), false); assert.equal(advance(closed), closed);
  assert.equal(canAdvance(setActor(initial(), 'other')), false);
  const offline = setPage(steps(initial(), 2), false); assert.equal(query(offline).current.known, 'accepted');
});
