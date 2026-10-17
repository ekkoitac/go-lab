export type CommitPolicy = 'atomic' | 'checkpoint-first' | 'data-first';
export type Phase = 'reading' | 'ready' | 'checkpoint-written' | 'data-written' | 'done' | 'crashed';
export type Lane = {name: string; batch: number; read: number; checkpoint: number; draft: number[]; persisted: number[]; phase: Phase; peak: number; replayed: number; commits: number; event: string};
export type ImportState = {total: number; batch: number; policy: CommitPolicy; idempotent: boolean; lanes: [Lane, Lane]};
export type Action = 'step' | 'crash' | 'restart';
const lane = (name: string, batch: number): Lane => ({name,batch,read:0,checkpoint:0,draft:[],persisted:[],phase:'reading',peak:0,replayed:0,commits:0,event:'尚未读取；已读位置与持久断点均为 0。'});
export function initialState(batch=3, policy:CommitPolicy='atomic',idempotent=true,total=8): ImportState {
  const size=Math.max(1,Math.min(total,Math.trunc(batch)));
  return {total,batch:size,policy,idempotent,lanes:[lane('全量数据事务',total),lane(`每批 ${size} 条`,size)]};
}
function writeData(s: Lane,idempotent: boolean): Lane {
  let persisted=[...s.persisted]; let replayed=s.replayed;
  for(const key of s.draft){if(persisted.includes(key)){replayed++;if(idempotent)continue;} persisted.push(key);}
  return {...s,persisted,replayed,commits:s.commits+1};
}
function finish(s:Lane,total:number): Lane {return {...s,draft:[],phase:s.read===total?'done':'reading'};}
function advance(s:Lane,total:number,policy:CommitPolicy,idempotent:boolean):Lane {
  if(s.phase==='crashed'||s.phase==='done')return s;
  if(s.phase==='reading'){
    const key=s.read+1, draft=[...s.draft,key];
    return {...s,read:key,draft,peak:Math.max(s.peak,draft.length),phase:draft.length===s.batch||key===total?'ready':'reading',event:`读取商品 K${key} 到事务草稿；持久断点仍是 ${s.checkpoint}。`};
  }
  if(s.phase==='ready'){
    if(policy==='checkpoint-first')return {...s,checkpoint:s.read,phase:'checkpoint-written',event:`断点先持久化到 ${s.read}，但本批数据还未提交。此处崩溃会跳过数据。`};
    if(policy==='data-first')return {...writeData(s,idempotent),phase:'data-written',event:`本批数据已提交，断点仍为 ${s.checkpoint}。此处崩溃会重放。`};
    return finish({...writeData(s,idempotent),checkpoint:s.read,event:`数据与断点 ${s.read} 在同一事务提交；现在允许这批数据可见。`},total);
  }
  if(s.phase==='checkpoint-written')return finish({...writeData(s,idempotent),event:'随后提交数据；两次提交之间仍存在故障窗口。'},total);
  return finish({...s,checkpoint:s.read,event:`随后写断点 ${s.read}；这次完成并不能消除之前的重放窗口。`},total);
}
export function transition(s:ImportState,action:Action):ImportState {
  return {...s,lanes:s.lanes.map(l=>{
    if(action==='step')return advance(l,s.total,s.policy,s.idempotent);
    if(action==='crash')return l.phase==='crashed'?l:{...l,draft:[],phase:'crashed' as const,event:`进程崩溃：草稿丢失；保留 ${l.persisted.length} 条持久记录和断点 ${l.checkpoint}。`};
    return l.phase!=='crashed'?l:{...l,read:l.checkpoint,phase:l.checkpoint===s.total?'done' as const:'reading' as const,event:`从已提交断点 ${l.checkpoint} 恢复，下一条为 ${l.checkpoint<s.total?`K${l.checkpoint+1}`:'无'}；不能使用崩溃前的已读位置。`};
  }) as [Lane,Lane]};
}
export function missingKeys(s:ImportState,l:Lane):number[]{return Array.from({length:l.checkpoint},(_,i)=>i+1).filter(k=>!l.persisted.includes(k));}
export function duplicates(l:Lane):number{return l.persisted.length-new Set(l.persisted).size;}
