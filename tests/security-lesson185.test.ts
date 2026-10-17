import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compare, feedback, initialConfig, initialState, transition, type Config} from '../src/components/security-lab/lesson185/model';

test('SQL binding preserves quotes, whitespace and syntax-like values outside the fixed template', () => {
  for (const input of ["O'Reilly", '  季度 报表  ', "' OR 1=1 --", '', '😀']) {
    const config: Config = {...initialConfig, input};
    const result = compare(config);
    assert.deepEqual(result.protected.data, [input]);
    assert.equal(result.protected.structure, 'SELECT id FROM customers WHERE name = ?');
    assert.equal(result.protected.outcome, 'data');
    assert.ok(result.raw.structure.includes(input));
    assert.equal(result.raw.outcome, 'structure');
    assert.equal(config.input, input);
  }
});
test('SQL structure is selected from an own-key mapping; unknown values do not build a query', () => {
  for (const input of ['金额', 'created_at', 'name DESC', 'constructor', '__proto__', ' 时间']) {
    const result = compare({...initialConfig, context: 'sql-order', input}).protected;
    assert.equal(result.outcome, 'reject');
    assert.deepEqual(result.data, []);
    assert.equal(result.structure, '不构造 SQL 调用');
  }
  assert.match(compare({...initialConfig, context: 'sql-order', input: '时间'}).protected.structure, /ORDER BY created_at$/);
  assert.match(compare({...initialConfig, context: 'sql-order', input: '名称'}).protected.structure, /ORDER BY name$/);
});
test('argv keeps the same filename whole but a leading option still reaches target option parsing', () => {
  const config: Config = {context: 'shell', input: '季度 报表;2026.txt', optionBoundary: false};
  assert.deepEqual(compare(config).protected.data, [config.input]);
  assert.equal(compare(config).protected.outcome, 'data');
  const option = {...config, input: '--help'};
  assert.equal(compare(option).protected.outcome, 'structure');
  const separated = compare({...option, optionBoundary: true}).protected;
  assert.deepEqual(separated.data, ['--', '--help']);
  assert.equal(separated.outcome, 'data');
  assert.equal(option.input, '--help');
});
test('observation requires a prediction and a nonblank reason; rewind preserves prior input', () => {
  let state = initialState();
  assert.equal(transition(state, {type: 'step'}), state);
  state = transition(state, {type: 'predict', value: 'structure'});
  state = transition(state, {type: 'reason', value: '   '});
  assert.equal(transition(state, {type: 'step'}), state);
  state = transition(state, {type: 'reason', value: '我以为引号仍会被 SQL 当语法'});
  state = transition(state, {type: 'step'});
  assert.equal(state.phase, 1);
  assert.equal(transition(state, {type: 'predict', value: 'data'}), state);
  state = transition(transition(state, {type: 'step'}), {type: 'step'});
  assert.equal(state.phase, 3);
  assert.match(feedback(state), /预测需要修正/);
  assert.match(feedback(state), /绑定通道/);
  assert.equal(transition(state, {type: 'step'}).phase, 3);
  const back = transition(state, {type: 'back'});
  assert.equal(back.phase, 2);
  assert.equal(back.reason, state.reason);
  assert.deepEqual(back.config, state.config);
  assert.equal(transition(back, {type: 'step'}).phase, 3);
  const reset = transition(back, {type: 'reset'});
  assert.deepEqual(reset, initialState(state.config));
  assert.equal(transition(reset, {type: 'back'}).phase, 0);
});
test('condition changes invalidate previous prediction and reveal state, without mutating old snapshots', () => {
  const start = {...initialState(), prediction: 'data' as const, reason: '值独立绑定', phase: 3};
  const changed = transition(start, {type: 'configure', config: {...start.config, context: 'shell', input: '-n', optionBoundary: false}});
  assert.equal(changed.prediction, '');
  assert.equal(changed.reason, '');
  assert.equal(changed.phase, 0);
  assert.equal(start.phase, 3);
  assert.equal(start.config.context, 'sql-value');
});

test('cat special operand semantics survive the option boundary', () => {
  for (const optionBoundary of [true, false]) {
    const special = compare({context: 'shell', input: '-', optionBoundary}).protected;
    assert.equal(special.outcome, 'data');
    assert.match(special.explanation, /标准输入/);
    assert.equal(special.data.at(-1), '-');
    const empty = compare({context: 'shell', input: '', optionBoundary}).protected;
    assert.equal(empty.outcome, 'data');
    assert.match(empty.explanation, /不代表文件存在或操作成功/);
  }
});
