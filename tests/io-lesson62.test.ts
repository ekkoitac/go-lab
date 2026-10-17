import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrace, outcome, type OpenResult, type Policy } from '../src/components/io-lab/lesson62/model';

test('checked failure preserves Open evidence and never touches absent resource', () => {
  for (const result of ['missing', 'denied'] as OpenResult[]) {
    const trace = buildTrace({ result, policy: 'checked' }); const last = trace.at(-1)!;
    assert.equal(last.file, 'nil'); assert.equal(last.reported, last.primary);
    assert.equal(last.readCalls, 0); assert.equal(last.closeCalls, 0); assert.equal(last.deferred, 'none');
    assert.equal(outcome({ result, policy: 'checked' }), 'original');
    assert.ok(!trace.some(s => s.stage === 'defer 注册'));
  }
});
test('ignored Open failure produces secondary Read error without inventing a panic', () => {
  const trace = buildTrace({ result: 'missing', policy: 'ignore' }); const last = trace.at(-1)!;
  assert.match(last.primary!, /does not exist/); assert.equal(last.reported, 'invalid argument');
  assert.equal(last.readCalls, 1); assert.equal(last.closeCalls, 1); assert.equal(last.closeError, 'invalid argument');
  assert.notEqual(last.primary, last.reported);
});
test('early defer captures nil at registration but executes only on return', () => {
  const trace = buildTrace({ result: 'denied', policy: 'early' });
  const registered = trace.find(s => s.stage === 'defer 注册')!;
  assert.equal(registered.deferred, 'nil'); assert.equal(registered.closeCalls, 0);
  const returning = trace.find(s => s.stage === 'return')!;
  assert.equal(returning.closeCalls, 0);
  const last = trace.at(-1)!; assert.equal(last.readCalls, 0); assert.equal(last.closeCalls, 1);
  assert.equal(last.reported, last.primary); assert.equal(outcome({ result: 'denied', policy: 'early' }), 'early-close');
});
test('success paths retain open resource until deferred cleanup and close exactly once', () => {
  for (const policy of ['ignore', 'early', 'checked'] as Policy[]) {
    const trace = buildTrace({ result: 'success', policy });
    assert.equal(trace.find(s => s.stage === 'Read')!.file, 'open');
    assert.equal(trace.find(s => s.stage === 'return')!.file, 'open');
    assert.equal(trace.at(-1)!.file, 'closed'); assert.equal(trace.at(-1)!.closeCalls, 1);
    assert.equal(trace.at(-1)!.readCalls, 1); assert.equal(trace.at(-1)!.reported, null);
  }
});
test('repair under identical failed input removes secondary operations; snapshots remain immutable', () => {
  const bad = buildTrace({ result: 'denied', policy: 'ignore' }); const before = JSON.stringify(bad);
  const good = buildTrace({ result: 'denied', policy: 'checked' });
  assert.equal(bad.at(-1)!.primary, good.at(-1)!.primary);
  assert.equal(good.at(-1)!.readCalls + good.at(-1)!.closeCalls, 0);
  assert.equal(JSON.stringify(bad), before); assert.equal(bad[0].file, 'unopened');
  assert.equal(new Set(bad).size, bad.length);
});
