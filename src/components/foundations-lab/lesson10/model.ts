export type Operator = '&&' | '||';
export type Order = 'guard-first' | 'read-first';
export type Guard = 'nonempty' | 'empty';
export interface Input { operator: Operator; order: Order; guard: Guard; items: number[] }
export interface Snapshot { stage: string; cause: string; left: boolean | 'panic' | null; right: boolean | 'panic' | 'skipped' | null; result: boolean | 'panic' | null; calls: number; active: 'none' | 'left' | 'branch' | 'right' | 'done' }
export const initialInput: Input = { operator: '&&', order: 'read-first', guard: 'nonempty', items: [] };
export const skipsRight = (operator: Operator, left: boolean) => operator === '&&' ? !left : left;
export const guardCode = (guard: Guard) => guard === 'nonempty' ? 'len(items) > 0' : 'len(items) == 0';
export function expression(input: Input) { const parts = [guardCode(input.guard), 'readPositive(items)']; if (input.order === 'read-first') parts.reverse(); return parts.join(` ${input.operator} `); }
export function trace(input: Input): Snapshot[] {
  const guard = input.guard === 'nonempty' ? input.items.length > 0 : input.items.length === 0;
  const readingLeft = input.order === 'read-first';
  const read = input.items.length ? input.items[0] > 0 : 'panic';
  const left = readingLeft ? read : guard;
  const initial: Snapshot = { stage: '准备求值', cause: '从左侧开始；readPositive 每调用一次就把观察计数加一，再访问 items[0]。', left: null, right: null, result: null, calls: 0, active: 'none' };
  const first: Snapshot = { ...initial, stage: '计算左侧', left, calls: readingLeft ? 1 : 0, result: left === 'panic' ? 'panic' : null, active: 'left', cause: left === 'panic' ? '左侧先读空列表，访问越界；右侧的长度检查还没有执行机会。' : `左侧得到 ${left}。${readingLeft ? '读取函数已经调用一次。' : '只检查长度，读取函数尚未调用。'}` };
  if (left === 'panic') return [initial, first, { ...first, active: 'branch', stage: '异常终止', cause: 'panic 已终止本次条件求值，不能继续用右侧检查补救。' }, { ...first, active: 'done', stage: '本次终止', cause: '先把检查移到左侧，再用空列表验证修复。' }];
  const skip = skipsRight(input.operator, left);
  const branch: Snapshot = { ...first, active: 'branch', stage: '决定是否走右侧', right: skip ? 'skipped' : null, result: skip ? left : null, cause: skip ? `${input.operator} 左侧为 ${left} 已决定结果，跳过整个右侧。` : `${input.operator} 左侧为 ${left} 还不能决定结果，需要继续求右侧。` };
  if (skip) return [initial, first, branch, { ...branch, active: 'done', stage: '短路完成', cause: `右侧没有执行，最终 ${left}；调用计数保持 ${branch.calls}。必要日志若藏在右侧也会被跳过。` }];
  const right = readingLeft ? guard : read;
  return [initial, first, branch, { ...branch, active: 'right', stage: right === 'panic' ? '右侧访问越界' : '右侧求值完成', right, calls: 1, result: right, cause: right === 'panic' ? '长度条件没有挡住空列表：&& 需非空为真才读，|| 需空列表为真才跳过。' : `右侧得到 ${right}，最终 ${right}。${readingLeft ? '读取函数在左侧已执行，右侧仅检查长度。' : '读取函数被调用一次，副作用计数变为 1。'}` }];
}
export function safetyCases(input: Input) { return [[], [-1], [3]].map(items => { const result = trace({ ...input, items })[3]; return { items, ...result, expected: input.operator === '&&' ? items.length > 0 && items[0] > 0 : items.length === 0 || items[0] > 0 }; }); }

