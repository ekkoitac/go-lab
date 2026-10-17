export type Mode = 'Closed' | 'Open' | 'Half-open';
export type Outcome = 'success' | 'fault' | 'business';
export type Config = {countBusiness: boolean; probeLimit: number; cooldown: number; threshold: number};
export const baseline: Config = {countBusiness:false,probeLimit:2,cooldown:3,threshold:2};
export type State = {mode:Mode; now:number; until:number; failures:number; successes:number; epoch:number; nextId:number; pending:{id:number;epoch:number;probe:boolean}[]; admitted:number; rejected:number; reason:string; event:string};
export type Action = {type:'send'} | {type:'tick'} | {type:'complete';outcome:Outcome};
export function initial():State{return {mode:'Closed',now:0,until:0,failures:0,successes:0,epoch:0,nextId:1,pending:[],admitted:0,rejected:0,reason:'尚无健康证据。连续 2 次依赖故障触发打开。',event:'初始状态'};}
export function transition(previous:State,action:Action,c:Config=baseline):State{
 const s:State={...previous,pending:previous.pending.map(p=>({...p}))};
 const open=()=>{s.mode='Open';s.until=s.now+c.cooldown;s.successes=0;s.epoch++;};
 if(action.type==='tick'){s.now++;s.event='时钟推进 1 秒';s.reason=s.mode==='Open'?(s.now>=s.until?'冷却结束；仍保持 Open，下一次请求才进入 Half-open。':`还需冷却 ${s.until-s.now} 秒，普通请求快速拒绝。`):'时间经过不会凭空增加成功证据。';return s;}
 if(action.type==='send'){
  s.event='提交一个请求';
  if(s.mode==='Open'&&s.now<s.until){s.rejected++;s.reason=`冷却尚余 ${s.until-s.now} 秒，请求快速降级，不触达依赖。`;return s;}
  if(s.mode==='Open'){s.mode='Half-open';s.epoch++;s.successes=0;}
  const probes=s.pending.filter(p=>p.epoch===s.epoch&&p.probe).length;
  if(s.mode==='Half-open'&&probes>=c.probeLimit){s.rejected++;s.reason=`已有 ${probes} 个探测在途，达到半开并发上限 ${c.probeLimit}，本次降级。`;return s;}
  s.pending.push({id:s.nextId++,epoch:s.epoch,probe:s.mode==='Half-open'});s.admitted++;s.reason=s.mode==='Half-open'?'获得一个半开探测名额；只有返回结果才产生健康证据。':'Closed 放行调用；超时与隔离仍应由调用层负责。';return s;
 }
 s.event=`完成最早请求：${action.outcome==='fault'?'依赖故障':action.outcome==='business'?'业务拒绝':'成功'}`;
 const p=s.pending.shift();if(!p){s.reason='没有在途请求，先提交请求再返回结果。';return s;}
 if(p.epoch!==s.epoch){s.reason=`请求 #${p.id} 属于旧状态周期，迟到结果不改变当前熔断决策。`;return s;}
 const failed=action.outcome==='fault'||(action.outcome==='business'&&c.countBusiness);
 if(failed){s.failures++;if(s.mode==='Half-open'||s.failures>=c.threshold){open();s.reason=`${action.outcome==='business'?'错误分类把业务拒绝算作故障':'依赖故障证据'}触发 Open；冷却到 ${s.until} 秒后再尝试。`;}else s.reason=`故障计数 ${s.failures}/${c.threshold}，未达到打开阈值。`;return s;}
 if(action.outcome==='business'){s.reason='业务拒绝不计依赖故障，也不充当恢复成功证据；探测名额已释放。';return s;}
 if(s.mode==='Half-open'){s.successes++;if(s.successes>=2){s.mode='Closed';s.failures=0;s.epoch++;s.reason='累计 2 次成功探测，关闭熔断器；后续放量仍需容量控制。';}else s.reason=`成功探测 ${s.successes}/2，保留 Half-open，继续收集恢复证据。`;}
 else {s.failures=0;s.reason='成功响应使连续故障计数归零。';}return s;
}
export function run(actions:Action[],c:Config=baseline):State[]{return actions.reduce<State[]>((states,a)=>[...states,transition(states.at(-1)!,a,c)],[initial()]);}
export const opening:Action[]=[{type:'send'},{type:'complete',outcome:'fault'},{type:'send'},{type:'complete',outcome:'fault'}];
export const recovery:Action[]=[...opening,{type:'send'},{type:'tick'},{type:'tick'},{type:'tick'},{type:'send'},{type:'send'},{type:'send'},{type:'complete',outcome:'success'},{type:'complete',outcome:'success'}];
