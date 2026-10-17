export type Plan = {hypothesis:string; owner:string; scope:number; duration:number; slotLimit:number; overdueLimit:number; delay:number};
export type Request = {id:number; age:number; remaining:number; slow:boolean};
export type Phase = 'ready'|'running'|'recovering'|'complete';
export type State = {plan:Plan; tick:number; phase:Phase; active:Request[]; queue:Request[]; nextId:number; completed:number; late:number; healthyTicks:number; stopReason:string; note:string};
export const defaultPlan:Plan={hypothesis:'库存延迟不会占满订单槽，撤销后积压可以恢复',owner:'订单值班负责人',scope:1,duration:5,slotLimit:60,overdueLimit:20,delay:4};
export function validPlan(p:Plan){return Boolean(p.hypothesis.trim()&&p.owner.trim()&&Number.isInteger(p.scope)&&p.scope>=1&&p.scope<=5&&Number.isInteger(p.duration)&&p.duration>=1&&p.duration<=8&&p.slotLimit>=40&&p.slotLimit<=95&&p.overdueLimit>=1&&p.delay>=2&&p.delay<=6);}
export const initialState=(plan:Plan=defaultPlan):State=>({plan:{...plan},tick:0,phase:'ready',active:[],queue:[],nextId:1,completed:0,late:0,healthyTicks:0,stopReason:'',note:'先登记假设与负责人，再预测并启动教学演练。'});
export function metrics(s:State){return {slots:20+s.active.length,backlog:s.queue.length,overdue:[...s.active,...s.queue].filter(r=>r.age>=2).length,slow:s.active.filter(r=>r.slow).length,baselineSlots:20+s.plan.scope*10,controlSlots:20+s.plan.scope*10,controlCompleted:s.tick>1?s.plan.scope*10:0};}
export function stop(s:State):State {return s.phase==='running'?{...s,phase:'recovering',stopReason:'负责人手动撤销',note:'已撤销后续延迟注入；已在途的慢请求仍需完成，继续推进并验收恢复。'}:s;}
export function step(s:State):State {
 if(s.phase==='complete'||!validPlan(s.plan))return s;
 const running=s.phase==='ready'||s.phase==='running';
 const aged=s.active.map(r=>({...r,age:r.age+1,remaining:r.remaining-1}));
 const done=aged.filter(r=>r.remaining<=0);
 let active=aged.filter(r=>r.remaining>0);
 const queue=s.queue.map(r=>({...r,age:r.age+1}));
 let nextId=s.nextId;
 for(let i=0;i<s.plan.scope*10;i++)queue.push({id:nextId++,age:0,remaining:running?s.plan.delay:1,slow:running});
 const admitted=queue.splice(0,Math.max(0,80-active.length));
 active=[...active,...admitted];
 let result:State={...s,tick:s.tick+1,phase:running?'running':'recovering',active,queue,nextId,completed:done.length,late:done.filter(r=>r.age>2).length};
 const m=metrics(result);
 if(running&&(m.slots>=s.plan.slotLimit||m.overdue>=s.plan.overdueLimit||result.tick>=s.plan.duration)){
  result.phase='recovering';result.stopReason=m.slots>=s.plan.slotLimit?'并发槽达到停止阈值':m.overdue>=s.plan.overdueLimit?'逾期用户请求达到停止阈值':'达到预定持续时间';
 }
 const healthy=result.phase==='recovering'&&m.backlog===0&&m.slow===0&&m.overdue===0&&result.late===0&&m.slots<=m.baselineSlots;
 result.healthyTicks=healthy?s.healthyTicks+1:0;
 result.note=`第 ${result.tick} 拍：${running?'新增请求受依赖延迟影响':'后续请求已恢复正常延迟'}；完成 ${done.length} 个，其中超出两拍期限 ${result.late} 个。${result.phase==='recovering'?'停止原因：'+result.stopReason+'。在途请求与积压仍保留。':''}`;
 return result;
}
export function acceptRecovery(s:State):State {return s.phase==='recovering'&&s.healthyTicks>=2?{...s,phase:'complete',note:'负责人验收：连续两拍槽占用回到基线、积压与逾期归零。此模型中的恢复已通过，仍需复盘已发生的用户超期。'}:s;}
