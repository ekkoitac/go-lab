export type Slice = number[] | null;
export type Contract = 'array' | 'nullable';
export type Action = 'nil' | 'empty' | 'append' | 'truncate' | 'clear' | 'normalize' | 'encode';
export interface State { items: Slice; normalize: boolean; contract: Contract; wire: string | null; operation: string }
export const baseline: State = {items:null,normalize:false,contract:'array',wire:null,operation:'var items []int：长度为 0，值为 nil。'};
export function encode(items: Slice, normalize = false): string { return JSON.stringify(items === null && normalize ? [] : items); }
export function accepts(wire: string, contract: Contract): boolean { try { const value: unknown = JSON.parse(wire); return Array.isArray(value) || (value === null && contract === 'nullable'); } catch { return false; } }
export function transition(state: State, action: Action): State {
  const next: State = {...state, items:state.items === null ? null : [...state.items],wire:null};
  if(action === 'nil') { next.items=null; next.operation='items = nil：移除切片值，len=0 且 items==nil。'; }
  if(action === 'empty') { next.items=[]; next.operation='items = make([]int, 0)：len=0，但 items!=nil。'; }
  if(action === 'append') { next.items=[...(next.items ?? []),7]; next.operation='items = append(items, 7)：接收新切片，长度增加 1；nil 也可以追加。'; }
  if(action === 'truncate') { next.items=next.items === null ? null : []; next.operation='items = items[:0]：长度变为 0；原来的 nil / 非 nil 性质不变。'; }
  if(action === 'clear') { next.items=next.items === null ? null : next.items.map(() => 0); next.operation='clear(items)：现有元素变成 0，长度不变；并不把切片变成空列表。'; }
  if(action === 'normalize') { next.normalize=!next.normalize; next.operation=next.normalize ? '启用边界规范化：仅当 items==nil 时，把待编码的局部值换成 []int{}；内部 items 不变。' : '关闭边界规范化：直接编码内部 items。'; }
  if(action === 'encode') { next.wire=encode(next.items,next.normalize); next.operation=`json.Marshal(out)：得到 ${next.wire}；${accepts(next.wire,next.contract) ? '接收方契约通过。' : '接收方要求数组，null 未通过。'}`; }
  return next;
}
export function snapshot(state: State) { return {...state,len:state.items?.length ?? 0,isNil:state.items===null,rangeCount:state.items?.length ?? 0,accepted:state.wire===null ? null : accepts(state.wire,state.contract)}; }
export const challenges = [
  {code:'var ids []int\nids = append(ids, []int{}...)\nb, _ := json.Marshal(ids)',answer:'null',why:'向 nil 切片追加零项仍返回 nil，长度为 0，编码为 null。'},
  {code:'ids := []int{12, 15}\nids = ids[:0]\nb, _ := json.Marshal(ids)',answer:'[]',why:'截短到 0 保持非 nil，编码为空数组 []。'},
  {code:'ids := []int{12, 15}\nclear(ids)\nb, _ := json.Marshal(ids)',answer:'[0,0]',why:'clear 只把两个元素置零，长度仍是 2，编码为 [0,0]。'},
];

