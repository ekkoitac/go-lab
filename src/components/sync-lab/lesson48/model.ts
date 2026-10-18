export type Task = { registered:boolean; phase:'idle'|'running'|'complete'|'done' };
export type State = { tasks:Task[]; count:number; wait:'idle'|'waiting'|'ready'|'returned'; batch:number; error:string|null; message:string };
export type Action = {type:'add'|'start'|'complete'|'done'; task:number}|{type:'wait'}|{type:'return'}|{type:'batch'};
export function initialState(size=2,batch=1):State {return {tasks:Array.from({length:Math.max(1,Math.min(3,Math.floor(size)||1))},()=>({registered:false,phase:'idle'})),count:0,wait:'idle',batch,error:null,message:'计数为零，任务尚未启动。先登记还是先 Wait，由你安排。'};}
export function canStep(s:State,a:Action):boolean {
 if(s.error)return false;
 if(a.type==='wait')return s.wait==='idle';
 if(a.type==='return')return s.wait==='ready';
 if(a.type==='batch')return s.wait==='returned'&&s.count===0&&s.tasks.every(t=>t.phase==='done');
 const t=s.tasks[a.task];if(!t)return false;
 if(a.type==='add')return !t.registered&&t.phase!=='done';
 if(a.type==='start')return t.phase==='idle';
 if(a.type==='complete')return t.phase==='running';
 return t.phase==='complete';
}
export function step(s:State,a:Action):State {
 if(!canStep(s,a))return s;
 if(a.type==='batch')return {...initialState(s.tasks.length,s.batch+1),message:'上一批计数归零、Wait 已返回；现在可登记新一批。'};
 const n:State={...s,tasks:s.tasks.map(t=>({...t}))};
 if(a.type==='wait'){n.wait=s.count===0?'returned':'waiting';n.message=s.count===0?'Wait 看到计数 0，合法立即返回；它不会等待未来的 Add。':'Wait 看到计数 '+s.count+'，调用者阻塞。任务是否已启动不影响这个判断。';return n;}
 if(a.type==='return'){n.wait='returned';n.message='已被唤醒的 Wait 获得调度并返回。此时才跨过本次等待边界。';return n;}
 const t=n.tasks[a.task],name=String.fromCharCode(65+a.task);
 if(a.type==='add'){
  if(s.count===0&&s.wait==='ready'){n.error='批次协议错误';n.message='计数已归零，但旧 Wait 尚未返回。此处不能开始新一批 Add；先让旧 Wait 返回。';return n;}
  t.registered=true;n.count++;n.message='Add(1) 登记任务 '+name+'：计数 '+s.count+' → '+n.count+'。'+(s.wait==='returned'?'原 Wait 已返回，不会重新阻塞；这不能补回漏等的任务。':'登记本身不启动任务。');
 }else if(a.type==='start'){t.phase='running';n.message='go 启动任务 '+name+'：未启动 → 执行中；计数仍为 '+s.count+'。go 不会自动 Add。';}
 else if(a.type==='complete'){t.phase='complete';n.message='任务 '+name+' 业务结束，但 Done 尚未执行：计数仍为 '+s.count+'。完成工作与通知等待者是两个事件。';}
 else {t.phase='done';n.count--;if(n.count<0){n.error='negative WaitGroup counter';n.message='Done 将计数 '+s.count+' → '+n.count+'，触发 panic：没有足够的登记与之配对。';}else {if(n.count===0&&n.wait==='waiting')n.wait='ready';n.message='任务 '+name+' Done：计数 '+s.count+' → '+n.count+'。'+(n.wait==='ready'?'等待者已唤醒，尚需被调度后返回。':n.wait==='returned'?'旧 Wait 仍保持已返回。':'Done 只减少计数，不传递业务结果。');}}
 return n;
}
export function route(size:number,late=false):Action[]{const ids=Array.from({length:size},(_,i)=>i);return late?[...ids.map(task=>({type:'start' as const,task})),{type:'wait'},...ids.map(task=>({type:'add' as const,task})),...ids.flatMap(task=>[{type:'complete' as const,task},{type:'done' as const,task}])]:[...ids.map(task=>({type:'add' as const,task})),...ids.map(task=>({type:'start' as const,task})),{type:'wait'},...ids.flatMap(task=>[{type:'complete' as const,task},{type:'done' as const,task}]),{type:'return'}];}
export const runSchedule=(actions:Action[],size=2)=>actions.reduce(step,initialState(size));


