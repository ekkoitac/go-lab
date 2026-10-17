export type Config = { traffic:number; bounded:boolean; budget:number; business:'catalogue'|'authority'; stalePercent:number; warm:number };
export type State = { tick:number; phase:'normal'|'outage'|'recovery'; hitPercent:number; cache:number; demand:number; online:number; warm:number; stale:number; rejected:number; dbTotal:number; overloaded:boolean; filled:number; note:string };
export const capacity=3000;
export const defaults:Config={traffic:100000,bounded:false,budget:2500,business:'catalogue',stalePercent:80,warm:500};
export function flow(config:Config,phase:State['phase'],hitPercent:number,tick=0,filled=0):State{
  const traffic=Math.max(0,Math.floor(config.traffic));
  const cache=Math.floor(traffic*Math.min(100,Math.max(0,hitPercent))/100);
  const demand=traffic-cache;
  const warmDemand=phase==='recovery'?Math.min(config.warm,Math.max(0,99000-filled)):0;
  const limit=config.bounded?Math.max(0,config.budget):Infinity;
  // Online requests take priority. Warming uses only the remaining shared budget.
  const online=Math.min(demand,limit);
  const warm=Math.min(warmDemand,Math.max(0,limit-online));
  const overflow=demand-online;
  const stale=config.business==='catalogue'?Math.floor(overflow*config.stalePercent/100):0;
  const rejected=overflow-stale;
  const dbTotal=online+warm,overloaded=dbTotal>capacity;
  return {tick,phase,hitPercent,cache,demand,online,warm,stale,rejected,dbTotal,overloaded,filled,note:phase==='normal'?`99% 命中使 ${traffic} QPS 中的 ${demand} QPS 需要回源；实际准入 ${online} QPS。`:overloaded?'数据库入流超过容量：请求已进入数据库，不能再算作入口快速拒绝。':phase==='outage'?'缓存断开；准入门把超额请求分到业务允许的陈旧副本或快速拒绝。':'缓存已连通但仍需填充；在线回源优先，预热只能用同一预算的剩余额度。'};
}
export function inspect(config:Config,step:number):State{
  if(step===0)return flow(config,'normal',99);
  if(step===1)return flow(config,'outage',0,1);
  let filled=0,s=flow(config,'recovery',0,2,filled);
  const seconds=Math.max(0,step-2)*10;
  for(let i=0;i<seconds;i++){
    // Pedagogical inventory: each completed source read fills one distinct cold key.
    // Overload freezes successful completion; this is not a measured throughput curve.
    if(!s.overloaded)filled=Math.min(99000,filled+s.online+s.warm);
    s=flow(config,'recovery',filled/1000,3+i,filled);
  }
  return s;
}
export function targetMet(s:State){return !s.overloaded&&s.dbTotal<=capacity;}
export function advance(step:number){return Math.min(8,step+1);}
export function back(step:number){return Math.max(0,step-1);}
export function stageLabel(step:number){return step===0?'正常缓存基线':step===1?'Redis 故障':step===2?'Redis 恢复，缓存仍空':`恢复后 ${(step-2)*10} 秒`;}
