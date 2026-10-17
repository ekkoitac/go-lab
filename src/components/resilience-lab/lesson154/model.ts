export type Config={workers:number;arrivals:number;bursts:number;service:number;deadline:number;queueLimit:number;deadlineGate:boolean;cancelExpired:boolean};
export type Job={id:number;born:number;due:number;remaining:number};
export type Snapshot={time:number;stage:string;reason:string;queue:Job[];active:Job[];arrived:number;rejected:number;expired:number;completed:number;late:number;wasted:number;peakQueue:number};
export const baseline:Config={workers:2,arrivals:4,bursts:4,service:3,deadline:5,queueLimit:20,deadlineGate:false,cancelExpired:false};
export function simulate(c:Config):Snapshot[]{
 const s:Snapshot={time:0,stage:'准备',reason:'每秒先清理到期请求，再接收、调度、执行；尚未产生请求。',queue:[],active:[],arrived:0,rejected:0,expired:0,completed:0,late:0,wasted:0,peakQueue:0};
 const trace:Snapshot[]=[];const save=(stage:string,reason:string)=>{s.stage=stage;s.reason=reason;trace.push({...s,queue:s.queue.map(j=>({...j})),active:s.active.map(j=>({...j}))});};save(s.stage,s.reason);
 const predictedFinish=()=>{const slots=Array.from({length:c.workers},(_,i)=>s.time+(s.active[i]?.remaining??0));for(const job of s.queue){const i=slots.indexOf(Math.min(...slots));slots[i]+=job.remaining;}return Math.min(...slots)+c.service;};
 for(let t=0;t<c.bursts||s.queue.length||s.active.length;t++){
  s.time=t;const old=s.queue.length+s.active.length;
  s.queue=s.queue.filter(j=>{if(j.due<=t){s.expired++;return false;}return true;});
  if(c.cancelExpired)s.active=s.active.filter(j=>{if(j.due<=t){s.expired++;return false;}return true;});
  save('检查期限',`到期清理 ${old-s.queue.length-s.active.length} 个；${c.cancelExpired?'执行器协作取消到期任务。':'执行器不响应取消，到期在途仍占槽。'}`);
  const before=s.rejected;const count=t<c.bursts?c.arrivals:0;
  for(let k=0;k<count;k++){
   const job={id:++s.arrived,born:t,due:t+c.deadline,remaining:c.service};
   if(c.deadlineGate&&predictedFinish()>job.due){s.rejected++;continue;}
   if(s.active.length<c.workers&&s.queue.length===0)s.active.push(job);
   else if(s.queue.length<c.queueLimit)s.queue.push(job);else s.rejected++;
  }
  s.peakQueue=Math.max(s.peakQueue,s.queue.length);save('准入',`到达 ${count} 个，拒绝 ${s.rejected-before} 个；队列 ${s.queue.length}/${c.queueLimit}。${c.deadlineGate?'按当前 FIFO 工作量估计完成时刻，超过期限则拒绝。':'只看队列是否有位置，不检查预计等待是否来得及。'}`);
  const started:number[]=[];while(s.active.length<c.workers&&s.queue.length){const job=s.queue.shift()!;s.active.push(job);started.push(job.id);}
  save('调度',started.length?`FIFO 取出 #${started.join('、#')}，占用 ${s.active.length}/${c.workers} 个工作槽。`:`没有新任务取出；占用 ${s.active.length}/${c.workers}，空闲槽不等于额外到达。`);
  const good=s.completed,bad=s.late;for(const job of s.active){if(t>=job.due)s.wasted++;job.remaining--;}
  s.active=s.active.filter(j=>{if(j.remaining===0){if(t+1<=j.due)s.completed++;else s.late++;return false;}return true;});
  s.time=t+1;save('执行 1 秒',`按时完成 +${s.completed-good}，迟到完成 +${s.late-bad}；累计过期后的执行 ${s.wasted} 槽秒。`);
 }
 save('结束',`到达 ${s.arrived} = 有效完成 ${s.completed} + 拒绝 ${s.rejected} + 到期取消/丢弃 ${s.expired} + 迟到完成 ${s.late}。`);return trace;
}
export const repaired:Config={...baseline,queueLimit:2,deadlineGate:true,cancelExpired:true};
