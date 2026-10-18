export type Order = { qty: number; tags: string };
export type OrderModel = { original: Order; draft: Order; arrays: Record<string, string[]>; nextId: number };
export type Action = 'quantity' | 'element' | 'rebind' | 'clone';
export const actions: Record<Action, { title: string; code: string }> = {
  quantity: { title: '修改副本数量', code: 'b.Qty++' },
  element: { title: '修改副本首标签', code: 'b.Tags[0] = "SALE"' },
  rebind: { title: '给副本换新标签切片', code: 'b.Tags = []string{"NEW"}' },
  clone: { title: '按需复制副本标签', code: 'b.Tags = append([]string(nil), b.Tags...)' },
};
export function initialModel(qty = 2, label = 'VIP'): OrderModel {
  return { original: { qty, tags: 'A' }, draft: { qty, tags: 'A' }, arrays: { A: [label] }, nextId: 1 };
}
export function applyAction(state: OrderModel, action: Action): OrderModel {
  const next: OrderModel = { original: { ...state.original }, draft: { ...state.draft }, arrays: Object.fromEntries(Object.entries(state.arrays).map(([id, values]) => [id, [...values]])), nextId: state.nextId };
  if (action === 'quantity') next.draft.qty++;
  if (action === 'element') next.arrays[next.draft.tags][0] = 'SALE';
  if (action === 'clone' || action === 'rebind') {
    const id = `B${next.nextId++}`;
    next.arrays[id] = action === 'clone' ? [...next.arrays[next.draft.tags]] : ['NEW'];
    next.draft.tags = id;
  }
  return next;
}
export function originalChanged(before: OrderModel, after: OrderModel): boolean {
  return before.original.qty !== after.original.qty || before.original.tags !== after.original.tags || before.arrays[before.original.tags][0] !== after.arrays[after.original.tags][0];
}
export function describeChange(before: OrderModel, after: OrderModel, action: Action): string {
  const oldA = before.arrays[before.original.tags][0];
  const newA = after.arrays[after.original.tags][0];
  if (action === 'quantity') return `b.Qty：${before.draft.qty} → ${after.draft.qty}；a.Qty 仍为 ${after.original.qty}。整数值已经复制到不同字段。`;
  if (action === 'element') return `沿 b.Tags → ${before.draft.tags} 写入 SALE。a.Tags[0]：${oldA} → ${newA}。${before.original.tags === before.draft.tags ? '两个描述符指向同一数组，所以写入同一元素。' : '两个描述符指向不同数组，原订单不受影响。'}${oldA === newA && before.original.tags === before.draft.tags ? '原元素已经是 SALE，因此共享写入没有产生可见值差异。' : ''}`;
  if (action === 'clone') return `复制当前标签元素到 ${after.draft.tags}，只改写 b.Tags 描述符；a.Tags 仍指向 ${after.original.tags}。已有标签值不会倒退，复制不是撤销。`;
  return `b.Tags：${before.draft.tags} → ${after.draft.tags}，新数组内容 NEW；a.Tags 仍指向 ${after.original.tags}。改描述符与沿描述符修改元素是两种操作。`;
}
export function repairedComparison(state: OrderModel, action: Action) {
  return { unchanged: applyAction(state, action), isolated: applyAction(applyAction(state, 'clone'), action) };
}
