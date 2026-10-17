export type Config = {strategy:'cancel'|'drain'; cleanup:number; budget:number; wait:boolean};
export type State = Config & {phase:'running'|'stopped'|'waiting'|'boundary'|'confirmed'|'ended'; elapsed:number; gateOpen:boolean; cancelled:boolean; done:boolean; worker:'active'|'draining'|'cleaning'|'done'|'terminated'; outcome:null|'complete'|'timeout'|'abrupt'; externalCommitted:boolean; reason:string};
export const baseline:Config={strategy:'cancel',cleanup:2,budget:5,wait:true};
export const requiredTicks=(s:Config)=>(s.strategy==='cancel'?1:2)+s.cleanup;
export function initial(config:Config=baseline):State {return {...config,phase:'running',elapsed:0,gateOpen:true,cancelled:false,done:false,worker:'active',outcome:null,externalCommitted:true,reason:'已有 1 项订单任务，外部订单已提交；本地清理尚未开始。停止入口后才启动退出预算。'};}
export function advance(s:State, choice?:'complete'|'timeout'):State {
  if(s.phase==='ended')return s;
  if(s.phase==='running')return {...s,phase:'stopped',gateOpen:false,reason:'入口已关闭：新订单被拒绝，已有订单仍需处理。下一步选择的退出策略才通知 worker。'};
  if(s.phase==='stopped')return {...s,phase:'waiting',cancelled:s.strategy==='cancel',worker:s.strategy==='cancel'?'active':'draining',reason:s.strategy==='cancel'?'cancel 已发出，但 worker 还未观察到通知；done 仍未关闭。':'开始排空：不发送取消，已有工作继续完成；新订单无法加入。'};
  if(s.phase==='boundary') {
    if(!choice)return s;
    return {...s,phase:choice==='complete'?'confirmed':'ended',outcome:choice,reason:choice==='complete'?'本次合法路径选择 done 分支：清理已完成，确认后 main 可以返回。':'本次合法路径选择超时分支：timer 与 done 同时就绪，select 不保证 done 优先；本例清理恰好已完成。'};
  }
  if(s.phase==='confirmed')return {...s,phase:'ended',reason:'已观察 done 后 main 返回：整个进程终止。外部已提交订单仍保留，取消没有回滚它。'};
  if(!s.wait)return {...s,phase:'ended',worker:'terminated',outcome:'abrupt',reason:'main 立即返回，进程结束；worker 没有自动等到清理完成。已提交的外部订单仍在，可能需要补偿或恢复。'};
  const elapsed=s.elapsed+1;
  const done=elapsed>=requiredTicks(s);
  const worker=done?'done':elapsed>=(s.strategy==='cancel'?1:2)?'cleaning':'draining';
  if(done && elapsed===s.budget)return {...s,elapsed,done,worker,phase:'boundary',reason:'done 与预算计时器在本模型同一刻就绪。两条 select 分支都合法，请选择一条路径观察，不能认定 done 优先。'};
  if(done)return {...s,elapsed,done,worker,phase:'confirmed',outcome:'complete',reason:'worker 已完成清理并关闭 done；等待方观察到完成，才能确认收尾成功。'};
  if(elapsed>=s.budget)return {...s,elapsed,done,worker:'terminated',phase:'ended',outcome:'timeout',reason:`预算 ${s.budget} 格耗尽，清理尚未完成。报告未完成任务后执行本例兜底：main 返回终止进程，外部订单没有回滚。`};
  return {...s,elapsed,worker,reason:worker==='cleaning'?`清理进行中：已用 ${elapsed} 格，需要总计 ${requiredTicks(s)} 格；cancel 不会跳过清理等待。`:'排空已有工作：未完成的工作仍占用时间预算。'};
}
export function finish(config:Config,choice:'complete'|'timeout'='complete'):State {let s=initial(config);for(let i=0;i<30 && s.phase!=='ended';i++)s=advance(s,choice);return s;}
