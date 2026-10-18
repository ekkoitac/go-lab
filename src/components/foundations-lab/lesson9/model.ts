export type Policy = 'sequential' | 'multiple' | 'temporary';
export type Scenario = 'swap' | 'sum' | 'index';
export type Input = { a: number; b: number; i: number; policy: Policy; scenario: Scenario };
export type Snapshot = { a: number; b: number; i: number; saved: number[]; targets: string[]; operation: string; cause: string; changed: string };
export const initialInput: Input = { a: 2, b: 9, i: 0, policy: 'sequential', scenario: 'swap' };
export function program(input: Input): string {
  if (input.scenario === 'index') return `i := ${input.i}; a := []int{${input.a}, ${input.b}}\ni, a[i] = 1, 7`;
  const rhs = input.scenario === 'sum' ? 'x+y' : 'x';
  return `x, y := ${input.a}, ${input.b}\n` + (input.policy === 'sequential' ? `x = y\ny = ${rhs}` : input.policy === 'multiple' ? `x, y = y, ${rhs}` : `oldX, oldY := x, y\nx = oldY\ny = ${input.scenario === 'sum' ? 'oldX+oldY' : 'oldX'}`);
}
export function trace(input: Input): Snapshot[] {
  if (![input.a, input.b].every(n => Number.isInteger(n) && n >= -20 && n <= 20) || ![0, 1].includes(input.i)) throw new RangeError('模型只接受 -20 至 20 的整数和索引 0/1');
  let state: Snapshot = { a: input.a, b: input.b, i: input.i, saved: [], targets: [], operation: '执行前', cause: '先记录预测与理由；尚未读取或写入。', changed: '' };
  const states: Snapshot[] = [];
  const push = (patch: Partial<Snapshot>) => { state = { ...state, ...patch }; states.push({ ...state, saved: [...state.saved], targets: [...state.targets] }); };
  push({});
  if (input.scenario === 'index') {
    push({ saved: [1, 7], targets: ['i', `a[${input.i}]`], operation: '求值与定位', cause: `右侧值保存为 (1, 7)，左侧 a[i] 使用旧 i=${input.i} 定位。还未写入。`, changed: 'saved' });
    push({ i: 1, operation: '写入第一个目标 i', cause: `i 从 ${input.i} 变成 1；已定位的 a[${input.i}] 不会重新计算。`, changed: 'i' });
    push({ [input.i === 0 ? 'a' : 'b']: 7, operation: `写入第二个目标 a[${input.i}]`, cause: `把已保存的 7 写入先前定位的 a[${input.i}]；不是用新 i 再定位。`, changed: input.i === 0 ? 'a' : 'b' });
  } else if (input.policy === 'sequential') {
    push({ a: input.b, operation: '执行 x = y', cause: `读取 y=${input.b} 后写 x；旧 x=${input.a} 没有被保存。`, changed: 'a' });
    const next = input.scenario === 'sum' ? state.a + state.b : state.a;
    push({ b: next, operation: `执行 y = ${input.scenario === 'sum' ? 'x+y' : 'x'}`, cause: `这是下一条语句，读取的是已更新的 x=${state.a}，得到 ${next}。`, changed: 'b' });
  } else {
    const result = input.scenario === 'sum' ? input.a + input.b : input.a;
    push({ saved: input.policy === 'multiple' ? [input.b, result] : [input.a, input.b], targets: ['x', 'y'], operation: input.policy === 'multiple' ? '先求出全部右侧值' : '保存 oldX 与 oldY', cause: input.policy === 'multiple' ? `用旧 x=${input.a}、y=${input.b} 求得 (${input.b}, ${result})；变量还未写入。` : `独立临时变量保存 (${input.a}, ${input.b})，后续不会从被覆盖的 x 读取旧值。`, changed: 'saved' });
    push({ a: input.b, operation: '先写 x', cause: `x 从 ${input.a} 变成 ${input.b}；y 暂时仍为 ${input.b}。这是从左到右写入的中间状态。`, changed: 'a' });
    push({ b: result, operation: '再写 y', cause: `使用先前保留的值，写入 y=${result}；不从新 x 推算旧 x。`, changed: 'b' });
  }
  return states;
}
export function resultLabel(input: Input, state: Snapshot): string {
  return input.scenario === 'index' ? `i=${state.i}, a=[${state.a}, ${state.b}]` : `x=${state.a}, y=${state.b}`;
}
