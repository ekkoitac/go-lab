export type Action = 'read' | 'insert' | 'delete' | 'append';
export interface Snapshot {
  records: number[]; offset: number; cursor: number | null; offsetPages: number[][]; keyPages: number[][];
  nextID: number; frontAdded: boolean; event: string; removed: number[];
}
export interface LabState { history: Snapshot[]; baseline: number[] }
export function initial(records: number[] = [1, 2, 3, 4, 5, 6]): LabState {
  const ordered = [...new Set(records)].sort((a, b) => a - b);
  return { baseline: ordered, history: [{ records: ordered, offset: 0, cursor: null, offsetPages: [], keyPages: [], nextID: Math.max(0, ...ordered) + 1, frontAdded: false, event: '尚未读取；两种方案共享同一份实时数据。', removed: [] }] };
}
export function current(state: LabState): Snapshot { return state.history[state.history.length - 1]; }
export function act(state: LabState, action: Action): LabState {
  const before = current(state);
  if (action === 'insert' && before.frontAdded || action === 'delete' && !before.records.length) return state;
  let next: Snapshot = { ...before, records: [...before.records], removed: [...before.removed] };
  if (action === 'read') {
    const offsetPage = before.records.slice(before.offset, before.offset + 2);
    const keyPage = before.records.filter(id => before.cursor === null || id > before.cursor).slice(0, 2);
    next = { ...next, offset: before.offset + 2, cursor: keyPage.length ? keyPage[keyPage.length - 1] : before.cursor,
      offsetPages: [...before.offsetPages, offsetPage], keyPages: [...before.keyPages, keyPage],
      event: '两种方案读取同一时刻的数据，每页最多 2 条。偏移返回 [' + offsetPage.join(', ') + ']；键集返回 [' + keyPage.join(', ') + ']。' };
  } else if (action === 'insert') {
    const id = Math.min(0, (state.baseline[0] ?? 1) - 1);
    next.records.unshift(id); next.frontAdded = true; next.event = '补入前方 ID ' + id + '：旧记录 ID 不变，数组位置右移。已读页和边界保持原样。';
  } else if (action === 'delete') {
    const id = next.records.shift()!; next.removed.push(id); next.event = '删除最前方 ID ' + id + '：剩余记录位置左移，已读结果仍留在客户端。';
  } else {
    const id = before.nextID; next.records.push(id); next.nextID++; next.event = '后方追加 ID ' + id + '：它不属于开始时的列表；后续实时读取可能返回它。';
  }
  return { ...state, history: [...state.history, next] };
}
export function advance(state: LabState): LabState { return act(state, 'read'); }
export function rewind(state: LabState): LabState { return state.history.length > 1 ? { ...state, history: state.history.slice(0, -1) } : state; }
export function inspect(state: LabState, kind: 'offset' | 'key') {
  const snapshot = current(state), pages = kind === 'offset' ? snapshot.offsetPages : snapshot.keyPages;
  const seen = pages.flat(), unique = [...new Set(seen)];
  const duplicates = [...new Set(seen.filter((id, i) => seen.indexOf(id) !== i))];
  const passed = kind === 'offset' ? snapshot.records.slice(0, snapshot.offset) : snapshot.records.filter(id => snapshot.cursor !== null && id <= snapshot.cursor);
  const skipped = passed.filter(id => state.baseline.includes(id) && !unique.includes(id));
  const behindNew = passed.filter(id => !state.baseline.includes(id) && !unique.includes(id));
  const deletedUnread = snapshot.removed.filter(id => !unique.includes(id));
  return { pages, seen, duplicates, skipped, behindNew, deletedUnread, lastPage: pages.at(-1) ?? [] };
}


