export type Action = 'unready'|'shutdown'|'waitHttp'|'cancel'|'waitWorker'|'close'|'exit'|'tick'|'arrival';
export const labels: Record<Action,string> = {unready:'撤销就绪',shutdown:'开始 HTTP Shutdown',waitHttp:'等待在途请求',cancel:'通知后台取消',waitWorker:'等待后台回收',close:'关闭数据库',exit:'结束进程',tick:'让系统运行一秒',arrival:'注入两个到达请求'};
export const safePlan:Action[]=['unready','shutdown','waitHttp','cancel','waitWorker','close','exit'];
export const brokenPlan:Action[]=['close','shutdown','waitHttp','cancel','exit'];
export type State = {time:number;deadline:number;ready:boolean;accepting:boolean;http:number;completed:number;failed:number;accepted:number;rejected:number;worker:'running'|'cleaning'|'stopped'|'failed';cleanup:number;joined:boolean;db:boolean;exited:boolean;forced:boolean;recovery:number;note:string;events:string[]};
export function initialState(deadline=14,http=3,cleanup=2):State{return {time:0,deadline,ready:true,accepting:true,http,completed:0,failed:0,accepted:0,rejected:0,worker:'running',cleanup,joined:false,db:true,exited:false,forced:false,recovery:0,note:`退出信号已到达。${http} 个请求仍在处理，自建 worker 还在使用数据库，取消后清理需 ${cleanup} 秒。`,events:[]};}
export function transition(s:State,action:Action):State{
 if(s.exited)return s;
 const n={...s,events:[...s.events]};let note=labels[action]+'：';
 if(action==='unready'){n.ready=false;note+='就绪变为否；流量传播有延迟，还需停止监听。';}
 if(action==='shutdown'){n.accepting=false;note+='监听停止，等待 HTTP 在途；自建 worker 不在等待范围内。';}
 if(action==='cancel'&&n.worker==='running'){n.worker='cleaning';note+='已发送取消通知；worker 仍需清理，尚未退出。';}
 if(action==='arrival'){if(n.accepting){n.http+=2;n.accepted+=2;note+=n.ready?'仍处于就绪并监听，接入 2 个新请求。':'就绪已撤销，但模拟流量传播延迟，监听仍接入 2 个新请求。';}else{n.rejected+=2;note+='监听已停止，拒绝接入 2 个请求，它们没有进入本进程在途。';}}
 if(action==='close'){n.db=false;note+='数据库已关闭。';}
 if(action==='exit'){
  n.exited=true;n.failed+=n.http;n.recovery+=n.http+((n.worker==='running'||n.worker==='cleaning')?1:0);n.http=0;
  note+=n.recovery?`提前退出，中断 ${n.recovery} 项工作，需恢复核对。`:!n.ready&&!n.accepting&&n.joined&&!n.db&&n.worker==='stopped'&&n.failed===0?'所有依赖已释放，协调退出完成。':n.ready||n.accepting?'进程结束，但尚未撤就绪或停止接收，仍可能被分配流量；退出协调不完整。':'进程结束，但存在请求失败、后台未正常回收或资源未关闭，退出协调不完整。';
 }else{
  n.time++;
  if(n.http>0){if(!n.db){n.failed+=n.http;note+=` ${n.http} 个请求访问已关闭数据库而失败。`;n.http=0;}else{n.http--;n.completed++;}}
  if(n.worker==='running'&&!n.db){n.worker='failed';n.recovery++;note+=' 后台访问已关闭数据库而失败。';}
  if(n.worker==='cleaning'){
   if(!n.db){n.worker='failed';n.recovery++;note+=' 后台清理需要数据库，资源后用失败。';}
   else if(action!=='cancel'){n.cleanup--;if(n.cleanup<=0)n.worker='stopped';}
  }
  if(action==='waitWorker'){if(n.worker==='stopped'||n.worker==='failed'){n.joined=true;note+='已收到 worker 结束确认。';}else note+='仍在等待；cancel 才是停止通知，wait 本身不取消。';}
  if(action==='waitHttp')note+=n.http===0?'HTTP 在途归零；后台仍需应用自行回收。':`还有 ${n.http} 个 HTTP 在途。`;
  if(action==='tick')note+='在途继续执行；通知取消后后台才推进清理。';
  if(n.time>=n.deadline){n.forced=true;n.exited=true;n.failed+=n.http;n.recovery+=n.http+((n.worker==='running'||n.worker==='cleaning')?1:0);n.http=0;note+=` 总期限 ${n.deadline} 秒耗尽，硬退出；${n.recovery} 项未完成工作需核对或恢复，不算成功。`;}
 }
 n.note=note;n.events.push(`${n.time}s ${note}`);return n;
}
export function actionDone(s:State,a:Action){return a==='waitHttp'?s.http===0:a==='waitWorker'?s.joined:true;}
export function runPlan(plan:Action[],initial=initialState()){let s=initial;for(const a of plan){for(let k=0;k<100;k++){s=transition(s,a);if(s.exited||actionDone(s,a))break;}if(s.exited)break;}return s;}


