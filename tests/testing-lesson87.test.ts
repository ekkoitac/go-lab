import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compare, initialConfig, initialState, inputFor, measure, nextStep, scopeFeedback} from '../src/components/testing-lab/lesson87/model';

test('87 preparation outside ResetTimer excludes setup time and allocations for same input', () => {
  const results = compare(initialConfig, 4);
  assert.deepEqual(inputFor(4), [1, 2, 3, 4]);
  assert.equal(results.baseline.totalUnits, 60);
  assert.equal(results.candidate.totalUnits, 12);
  assert.equal(results.baseline.allocations, 3);
  assert.equal(results.candidate.allocations, 0);
  assert.equal(results.baseline.sink, results.candidate.sink);
  assert.equal(results.candidate.sink, 10);
});

test('87 moving setup without resetting counts it once and amortizes by b.N', () => {
  const config = {...initialConfig, placement: 'outside-counted' as const};
  const prepared = measure(config, 1);
  assert.equal(prepared.setupUnits, 16);
  assert.equal(prepared.executed, 0);
  assert.equal(prepared.averageUnits, null);
  const result = measure(config, 4);
  assert.equal(result.totalUnits, 28);
  assert.equal(result.averageUnits, 28 / 3);
  assert.equal(result.allocations, 1);
});

test('87 prediction and explanation are required, each step retains prior input, and completed model stops', () => {
  const start = initialState();
  assert.equal(nextStep(start), start);
  assert.equal(nextStep({...start, prediction: 'less'}).step, 0);
  let state = {...start, prediction: 'less', reason: '准备在计时之外'};
  for (let step = 1; step <= 4; step++) {
    state = nextStep(state);
    assert.equal(state.step, step);
    assert.equal(measure(state.config, step).executed, step - 1);
  }
  assert.equal(nextStep(state), state);
  assert.equal(start.step, 0);
  assert.deepEqual(initialState().config, initialConfig);
});

test('87 discarded results flag risk without pretending the compiler always removes work', () => {
  const result = measure({...initialConfig, consume: false}, 4);
  assert.equal(result.sink, null);
  assert.equal(result.optimizationRisk, true);
  assert.equal(result.workUnits, 12);
  assert.match(scopeFeedback({...initialConfig, consume: false}, 'sum'), /可能优化|取决于/);
});

test('87 ReportAllocs changes reporting, not simulated work; end-to-end needs repeated preparation', () => {
  const hidden = measure({...initialConfig, reportAllocs: false}, 4);
  assert.equal(hidden.allocations, null);
  assert.equal(hidden.totalUnits, measure(initialConfig, 4).totalUnits);
  const transfer = {...initialConfig, size: 8, rounds: 2, placement: 'inside' as const};
  assert.equal(measure(transfer, 3).totalUnits, 80);
  assert.equal(measure(transfer, 3).allocations, 2);
  assert.equal(measure(transfer, 3).sink, 36);
  assert.match(scopeFeedback(transfer, 'end-to-end'), /符合端到端目标/);
  assert.match(scopeFeedback(transfer, 'sum'), /混入准备成本/);
  assert.match(scopeFeedback(initialConfig, 'end-to-end'), /遗漏/);
});
