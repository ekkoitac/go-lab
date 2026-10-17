export type Strategy = 'replica' | 'primary' | 'wait-primary' | 'wait-fail' | 'sleep' | 'sticky';
export type Outcome = 'fresh' | 'stale' | 'failed';
export interface Config { strategy: Strategy; delay: number; budget: number; readAt: number; window: number; request: 'detail' | 'list' }
export interface Snapshot { time: number; primary: number; replica: number; token: number | null; phase: 'setup' | 'committed' | 'routed' | 'done'; route: 'none' | 'primary' | 'replica' | 'waiting'; outcome: Outcome | null; returned: number | null; note: string }
export const baseline: Config = {strategy:'replica',delay:2000,budget:1000,readAt:100,window:1000,request:'detail'};
export const strategyNames: Record<Strategy,string> = {replica:'立即读副本',primary:'写后读主库','wait-primary':'等位点，超时回主库','wait-fail':'等位点，超时明确失败',sleep:'固定 sleep 后读副本',sticky:'固定窗口粘主'};
// One write commits at t=0. Replica applies it atomically at delay. Reads and primary access have zero latency in this model.
export function trace(config: Config): Snapshot[] {
  const c = {...config, delay:Math.max(0,config.delay),budget:Math.max(0,config.budget),readAt:Math.max(0,config.readAt),window:Math.max(0,config.window)};
  const replica = (time:number)=>time >= c.delay ? 9 : 8;
  const setup: Snapshot = {time:0,primary:8,replica:8,token:null,phase:'setup',route:'none',outcome:null,returned:null,note:'昵称当前为 v8。准备把昵称保存为 v9。'};
  const commit: Snapshot = {...setup,primary:9,replica:replica(0),token:9,phase:'committed',note:`主库提交 v9；客户端得到写后位点 9。副本将在 t=${c.delay}ms 应用。`};
  const strategy = c.request === 'list' ? 'replica' : c.strategy;
  let route: Snapshot['route'] = strategy === 'primary' || (strategy === 'sticky' && c.readAt < c.window) ? 'primary' : 'replica';
  if ((strategy === 'wait-primary' || strategy === 'wait-fail') && replica(c.readAt)<9) route='waiting';
  if (strategy === 'sleep') route='waiting';
  const routed:Snapshot = {...commit,time:c.readAt,replica:replica(c.readAt),phase:'routed',route,note:c.request==='list'?'普通列表允许短时陈旧，直接路由副本。':route==='waiting'?`详情要求至少位点 9；${strategy==='sleep'?`固定等待 ${c.window}ms（不检查位点）`:`最多等 ${c.budget}ms，并检查副本位点`}。`:`详情请求到达，路由${route==='primary'?'主库':'副本'}。`};
  let time=c.readAt;
  let failed=false;
  if(strategy==='sleep'){time+=c.window;route='replica';}
  if(strategy==='wait-primary'||strategy==='wait-fail'){
    time=Math.max(c.readAt,Math.min(c.delay,c.readAt+c.budget));
    if(replica(time)>=9) route='replica';
    else if(strategy==='wait-primary') route='primary';
    else {failed=true;route='none';}
  }
  const returned=failed?null:route==='primary'?9:replica(time);
  const outcome:Outcome=failed?'failed':returned===9?'fresh':'stale';
  const source=route==='primary'?'主库':'副本';
  const note=failed?`等待预算用尽：副本位点 ${replica(time)} < 9，明确返回失败，没有返回旧值。`:`${source}在 t=${time}ms 返回 v${returned}。${outcome==='fresh'?'本次读到了自己的新写入。':c.request==='list'?'列表允许短时陈旧；本次旧值符合列表承诺。':'详情读到旧昵称，违背读己之写承诺。'}${strategy==='wait-primary'&&route==='primary'?' 位点未追上，超时回主库。':''}`;
  return [setup,commit,routed,{...routed,time,replica:replica(time),phase:'done',route,returned,outcome,note}];
}
export function contractMet(config:Config,result:Snapshot){return result.outcome!==null&&(result.outcome==='fresh'||result.outcome==='failed'||config.request==='list');}
