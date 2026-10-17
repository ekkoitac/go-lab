export type Strategy = 'cas' | 'blind';
export type Repair = 'merge' | 'relabel';
export type Actor = 'a' | 'b';
export interface Record132 {stock: number; note: string; version: number}
export interface Draft132 {read: Record132; draft: Record132; rows: number | null}
export interface State132 {strategy: Strategy; repair: Repair; first: Actor; stage: number; db: Record132; a: Draft132 | null; b: Draft132 | null; log: string[]; initialStock: number; nextStock: number; nextNote: string}
export function initial132(strategy: Strategy = 'cas', first: Actor = 'a', initialStock = 10, nextStock = 20, nextNote = '避光存放'): State132 {
  return {strategy,repair:'merge',first,stage:0,db:{stock:initialStock,note:'常温存放',version:7},a:null,b:null,log:[],initialStock,nextStock,nextNote};
}
export function write132(db: Record132, draft: Record132, strategy: Strategy): {db: Record132; rows: number} {
  if(strategy==='cas' && draft.version!==db.version) return {db,rows:0};
  return {db:{...draft,version:db.version+1},rows:1};
}
export function next132(state: State132): State132 {
  if(state.stage>=4) return state;
  const s:State132={...state,db:{...state.db},a:state.a?{...state.a,read:{...state.a.read},draft:{...state.a.draft}}:null,b:state.b?{...state.b,read:{...state.b.read},draft:{...state.b.draft}}:null,log:[...state.log]};
  if(s.stage===0){
    s.a={read:{...s.db},draft:{...s.db,stock:s.nextStock},rows:null};
    s.b={read:{...s.db},draft:{...s.db,note:s.nextNote},rows:null};
    s.log.push('甲、乙分别读取 v7；甲只想改库存，乙只想改说明。两份草稿都携带完整记录。');
  } else if(s.stage===1 || s.stage===2){
    const actor=s.stage===1?s.first:(s.first==='a'?'b':'a');
    const d=s[actor]!;const result=write132(s.db,d.draft,s.strategy);s.db=result.db;d.rows=result.rows;
    s.log.push(`${actor==='a'?'甲':'乙'}提交：草稿 v${d.draft.version}，影响 ${result.rows} 行。${result.rows===0?'条件不匹配，记录保持原值；必须报告冲突。':s.strategy==='blind'?'无条件覆盖整条记录，未核对版本。':'比较版本、写值与版本递增是一次原子更新。'}`);
  } else {
    const actor=s.first==='a'?'b':'a'; const d=s[actor]!;
    if(d.rows!==0){s.stage=4;s.log.push('没有被拒绝的提交。对照最终两项值，检查较早的修改是否丢失。');return s;}
    d.read={...s.db};
    d.draft=s.repair==='merge'?{...s.db,...(actor==='a'?{stock:s.nextStock}:{note:s.nextNote})}:{...d.draft,version:s.db.version};
    const result=write132(s.db,d.draft,'cas');s.db=result.db;d.rows=result.rows;
    s.log.push(s.repair==='merge'?'重读整条最新记录，只合并自己的修改，再条件更新：两人的修改都保留。':'只把旧草稿换成最新版本号：条件通过，但旧字段覆盖了他人的修改。');
  }
  s.stage++;return s;
}
export function preserved132(s: State132): boolean {return s.db.stock===s.nextStock && s.db.note===s.nextNote;}