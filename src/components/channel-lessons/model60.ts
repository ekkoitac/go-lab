export type Worker60 = {job:number|null; exited:boolean;waiting:boolean};
export type State60 = {count:number;capacity:number;total:number;nextJob:number;queue:number[];workers:Worker60[];results:number[];blocked:boolean;jobsClosed:boolean;waited:boolean;resultsClosed:boolean;peak:number;last:string;line:string};
export type Action60 = 'send'|'closeJobs'|'wait'|'closeResults'|`take:${number}`|`finish:${number}`;
export function initial60(count=2,capacity=2,total=6):State60 {return {count,capacity,total,nextJob:1,queue:[],workers:Array.from({length:count},()=>({job:null,exited:false,waiting:false})),results:[],blocked:false,jobsClosed:false,waited:false,resultsClosed:false,peak:0,last:'先提交任务，再安排 worker 从 jobs 接单。',line:'init'};}
export const active60=(s:State60)=>s.workers.filter(w=>w.job!==null).length;
export function step60(s:State60,action:Action60):State60 {
 const n:State60={...s,queue:[...s.queue],workers:s.workers.map(w=>({...w})),results:[...s.results],line:action.split(':')[0]};
 if(action==='send') {
  if(s.jobsClosed){n.last='jobs 已关闭，继续发送会 panic；实验拒绝此操作。';return n;}
  if(s.nextJob>s.total){n.last='全部输入已提交，可以关闭 jobs。';return n;}
  if(s.blocked){n.last='生产者已卡在当前发送，先让 worker 腾出队列空间。';return n;}
  const waiting=n.workers.find(w=>w.waiting&&!w.exited);
  if(waiting){waiting.job=n.nextJob++;waiting.waiting=false;n.last=`任务 ${s.nextJob} 直接交给等待接收的 worker，无需占用 jobs 槽位。`;n.peak=Math.max(n.peak,active60(n));return n;}
  if(s.queue.length>=s.capacity){n.blocked=true;n.last=`提交任务 ${s.nextJob} 被满队列阻塞；尚未进入 jobs。`;return n;}
  n.queue.push(n.nextJob++);n.last=`任务 ${s.nextJob} 进入 jobs；排队不等于已经执行。`;
 } else if(action.startsWith('take:')) {
  const i=Number(action.split(':')[1]),w=n.workers[i];if(!w)return s;
  if(w.waiting){n.last=`worker ${i+1} 已在等待接收，生产者提交后会唤醒。`;return n;}
  if(w.exited||w.job!==null){n.last=`worker ${i+1} ${w.exited?'已经退出':'仍在处理任务，不能再接一个'}。`;return n;}
  if(n.queue.length){w.job=n.queue.shift()!;n.last=`worker ${i+1} 接到任务 ${w.job}。`;
   if(n.blocked){n.queue.push(n.nextJob++);n.blocked=false;n.last+=` 腾出的槽位让生产者完成任务 ${s.nextJob} 的发送。`;}
  } else if(n.blocked){w.job=n.nextJob++;n.blocked=false;n.last=`worker ${i+1} 与被阻塞的生产者直接交接任务 ${w.job}。`;} else if(n.jobsClosed){w.exited=true;n.last=`jobs 关闭且排空，worker ${i+1} 的 range 结束并执行 Done。`;}
  else {w.waiting=true;n.last=`worker ${i+1} 等待接收；提交任务会直接唤醒它。`;}
 } else if(action.startsWith('finish:')) {
  const i=Number(action.split(':')[1]),w=n.workers[i];if(!w)return s;
  if(w.job===null){n.last=`worker ${i+1} 没有执行中的任务。`;return n;}
  const job=w.job;n.results.push(job);w.job=null;n.last=`worker ${i+1} 完成任务 ${job}，结果 ${job*job} 已写入 results；还需再次接收才能结束 range。`;
 } else if(action==='closeJobs') {
  if(n.jobsClosed)n.last='jobs 已关闭，不能重复 close。';
  else if(n.nextJob<=n.total||n.blocked)n.last='还有未完成的发送；先提交剩余输入，再由生产者关闭 jobs。';
  else {n.jobsClosed=true;for(const w of n.workers){if(w.waiting){w.waiting=false;w.exited=true;}}n.last='生产者关闭 jobs。缓冲中的任务仍要处理；空队列上等待接收的 worker 被唤醒，结束 range 并 Done。';}
 } else if(action==='wait') {
  if(n.workers.every(w=>w.exited)){n.waited=true;n.last='所有 worker 已 Done，Wait 返回；现在协调者可以关闭 results。';}
  else n.last=`Wait 尚不能返回：${active60(n)} 个任务在执行，${n.workers.filter(w=>!w.exited).length} 个 worker 尚未退出。队列空不等于工作完成。`;
 } else if(action==='closeResults') {
  if(n.resultsClosed)n.last='results 已关闭，收尾完成。';
  else if(!n.waited)n.last='尚未确认所有 worker 结束，提前关闭 results 可能让后续发送 panic。先等待 Wait 返回。';
  else {n.resultsClosed=true;n.last=`协调者关闭 results，收尾完成。共 ${n.results.length} 个结果，和为 ${n.results.reduce((a,v)=>a+v*v,0)}。`;}
 }
 n.peak=Math.max(n.peak,active60(n));return n;
}
export function recommended60(s:State60):Action60 {
 if(s.resultsClosed)return 'wait';
 if(s.waited)return 'closeResults';
 if(s.nextJob>s.total&&!s.jobsClosed)return 'closeJobs';
 const idle=s.workers.findIndex(w=>!w.exited&&!w.waiting&&w.job===null);
 if(idle>=0&&(s.queue.length||s.jobsClosed||s.blocked))return `take:${idle}`;
 if(s.nextJob<=s.total&&!s.blocked&&(s.queue.length<s.capacity||s.workers.some(w=>w.waiting)))return 'send';
 if(idle>=0&&s.capacity===0&&!s.jobsClosed)return `take:${idle}`;
 const busy=s.workers.findIndex(w=>w.job!==null);
 if(busy>=0)return `finish:${busy}`;
 return 'wait';
}
export function run60(count:number,capacity:number):State60 {let s=initial60(count,capacity);for(let i=0;i<100&&!s.resultsClosed;i++)s=step60(s,recommended60(s));return s;}
