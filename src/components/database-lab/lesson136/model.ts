export type Phase = 'start' | 'hotel' | 'pending' | 'unknown' | 'manual' | 'orphaned' | 'cancelled';
export type Outcome = 'success' | 'failure' | 'timeout-applied' | 'timeout-not-applied';
export type SagaState = {phase:Phase; durable:boolean; hotel:'free'|'held'|'released'; flight:'not-started'|'failed'; todo:'none'|'pending'|'unknown'|'manual'|'done'; attempts:number; sms:number; fee:number; releases:number; restarts:number; key:string; logs:string[]; message:string};
export function initialState(durable=true):SagaState{return {phase:'start',durable,hotel:'free',flight:'not-started',todo:'none',attempts:0,sms:0,fee:0,releases:0,restarts:0,key:'trip-136:release-hotel',logs:[],message:'先锁酒店，再让航班预订失败。每一步先预测外部状态。'};}
export function step(s:SagaState,outcome:Outcome='failure'):SagaState {
  const n:SagaState={...s,logs:[...s.logs]};
  const record=(message:string)=>{n.message=message;n.logs.push(message);return n;};
  if(s.phase==='start'){n.phase='hotel';n.hotel='held';n.sms=1;n.fee=3;return record('酒店已锁定；确认短信已发 1 条，手续费 ¥3 已产生。');}
  if(s.phase==='hotel'){n.phase='pending';n.flight='failed';n.todo='pending';return record('航班明确售罄；创建释放酒店待办。待办记录成功后才调用补偿。');}
  if(s.phase==='orphaned'){n.phase='manual';n.todo='manual';return record('人工按订单号盘点供应商资源，并重新建立处理单。');}
  if(s.phase==='unknown'){
    if(s.hotel==='released'){n.phase='cancelled';n.todo='done';return record('按同一业务键核对：供应商已释放。现在才能确认取消；短信和费用仍在。');}
    n.phase=s.attempts>=2?'manual':'pending';n.todo=n.phase==='manual'?'manual':'pending';return record('按同一业务键核对：供应商确认尚未释放，保留待办，按重试预算继续或转人工。');
  }
  if(s.phase==='pending'||s.phase==='manual'){
    n.attempts++;
    if(s.hotel==='released'){n.phase='cancelled';n.todo='done';return record('供应商按相同业务键返回已有释放结果；没有再次释放或收费，确认取消。');}
    if(outcome==='failure'){n.phase=n.attempts>=2?'manual':'pending';n.todo=n.phase==='manual'?'manual':'pending';return record(n.phase==='manual'?'连续失败达到教学预算 2 次；转人工责任人「旅行运营」，保留未完成待办。':'释放明确失败，酒店仍占用；待办保留，不能宣称取消。');}
    if(outcome==='success'||outcome==='timeout-applied'){n.releases++;n.hotel='released';}
    if(outcome==='success'){n.phase='cancelled';n.todo='done';return record('释放成功，待办完成，订单确认取消。业务补偿没有撤回短信或手续费。');}
    n.phase='unknown';n.todo='unknown';return record('调用超时：调用方不知道是否释放。记录未知结果，下一步按业务键查询，不能当确定失败。');
  }
  return s;
}
export function restart(s:SagaState):SagaState {
  if(s.phase==='start')return s;
  const n:SagaState={...s,restarts:s.restarts+1,logs:[...s.logs]};
  if(s.durable){n.message='进程重启：从持久化日志恢复步骤、同一业务键和补偿待办；供应商资源不受重启影响。';n.logs.push(n.message);return n;}
  n.logs=[];n.todo='none';n.attempts=0;n.phase='orphaned';n.message='进程重启：内存进度丢失，系统不能证明流程已结束；供应商资源和短信费用仍在，需人工盘点。';return n;
}
export type Prediction='held'|'unknown-released'|'released'|'free';
export function observe(s:SagaState):Prediction{return s.hotel==='held'?'held':s.hotel==='free'?'free':s.phase==='cancelled'?'released':'unknown-released';}
export const predictionLabels:Record<Prediction,string>={held:'酒店仍占用，未确认取消','unknown-released':'酒店已释放，流程仍待核对',released:'酒店已释放，流程确认取消',free:'尚未占用酒店'};


