export type Task = 0 | 1;
export type Lock = 0 | 1;
export type Policy = 'opposite' | 'ordered';
export interface State { policy:Policy; pc:[number,number]; owners:[Task|null,Task|null]; waiting:[Lock|null,Lock|null]; message:string; }
export function initialState(policy:Policy='opposite'):State {return {policy,pc:[0,0],owners:[null,null],waiting:[null,null],message:'两把锁空闲。选择一个任务执行下一条指令。'};}
export function order(s:State,t:Task):[Lock,Lock] {return t===1&&s.policy==='opposite'?[1,0]:[0,1];}
export function edges(s:State):{from:Task;to:Task;lock:Lock}[] {return ([0,1] as Task[]).flatMap(t=>{const l=s.waiting[t];return l!==null&&s.owners[l]!==null?[{from:t,to:s.owners[l]!,lock:l}]:[];});}
export function deadlocked(s:State):boolean {const e=edges(s);return e.some(a=>a.from===a.to)||e.some(a=>e.some(b=>a.from===b.to&&a.to===b.from));}
export function canStep(s:State,t:Task):boolean {if(s.pc[t]>=4)return false;const l=s.waiting[t];return l===null||s.owners[l]===null;}
export function instruction(s:State,t:Task):string {const seq=order(s,t),p=s.pc[t];return p<2?`Lock(${seq[p]===0?'A':'B'})`:p<4?`Unlock(${seq[3-p]===0?'A':'B'})`:'已完成';}
export function step(s:State,t:Task):State {
 if(!canStep(s,t))return s;
 const n:State={...s,pc:[...s.pc],owners:[...s.owners],waiting:[...s.waiting]};const p=s.pc[t],seq=order(s,t),who=`任务 ${t+1}`;
 if(p<2){const l=seq[p],name=l===0?'A':'B';if(n.owners[l]!==null){n.waiting[t]=l;n.message=`${who} 请求锁 ${name}，被任务 ${n.owners[l]!+1} 持有，停在 Lock；已持有的锁不会释放。`;}
 else {n.owners[l]=t;n.waiting[t]=null;n.pc[t]++;n.message=`${who} 取得锁 ${name}，Lock 返回，程序前进一步。`;}}
 else {const l=seq[3-p];if(n.owners[l]!==t)return s;n.owners[l]=null;n.pc[t]++;n.message=`${who} 释放锁 ${l===0?'A':'B'}。${n.pc[t]===4?'此任务完成。':'还持有第一把锁。'} 等待者需再次调度以完成获取。`;}
 if(deadlocked(n))n.message+=' 两条真实阻塞边闭合成等待环，双方无法到达 Unlock。';
 return n;
}
export type Outcome='acquire'|'wait'|'cycle'|'release';
export function outcome(s:State,t:Task):Outcome {const n=step(s,t);return deadlocked(n)?'cycle':n.waiting[t]!==null?'wait':s.pc[t]<2?'acquire':'release';}
export function run(policy:Policy,trace:Task[]):State {return trace.reduce(step,initialState(policy));}
