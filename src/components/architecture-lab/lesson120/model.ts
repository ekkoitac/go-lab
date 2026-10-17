export const ids = ['a','b','c'] as const;
export type Id = typeof ids[number];
export type Outcome = 'success'|'temporary'|'permanent';
export interface Config { outcomes: Record<Id,Outcome>; order: 'abc'|'cba'|'bac'; display: 'submitted'|'completed'; retry: 'items'|'whole'; idempotent: boolean; budget: number; recovers: boolean }
export interface ItemResult { id: Id; status: Outcome; attempt: number; effect: number; reused: boolean }
export interface Snapshot { config:Config; phase:'ready'|'executing'|'published'; round:number; queue:Id[]; submitted:Id[]; completed:ItemResult[]; latest:Partial<Record<Id,ItemResult>>; attempts:Record<Id,number>; effects:Record<Id,number>; saved:Partial<Record<Id,ItemResult>>; notice:string }
export interface State extends Snapshot { history:Snapshot[] }
export const defaults:Config={outcomes:{a:'success',b:'temporary',c:'success'},order:'cba',display:'submitted',retry:'whole',idempotent:false,budget:1,recovers:true};
export function initial(config:Config=defaults):State{return{config:{...config,outcomes:{...config.outcomes}},phase:'ready',round:0,queue:[],submitted:[],completed:[],latest:{},attempts:{a:0,b:0,c:0},effects:{a:0,b:0,c:0},saved:{},notice:'准备提交 a、b、c；完成顺序可以不同于结果排列。',history:[]};}
function commit(state:State,patch:Partial<Snapshot>):State{const{history,...snapshot}=state;return{...state,...patch,history:[...history,snapshot]};}
export function rewind(state:State):State{const previous=state.history.at(-1);return previous?{...previous,history:state.history.slice(0,-1)}:state;}
function ordered(state:State,items:readonly Id[]):Id[]{return [...state.config.order].filter(id=>items.includes(id as Id)) as Id[];}
export function candidates(state:State):Id[]{
 if(state.phase!=='published'||state.round>state.config.budget)return[];
 const recoverable=ids.filter(id=>state.latest[id]?.status==='temporary');
 return recoverable.length?(state.config.retry==='whole'?[...ids]:recoverable):[];
}
export function retry(state:State):State{const items=candidates(state);if(!items.length)return state;return commit(state,{phase:'executing',round:state.round+1,submitted:items,queue:ordered(state,items),completed:[],notice:state.config.retry==='whole'?'整批原样重发：成功项也被重送；若含永久失败，它仍不会恢复。这是待修复策略。':'只提交可恢复的失败项；成功与永久失败项不再执行。'});}
export function advance(state:State):State{
 if(state.phase==='published')return state;
 if(state.phase==='ready')return commit(state,{phase:'executing',round:1,submitted:[...ids],queue:ordered(state,ids),notice:'已按 a、b、c 提交；下面逐项展示模拟完成次序，不承诺真实并发调度。'});
 const id=state.queue[0];
 if(!id)return commit(state,{phase:'published',notice:'HTTP 200 表示批次响应成功送达。仍须按每项 ID 检查状态、错误类别及剩余重试预算。'});
 const attempt=state.attempts[id]+1;const old=state.saved[id];
 let result:ItemResult;let effects=state.effects;let saved=state.saved;
 if(state.config.idempotent&&old)result={...old,attempt,reused:true};
 else{
  const configured=state.config.outcomes[id];const status=configured==='temporary'&&state.config.recovers&&attempt>1?'success':configured;
  const effect=state.effects[id]+(status==='success'?1:0);result={id,status,attempt,effect,reused:false};effects={...effects,[id]:effect};if(status==='success'&&state.config.idempotent)saved={...saved,[id]:result};
 }
 return commit(state,{queue:state.queue.slice(1),completed:[...state.completed,result],latest:{...state.latest,[id]:result},attempts:{...state.attempts,[id]:attempt},effects,saved,notice:`项 ${id} 完成：${result.status}${result.reused?'，复用已存成功结果，无新增副作用':result.status==='success'?'，产生一次发送副作用':'，未产生发送副作用'}。`});
}
export function response(state:State):ItemResult[]{if(state.phase!=='published')return[];return state.config.display==='completed'?state.completed:state.submitted.map(id=>state.completed.find(row=>row.id===id)!);}
export function finish(state:State):State{while(state.phase!=='published')state=advance(state);return state;}
