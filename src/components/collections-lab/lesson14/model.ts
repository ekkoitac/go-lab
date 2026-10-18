export type Slice = { array: string; length: number; capacity: number };
export type State = { arrays: Record<string, number[]>; a: Slice; b: Slice; nextArray: number; last: string };
export type Action = { kind: 'limit' } | { kind: 'copy' } | { kind: 'append'; value: number } | { kind: 'write'; index: number; value: number };
export function initial(capacity = 4, items = [10, 20]): State {
  if (!Number.isInteger(capacity) || capacity < items.length || capacity > 12 || !items.length || items.some(n => !Number.isSafeInteger(n))) throw new RangeError('容量必须容纳非空整数列表，且不超过 12');
  const a = { array: 'A', length: items.length, capacity };
  return { arrays: { A: [...items, ...Array(capacity - items.length).fill(0)] }, a, b: { ...a }, nextArray: 1, last: 'b := a：两个描述符指向 A，长度各自保存；预留槽位初始化为 0。' };
}
export function values(state: State, name: 'a' | 'b'): number[] { return state.arrays[state[name].array].slice(0, state[name].length); }
export function shared(state: State): boolean { return state.a.array === state.b.array; }
export function transition(state: State, action: Action): State {
  const next: State = { ...state, arrays: Object.fromEntries(Object.entries(state.arrays).map(([id, cells]) => [id, [...cells]])), a: { ...state.a }, b: { ...state.b } };
  if (action.kind === 'limit') {
    next.b.capacity = next.b.length;
    next.last = `b = b[:len(b):len(b)]：只把 b.cap 从 ${state.b.capacity} 限为 ${next.b.capacity}，仍指向 ${next.b.array}；现有元素没有复制。`;
  } else if (action.kind === 'copy') {
    const id = `N${state.nextArray}`;
    next.arrays[id] = values(state, 'b'); next.nextArray++;
    next.b = { array: id, length: state.b.length, capacity: state.b.length };
    next.last = `分配 ${id} 并 copy 当前整数元素，b 指向 ${id}；a 仍指向 A。此前对 A 的修改不会被撤销。`;
  } else {
    if (!Number.isSafeInteger(action.value)) throw new RangeError('值必须是安全整数');
    if (action.kind === 'write') {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.b.length) throw new RangeError('只能写入长度内的索引');
      const before = next.arrays[next.b.array][action.index]; next.arrays[next.b.array][action.index] = action.value;
      next.last = `b[${action.index}] → ${next.b.array}[${action.index}]：${before} → ${action.value}。${shared(next) && action.index < next.a.length ? 'a 也访问这格。' : 'a 的可见范围不包含这格。'}${before === action.value ? '新旧值相同，所以数值没有变化。' : ''}`;
    } else {
      if (state.b.length >= 12) throw new RangeError('演示最多 12 个元素');
      if (state.b.length + 1 > state.b.capacity) {
        const id = `N${state.nextArray}`; next.nextArray++;
        next.arrays[id] = [...values(state, 'b'), action.value];
        next.b = { array: id, length: state.b.length + 1, capacity: state.b.length + 1 };
        next.last = `新长度 ${next.b.length} > 原 cap ${state.b.capacity}：分配 ${id}、复制原元素、追加 ${action.value}，返回描述符给 b。演示选择 cap=${next.b.capacity}，实际运行时容量不由此预测。`;
      } else {
        next.arrays[next.b.array][next.b.length] = action.value; next.b.length++;
        next.last = `新长度 ${next.b.length} ≤ cap ${state.b.capacity}：复用 ${next.b.array}，写入第 ${next.b.length - 1} 格；只有 b.len 增为 ${next.b.length}，a.len 仍为 ${next.a.length}。`;
      }
    }
  }
  return next;
}
export function originalChanged(before: State, after: State): boolean { return values(before, 'a').some((n, i) => values(after, 'a')[i] !== n); }

