export type Entry = { key: string; value: number };
export type Reading = { key: string; value: number; ok: boolean };
export type State = { entries: Entry[]; nil: boolean; halted: boolean; reading: Reading | null; operation: string; detail: string };
export type Action = { type: 'read'; key: string } | { type: 'delete'; key: string } | { type: 'write'; key: string; value: number } | { type: 'nil' } | { type: 'make' };
export function initial(): State { return {entries:[{key:'A',value:0},{key:'C',value:8}],nil:false,halted:false,reading:null,operation:'stock := map[string]int{"A":0, "C":8}',detail:'A 已登记且售罄；B 尚未登记。先选择商品，分别预测 value 与 ok。'}; }
export function read(entries: Entry[], nil: boolean, key: string): Reading { const row = nil ? undefined : entries.find(e => e.key === key); return {key,value:row?.value ?? 0,ok:row !== undefined}; }
export function transition(state: State, action: Action): State {
  if (action.type === 'nil') return {...state,entries:[],nil:true,halted:false,reading:null,operation:'stock = nil',detail:'丢弃当前账本引用；nil map 没有记录。可以读取或 delete，但不能写入。'};
  if (action.type === 'make') return {...state,entries:[],nil:false,halted:false,reading:null,operation:'stock = make(map[string]int)',detail:state.halted ? '教学重启：修改程序，先 make 再重新尝试写入；不是 panic 后自动继续执行。新账本为空。' : 'make 建立新的空账本；原记录不复制。现在可以写入。'};
  if (state.halted) return state;
  if (action.type === 'read') { const reading = read(state.entries,state.nil,action.key); return {...state,reading,operation:`value, ok := stock[${JSON.stringify(action.key)}]`,detail:reading.ok ? `找到记录：value=${reading.value} 来自账本，ok=true。值为零也不代表缺失。` : '没有记录：value=0 来自 int 零值，ok=false。读取没有插入记录。'}; }
  if (action.type === 'delete') return {...state,entries:state.entries.filter(e => e.key !== action.key),reading:null,operation:`delete(stock, ${JSON.stringify(action.key)})`,detail:state.entries.some(e=>e.key===action.key) ? '记录已删除。再次读取将得到 0、false。' : '不存在的键或 nil map：delete 合法，无记录变化。'};
  if (!Number.isSafeInteger(action.value)) throw new Error('库存必须是安全整数');
  if (state.nil) return {...state,halted:true,reading:null,operation:`stock[${JSON.stringify(action.key)}] = ${action.value}`,detail:'panic: assignment to entry in nil map。写入失败，账本仍为 nil；先修复初始化再重试。'};
  const existed = state.entries.some(e => e.key === action.key);
  return {...state,entries:existed ? state.entries.map(e => e.key === action.key ? {...e,value:action.value} : e) : [...state.entries,{key:action.key,value:action.value}],reading:null,operation:`stock[${JSON.stringify(action.key)}] = ${action.value}`,detail:`${existed?'更新已有':'新增'}记录为 ${action.value}；存在性为 true，包括写入 0。请再次读取验证。`};
}
export const transferCases = [
  {code:'quota := map[string]int{"guest":0, "member":6}\nv, ok := quota["visitor"]',entries:[{key:'guest',value:0},{key:'member',value:6}],nil:false,key:'visitor'},
  {code:'quota := map[string]int{"guest":0, "member":6}\nv, ok := quota["guest"]',entries:[{key:'guest',value:0},{key:'member',value:6}],nil:false,key:'guest'},
  {code:'var quota map[string]int\ndelete(quota, "member")\nv, ok := quota["member"]',entries:[],nil:true,key:'member'},
];
