import test from 'node:test';
import assert from 'node:assert/strict';
import {metricsFor, moveStage, percentile, retryLimit, traceFor, visibleTrace} from '../src/components/observability-lab/lesson173/model';

test('173: overall P99 uses complete distribution rather than average of percentiles', () => {
  assert.deepEqual(metricsFor(2), {count: 1000, slowCount: 20, mean: 167.2, p99: 520, errors: 0});
  assert.equal(percentile([...Array(990).fill(160), ...Array(10).fill(520)], .99), 160);
  assert.equal(percentile([], .99), null);
  assert.throws(() => percentile([1], 2), RangeError);
});
test('173: critical path accounts for parallel dependencies, retries and waiting separately', () => {
  const normal = traceFor('normal');
  const slow = traceFor('slow');
  assert.equal(normal.duration, 160);
  assert.equal(slow.duration, 520);
  assert.equal(slow.attempts, 3);
  assert.equal(slow.segments.filter(s => s.kind === 'wait').reduce((n, s) => n + s.duration, 0), 240);
  assert.equal(slow.segments.filter(s => s.critical).reduce((n, s) => n + s.duration, 0), slow.duration);
  assert.equal(normal.segments.filter(s => s.critical).reduce((n, s) => n + s.duration, 0), normal.duration);
  assert.equal(slow.segments.find(s => s.id === 'shipping')!.critical, false);
  assert.match(slow.segments.find(s => s.id === 'inventory-0')!.log, /冲突/);
});
test('173: smaller retry budgets decrease latency at the cost of failed orders', () => {
  assert.equal(traceFor('slow', 0).success, false);
  assert.equal(traceFor('slow', 1).duration, 320);
  assert.equal(metricsFor(1).errors, 20);
  assert.deepEqual(traceFor('slow', 3), traceFor('slow', 2));
  assert.equal(traceFor('normal', 0).success, true);
});
test('173: sampling hides trace evidence, not request metrics; bounds remain finite', () => {
  const before = metricsFor(2);
  assert.equal(visibleTrace('missing', 2), null);
  assert.deepEqual(metricsFor(2), before);
  assert.equal(retryLimit(NaN), 2);
  assert.equal(retryLimit(-1), 0);
  assert.equal(retryLimit(9), 3);
  assert.equal(moveStage(3, 1), 3);
  assert.equal(moveStage(0, -1), 0);
  assert.equal(moveStage(2, -1), 1);
});
