import test from 'node:test';
import assert from 'node:assert/strict';
import {back, configure, createState, defaults, eventFor, outcome, step, view, type Config, type State} from '../src/components/security-lab/lesson190/model';
const finish = (patch: Partial<Config> = {}): State => {let state: State = {...createState(), config: {...defaults, ...patch}, prediction: 'completed', reason: '跟踪实际完成时间与保存时间'}; for (let i = 0; i < 4; i++) state = step(state); return state;};
test('190 events distinguish received request, denied authorization and actual completion', () => {
  const initial = {...createState(), prediction: 'completed' as const, reason: '按时间线分析'};
  const requested = view(step(initial));
  assert.deepEqual(requested.events.map(e => [e.event, e.result]), [['requested', 'pending']]);
  const denied = view(finish({authorized: false}));
  assert.equal(denied.actual, 'denied');
  assert.deepEqual(denied.events.map(e => e.event), ['requested', 'denied']);
  const complete = view(finish());
  assert.deepEqual(complete.events.map(e => e.event), ['requested', 'completed']);
  assert.equal(complete.events[1].actor, 'trusted:admin-7');
  assert.equal(complete.events[0].correlationId, complete.events[1].correlationId);
  assert.equal(complete.events[1].resource, 'tenant-A:collection-R');
});
test('190 preflight failure policies differ from post-completion audit failure', () => {
  assert.equal(outcome({...defaults, sink: 'before'}), 'blocked');
  assert.equal(outcome({...defaults, sink: 'before', policy: 'continue'}), 'completed');
  const late = view(finish({sink: 'after'}));
  assert.equal(late.actual, 'completed');
  assert.deepEqual(late.saved.map(e => e.event), ['requested']);
  assert.match(late.issues.join(' '), /不得伪称业务已回滚/);
  const denied = view(finish({authorized: false, sink: 'before'}));
  assert.match(denied.issues.join(' '), /授权已拒绝/);
  assert.doesNotMatch(denied.issues.join(' '), /前置阻断策略生效/);
});
test('190 structured encoding keeps injected newlines inside one event', () => {
  const note = '正常\n{"event":"completed","actor":"admin-fake"}';
  const result = view(finish({note}));
  const lines = result.serialized.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).note, note);
  assert.equal(JSON.parse(lines[0]).actor, 'trusted:admin-7');
  assert.equal(JSON.parse(lines[0]).event, 'requested');
  assert.equal(eventFor({...defaults, note: 'x'.repeat(120)}, 'requested').note.length, 80);
});
test('190 diagnosis names evidence gaps and unsafe fields, safe schema omits secrets', () => {
  const safe = eventFor(defaults, 'completed');
  assert.equal('Authorization' in safe, false); assert.equal('body' in safe, false);
  const result = view(finish({actor: false, correlation: false, leak: true}));
  for (const field of ['actor', 'correlationId', 'Authorization', 'body']) assert.match(result.issues.join(' '), new RegExp(field));
});
test('190 reader authorization and retention gate visible records', () => {
  const noAccess = view(finish({reader: 'operator'})); assert.equal(noAccess.readable, false); assert.deepEqual(noAccess.visible, []); assert.equal(noAccess.serialized, '');
  const expired = view(finish({retained: false})); assert.deepEqual(expired.visible, []); assert.match(expired.readStatus, /已清理/);
});
test('190 prediction, explanation, rewind and condition branching are explicit', () => {
  const empty = createState(); assert.equal(step(empty), empty); assert.equal(step({...empty, prediction: 'completed'}).phase, 0);
  const predicted = {...empty, prediction: 'completed' as const, reason: '有授权并且保存正常'};
  assert.deepEqual(back(step(predicted)), predicted);
  const changed = configure(step(predicted), {sink: 'after'}); assert.equal(changed.phase, 0); assert.equal(changed.reason, ''); assert.equal(changed.prediction, ''); assert.deepEqual(back(changed), step(predicted));
  const final = finish(); assert.equal(step(final), final); assert.equal(createState().phase, 0);
});

