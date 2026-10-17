export type Policy = 'shared' | 'routes' | 'isolated';
export type Job = {id:string; kind:'order'|'report'; remaining:number};
export type State = {tick:number; policy:Policy; orderBudget:number; total:number; queue:Job[]; active:Job[]; done:Job[]; orderWait:number; reportWait:number; note:string; scenario:'burst'|'reports'};
export type Action = {type:'step'} | {type:'policy';policy:Policy} | {type:'budget';value:number};
export function initialState(policy:Policy='shared', orderBudget=4, scenario:State['scenario']='burst'):State {
  return {tick:0,policy,orderBudget:Math.min(5,Math.max(1,Math.round(orderBudget))),total:6,queue:Array.from({length:6},(_,i)=>({id:`R${i+1}`,kind:'report' as const,remaining:4})),active:[],done:[],orderWait:0,reportWait:0,scenario,note:'6 个慢报表先到达。单步先分配连接；下一拍 3 个订单到达。'};
}
export function transition(s:State,a:Action):State {
  if(a.type==='policy')return {...s,policy:a.policy,note:a.policy==='isolated'?'已为后续获取连接启用配额；已持有连接的报表不会被强杀，要等它们完成释放。':'入口改变不释放连接；共享池仍按先来先服务。'};
  if(a.type==='budget')return {...s,orderBudget:Number.isFinite(a.value)?Math.min(5,Math.max(1,Math.round(a.value))):s.orderBudget,note:'总预算固定为 6。调整只影响后续获取，已有任务继续运行，超出新配额的池会先排空。'};
  const progressed=s.active.map(j=>({...j,remaining:j.remaining-1}));
  const released=progressed.filter(j=>j.remaining<=0);
  const active=progressed.filter(j=>j.remaining>0);
  let queue=s.queue.map(j=>({...j}));
  if(s.tick===1&&s.scenario==='burst')queue.push(...Array.from({length:3},(_,i)=>({id:`O${i+1}`,kind:'order' as const,remaining:1})));
  const admitted:Job[]=[];
  for(const job of queue){
    const used=active.filter(j=>j.kind===job.kind).length;
    const cap=job.kind==='order'?s.orderBudget:s.total-s.orderBudget;
    if(active.length<s.total&&(s.policy!=='isolated'||used<cap)){active.push(job);admitted.push(job);}
  }
  queue=queue.filter(j=>!admitted.some(a=>a.id===j.id));
  const orders=queue.filter(j=>j.kind==='order').length, reports=queue.length-orders;
  return {...s,tick:s.tick+1,queue,active,done:[...s.done,...released],orderWait:s.orderWait+orders,reportWait:s.reportWait+reports,note:`第 ${s.tick+1} 拍：释放 ${released.map(j=>j.id).join('、')||'无'}；获取 ${admitted.map(j=>j.id).join('、')||'无'}。订单等候 ${orders}，报表等候 ${reports}。${orders&&active.length===s.total?'连接已满，订单尚未执行 SQL。':s.policy==='isolated'&&reports&&active.length<s.total?'订单预留连接空闲，报表仍不能借用。':'任务完成后才归还连接。'}`};
}
export function run(s:State,n:number){for(let i=0;i<n;i++)s=transition(s,{type:'step'});return s;}
export function metrics(s:State){return {orders:s.done.filter(j=>j.kind==='order').length,reports:s.done.filter(j=>j.kind==='report').length,idle:s.total-s.active.length,orderQueued:s.queue.filter(j=>j.kind==='order').length,reportQueued:s.queue.filter(j=>j.kind==='report').length};}
