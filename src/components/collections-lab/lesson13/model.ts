export type Slice = { array: 'A' | 'B'; offset: number; length: number; capacity: number };
export type State = { arrays: { A: number[]; B: number[] }; prices: Slice; sale: Slice; last: string };
export type Action = { kind: 'window'; low: number; high: number } | { kind: 'assign' } | { kind: 'copy' } | { kind: 'write'; target: 'prices' | 'sale'; index: number; value: number };
export function initial(items = [100, 200, 300, 400]): State {
  if (items.length < 2 || items.some(n => !Number.isSafeInteger(n))) throw new RangeError('至少两个整数元素');
  return { arrays: { A: [...items], B: [] }, prices: { array: 'A', offset: 0, length: items.length, capacity: items.length }, sale: { array: 'A', offset: 1, length: items.length - 1, capacity: items.length - 1 }, last: 'sale := prices[1:]；只创建窗口，未复制任何元素。' };
}
export function values(state: State, target: 'prices' | 'sale'): number[] {
  const s = state[target]; return state.arrays[s.array].slice(s.offset, s.offset + s.length);
}
export function address(state: State, target: 'prices' | 'sale', index: number) {
  const s = state[target];
  if (!Number.isInteger(index) || index < 0 || index >= s.length) throw new RangeError('索引必须位于切片长度内');
  return { array: s.array, slot: s.offset + index };
}
export function transition(state: State, action: Action): State {
  const next: State = { arrays: { A: [...state.arrays.A], B: [...state.arrays.B] }, prices: { ...state.prices }, sale: { ...state.sale }, last: '' };
  if (action.kind === 'assign') {
    next.sale = { ...state.prices }; next.last = 'sale = prices：复制描述符，两个窗口都指向 A；元素没有复制。';
  } else if (action.kind === 'window') {
    const { low, high } = action;
    if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || low > high || high > state.prices.length) throw new RangeError('需要 0 ≤ low ≤ high ≤ len(prices)');
    next.sale = { array: 'A', offset: low, length: high - low, capacity: state.prices.capacity - low };
    next.last = `sale = prices[${low}:${high}]：起点 ${low}，len=${high - low}；prices 的长度仍是 ${state.prices.length}，A 的元素未变。`;
  } else if (action.kind === 'copy') {
    next.arrays.B = values(state, 'sale'); next.sale = { array: 'B', offset: 0, length: next.arrays.B.length, capacity: next.arrays.B.length };
    next.last = '分配 B 并 copy：复制当前 sale 的整数元素，再让 sale 指向 B；后续写入互不影响。';
  } else {
    if (!Number.isSafeInteger(action.value)) throw new RangeError('写入值必须是安全整数');
    const a = address(state, action.target, action.index), before = state.arrays[a.array][a.slot];
    next.arrays[a.array][a.slot] = action.value;
    const shared = a.array === 'A' && a.slot >= state.sale.offset && a.slot < state.sale.offset + state.sale.length && state.sale.array === 'A';
    next.last = `${action.target}[${action.index}] → ${a.array}[${a.slot}]：${before} → ${action.value}。${shared ? 'prices 与 sale 的访问路径命中同一格，共同可见。' : '另一窗口不访问这格，因此其可见元素不变。'}${before === action.value ? '本次写入与原值相同，数组数值没有变化。' : ''}`;
  }
  return next;
}
export function originalChanged(before: State, after: State): boolean {
  return values(before, 'prices').some((n, i) => n !== values(after, 'prices')[i]);
}
