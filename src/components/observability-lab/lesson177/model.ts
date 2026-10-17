export type Policy = 'plain' | 'select' | 'default';
export type Branch = 'send' | 'cancel';
export type Worker = { id: number; phase: 'send' | 'cleanup' | 'done'; sent: boolean; reported: boolean; reason: string };
export type Config = { producers: number; capacity: number; receiver: boolean; policy: Policy };
export type State = { config: Config; workers: Worker[]; receiver: boolean; cancelled: boolean; buffer: number; received: number; cursor: number; stopped: boolean; samples: number; signature: string; event: string };
export const initialConfig: Config = { producers: 3, capacity: 0, receiver: true, policy: 'plain' };
export function createState(config: Config = initialConfig): State {
  return { config: { ...config }, workers: Array.from({length: config.producers}, (_,id) => ({id, phase:'send', sent:false, reported:false, reason:'等待执行发送'})), receiver:config.receiver, cancelled:false, buffer:0, received:0, cursor:0, stopped:false, samples:0, signature:'', event:'已创建生产者。每个生产者发送一个结果，随后清理并关闭自己的 done。' };
}
export function readyBranches(s: State): Branch[] {
  const result: Branch[] = [];
  if (s.receiver || s.buffer < s.config.capacity) result.push('send');
  if (s.config.policy === 'select' && s.cancelled) result.push('cancel');
  return result;
}
export function nextWorker(s: State) { for(let i=0;i<s.workers.length;i++){ const w=s.workers[(s.cursor+i)%s.workers.length]; if(w.phase !== 'done') return w; } return undefined; }
export function step(s: State, choice: Branch = 'send'): State {
  const target=nextWorker(s); if(!target) return {...s,event:'全部 done 已关闭，拥有者已观察到所有生产者退出。'};
  const n: State = {...s, workers:s.workers.map(w=>({...w})), samples:0, signature:'', cursor:(target.id+1)%s.workers.length};
  const w=n.workers[target.id];
  if(w.phase==='cleanup'){w.phase='done'; w.reason='defer 清理完成；关闭 done'; n.event=`P${w.id+1} 完成清理并关闭 done：现在才获得退出证据。`; return n;}
  const ready=readyBranches(s);
  const branch=ready.length===2 ? choice : ready[0];
  if(branch==='send'){w.sent=true;w.reported=true;w.phase='cleanup';w.reason='发送成功，准备清理';if(n.receiver)n.received++;else n.buffer++;n.event=`P${w.id+1} 发送成功 → ${n.receiver?'接收者收到':'占用一个缓冲格'}，done 仍未关闭。${ready.length===2?'本次选择发送是合法教学路径；Go select 不保证取消优先。':''}`;}
  else if(branch==='cancel'){w.phase='cleanup';w.reason='收到取消，准备清理';n.event=`P${w.id+1} 选择取消分支，未发送；下一次调度该生产者才能完成清理。${ready.length===2?'这是手选教学路径，不代表运行时的优先级。':''}`;}
  else if(n.config.policy==='default'){w.phase='cleanup';w.reported=true;w.reason='default 未发送却返回 true';n.event=`P${w.id+1} default 分支立即返回 true，但发送数没有增加：误报成功。`;}
  else {w.reason=n.config.policy==='plain'?'chan send：无人接收且无缓冲余量':'select：发送与取消都未就绪';n.event=`P${w.id+1} 阻塞在 ${n.config.policy==='plain'?'普通 channel 发送':'select'}；${n.cancelled?'cancel 已通知，但普通发送不监听它。':'需要接收者、缓冲空间或可监听的取消。'}`;}
  return n;
}
export function intervene(s: State, action: 'leave'|'cancel'|'stop'|'inspect'): State {
  if(action==='leave')return {...s,receiver:false,samples:0,event:'接收者离开。已入缓冲的数据仍保留，普通发送不会自动退出。'};
  if(action==='cancel')return {...s,cancelled:true,samples:0,event:'cancel 通知已发出。worker 状态与 done 数没有因此改变。'};
  if(action==='stop')return {...s,stopped:true,samples:0,event:'停止新负载；接下来对比存活数量及相同阻塞栈，排除持续进入的新任务。'};
  const signature=JSON.stringify(s.workers.map(w=>[w.phase,w.reason]));
  const blocked=s.workers.some(w=>w.phase==='send') && readyBranches(s).length===0 && s.config.policy!=='default';
  const samples=s.stopped&&s.cancelled&&!s.receiver&&blocked ? (s.signature===signature?s.samples+1:1):0;
  return {...s,signature,samples,event:!s.stopped?'仍未停止负载，数量高本身不足以判定泄漏。':!s.cancelled||s.receiver?'先确认接收者已离开并通知任务取消，再检查生命周期结束后的残留。':samples>=2?'两次静止采样看到同一批发送栈，且没有合法退出路径：本模型中支持泄漏判断。':blocked?'记录第一份静止栈样本；再采一次比较身份与阻塞点。':'仍有可执行的发送、取消或清理路径；先调度完成，再判断是否残留。'};
}
export function metrics(s: State){return {active:s.workers.filter(w=>w.phase!=='done').length,done:s.workers.filter(w=>w.phase==='done').length,sent:s.workers.filter(w=>w.sent).length,reported:s.workers.filter(w=>w.reported).length,leakEvidence:s.samples>=2};}
export function runScenario(config:Config){let s=intervene(intervene(createState(config),'leave'),'cancel');for(let i=0;i<config.producers*3;i++)s=step(s,'cancel');return s;}

