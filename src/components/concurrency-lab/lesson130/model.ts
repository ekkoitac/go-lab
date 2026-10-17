export type Strategy = 'request' | 'without' | 'bounded' | 'background';
export type Status = 'running' | 'canceling' | 'completed' | 'stopped' | 'lost';
export interface Config { strategy: Strategy; duration: number; shutdownAt: number; owner: boolean; wait: boolean; crash: boolean }
export interface State { time: number; status: Status; requestCanceled: boolean; deadline: number | null; value: string | null; cancelAt: number | null; reason: string; service: 'serving' | 'waiting' | 'exited' | 'crashed'; log: string[] }
export const defaults: Config = {strategy:'request', duration:600, shutdownAt:800, owner:true, wait:true, crash:false};
export const labels: Record<Status,string> = {running:'运行中',canceling:'收到取消，等待清理',completed:'汇总完成',stopped:'清理完成，已返回',lost:'进程退出，工作丢失'};
export function initial(c: Config): State {return {time:0,status:'running',requestCanceled:false,deadline:c.strategy==='request'?400:c.strategy==='bounded'?1000:null,value:c.strategy==='background'?null:'req-7',cancelAt:null,reason:'辅助汇总已启动；请求将在 200ms 结束。',service:'serving',log:['0ms：启动辅助汇总']};}
export function step(s: State,c: Config): State {
  if(s.time>=2000 || s.service==='exited' || s.service==='crashed') return s;
  const n:State={...s,time:s.time+200,log:[...s.log]};
  const record=(message:string)=>{n.reason=message;n.log.push(`${n.time}ms：${message}`);};
  const terminal=()=>n.status==='completed'||n.status==='stopped';
  const cancel=(reason:string)=>{if(n.status==='running'){n.status='canceling';n.cancelAt=n.time;record(`${reason}；已发出取消通知，任务尚未返回。`);}};
  if(n.time===200){n.requestCanceled=true;record('请求结束，取消请求 context。');if(c.strategy==='request')cancel('继承请求取消');else record('请求结束；当前上下文不继承请求取消，汇总继续。');}
  if(c.crash&&n.time===600){n.service='crashed';if(!terminal())n.status='lost';record('进程崩溃：没有执行退出等待；未完成的内存任务丢失。');return n;}
  if(s.status==='canceling' && s.cancelAt!==null && n.time>=s.cancelAt+200){n.status='stopped';record('任务观察取消，清理资源并返回；现在才可以确认完成等待。');}
  if(n.status==='running' && n.deadline!==null && n.time>=n.deadline)cancel('独立或继承的 deadline 到达');
  if(n.status==='running' && n.time>=c.duration){n.status='completed';record('辅助汇总完成并返回，释放计时器等资源。');}
  if(n.time===c.shutdownAt){
    if(c.owner){cancel('服务所有者调用 cancel');n.service=c.wait&&!terminal()?'waiting':'exited';record(n.service==='waiting'?'服务已发出取消，正在等待任务返回。':'服务退出。');}
    else {n.service='exited';record('没有登记任务所有者，服务直接退出。');}
    if(n.service==='exited'&&!terminal()){n.status='lost';record('服务未等到任务返回就退出；剩余工作丢失。');}
  }
  if(n.service==='waiting'&&terminal()){n.service='exited';record('完成等待已解除，服务可以退出。');}
  if(n.reason===s.reason)record(n.status==='running'?'汇总继续运行。':`任务保持「${labels[n.status]}」。`);
  return n;
}
export function run(c:Config){const states=[initial(c)];while(states.length<12){const next=step(states[states.length-1],c);if(next===states[states.length-1])break;states.push(next);}return states;}
