import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runExperiment, shrinkOnce, parseInput, isValid, type ExperimentInput} from '../src/components/testing-lab/lesson86/model';
const base: ExperimentInput = {input: '猫咪Go', mode: 'text', implementation: 'byte', property: 'utf8'};
test('ASCII passes but Unicode first-byte truncation supplies concrete counterexample', () => {
  assert.equal(runExperiment({...base, input: 'abc'}).outcome, 'pass');
  const result = runExperiment(base); assert.equal(result.outcome, 'fail'); assert.deepEqual(result.output, [0xE7]); assert.equal(result.validOutput, false);
  assert.equal(runExperiment({...base, input: '🙂'}).outcome, 'fail');
});
test('rune implementation preserves full Unicode code point and handles empty input', () => {
  for (const input of ['', 'A', '猫', '🙂', '\uFEFFx', 'e\u0301']) {
    const result = runExperiment({...base, input, implementation: 'rune'});
    assert.equal(result.outcome, 'pass'); assert.equal(isValid(result.output), true);
    assert.deepEqual(result.output, Array.from(new TextEncoder().encode(Array.from(input)[0] ?? '')));
  }
});
test('arbitrary Go bytes have explicit guarded policy; invalid input skips instead of passing', () => {
  for (const input of ['FF', 'E7', 'C0 AF', 'ED A0 80', 'F4 90 80 80']) {
    const result = runExperiment({...base, mode: 'hex', input});
    assert.equal(result.outcome, 'skip'); assert.equal(result.validInput, false); assert.deepEqual(result.output, []);
  }
  assert.equal(runExperiment({...base, mode: 'hex', input: 'E7 8C AB'}).outcome, 'fail');
  assert.throws(() => parseInput('F', 'hex')); assert.throws(() => parseInput('GG', 'hex'));
  assert.throws(() => parseInput('\uD800', 'text'));
});
test('weak length oracle misses broken UTF8 output', () => {
  const result = runExperiment({...base, property: 'length'});
  assert.equal(result.outcome, 'pass'); assert.equal(result.validOutput, false);
});
test('shrinking removes complete trailing code points only and preserves failure', () => {
  let config = {...base}; const evidence: string[] = [];
  for (let input = shrinkOnce(config); input !== null; input = shrinkOnce(config)) {
    config = {...config, input}; evidence.push(input); assert.equal(runExperiment(config).outcome, 'fail');
  }
  assert.deepEqual(evidence, ['猫咪G', '猫咪', '猫']);
  assert.equal(shrinkOnce({...base, input: 'abc'}), null);
  assert.equal(shrinkOnce({...base, mode: 'hex', input: 'E7 8C AB 41'}), 'E7 8C AB');
});
