export type Fault = 'database' | 'deadlock' | 'slow';
export type Config = {fault:Fault;liveness:'dependency'|'process';readiness:'dependency'|'degraded';startup:boolean;threshold:number};
export const baseline:Config={fault:'database',liveness:'dependency',readiness:'dependency',startup:false,threshold:2};
export type Snapshot={tick:number;boot:number;locked:boolean;startupDone:boolean;liveFailures:number;readyFailures:number;startupFailures:number;restarts:number;withdrawals:number;degradedTicks:number;ready:boolean;database:boolean;live:string;readiness:string;startup:string;action:string;reason:string};
export function initial(c:Config):Snapshot{return {tick:0,boot:c.fault==='slow'?4:0,locked:c.fault==='deadlock',startupDone:!c.startup,liveFailures:0,readyFailures:0,startupFailures:0,restarts:0,withdrawals:0,degradedTicks:0,ready:c.fault!=='slow',database:c.fault!=='database',live:'待采样',readiness:'待采样',startup:c.startup?'待检查':'未启用',action:'等待探针采样',reason:'每一步经过一个 5 秒探针周期；先观察信号，再依据连续失败阈值执行动作。'};}
export function step(c:Config,previous:Snapshot):Snapshot{
 const s={...previous,tick:previous.tick+1};s.database=c.fault!=='database'||s.tick>6;s.action='保留流量';
 const running=s.boot===0&&!s.locked;
 const remove=()=>{if(s.ready)s.withdrawals++;s.ready=false;};
 const restart=(why:string)=>{s.restarts++;remove();s.boot=c.fault==='slow'?4:1;s.locked=false;s.liveFailures=0;s.readyFailures=0;s.startupFailures=0;s.startupDone=!c.startup;s.action='重启并撤流';s.reason=why+'；重启无法改变外部数据库状态，新的进程需要重新初始化。';};
 if(c.startup&&!s.startupDone){
  if(running){s.startupDone=true;s.startup='成功：释放运行期探针';s.startupFailures=0;}
  else{s.startupFailures++;s.startup=`启动失败 ${s.startupFailures}/6`;s.live='startup 保护中：未采样';s.readiness='startup 保护中：未采样';remove();s.action='等待启动';s.reason='启动探针尚未成功，存活与就绪探针暂不运行；启动预算为 6 个周期。';if(s.startupFailures>=6)restart('startup 连续失败达到 6 次，启动预算耗尽');else s.boot=Math.max(0,s.boot-1);return s;}
 }else s.startup=c.startup?'已成功，不再采样':'未启用';
 const alive=running&&(c.liveness==='process'||s.database);
 s.liveFailures=alive?0:s.liveFailures+1;s.live=alive?'通过':`失败 ${s.liveFailures}/${c.threshold}`;
 const canServe=running&&(s.database||c.readiness==='degraded');
 s.readyFailures=canServe?0:s.readyFailures+1;s.readiness=canServe?'通过':`失败 ${s.readyFailures}/${c.threshold}`;
 if(!alive&&s.liveFailures>=c.threshold){restart(running?'进程健康，但数据库 Ping 被误用为存活判据，触发重启':'进程未能提供内部健康响应，连续存活失败达到阈值');return s;}
 if(canServe){s.ready=true;if(!s.database){s.degradedTicks++;s.action='保留降级流量';s.reason='内部进程健康，缓存可提供允许的只读降级服务；依赖故障不触发重启。';}else{s.action='正常接流量';s.reason='内部健康与接单能力均满足，连续失败计数清零。';}}
 else if(s.readyFailures>=c.threshold){remove();s.action='撤流，保留进程';s.reason='readiness 达到失败阈值，仅移出服务端点；liveness 尚未达到重启条件。';}
 else{s.action=s.ready?'阈值内暂保留流量':'继续等待就绪';s.reason=`接单能力失败 ${s.readyFailures} 次，尚未达到 ${c.threshold} 次阈值；此窗口内保留的流量仍可能失败。`;}
 s.boot=Math.max(0,s.boot-1);return s;
}
export function simulate(c:Config,count=10){const trace=[initial(c)];for(let i=0;i<count;i++)trace.push(step(c,trace.at(-1)!));return trace;}
