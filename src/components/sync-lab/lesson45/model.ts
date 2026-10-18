export type Mode = 'copy-zero' | 'pointer' | 'copy-used';
export type Actor = 'A' | 'B';
export type Action = 'connect' | 'lockA' | 'lockB' | 'enterA' | 'enterB' | 'releaseA' | 'releaseB';
export type Effect = 'connected' | 'acquired' | 'blocked' | 'access' | 'overlap' | 'released' | 'invalid';
export const effects: Record<Effect, string> = {connected:'建立对象引用关系', acquired:'获得锁', blocked:'TryLock 返回 false', access:'进入数据访问阶段', overlap:'两段访问重叠，保护失效', released:'结束访问并释放锁', invalid:'违反复制约定，停止推演'};
export const actions: Record<Action, string> = {connect:'建立 B 的引用', lockA:'A.TryLock()', lockB:'B.TryLock()', enterA:'A 开始访问数据', enterB:'B 开始访问数据', releaseA:'A 结束并 Unlock', releaseB:'B 结束并 Unlock'};
export interface State {mode: Mode; connected: boolean; violation: boolean; used: boolean; usedLocks: {L1:boolean; L2:boolean}; locks: {L1: Actor | null; L2: Actor | null}; phases: Record<Actor, 'idle' | 'locked' | 'access' | 'done'>; overlap: boolean; effect: Effect | null; message: string;}
export function initialState(mode: Mode = 'copy-zero'): State {return {mode,connected:false,violation:false,used:mode==='copy-used',usedLocks:{L1:mode==='copy-used',L2:false},locks:{L1:null,L2:null},phases:{A:'idle',B:'idle'},overlap:false,effect:null,message:mode==='copy-used'?'起点：A.mu 曾 Lock 后 Unlock；现在未锁住，但已被使用。':'起点：A 持有零值 Mutex L1 和共享数据引用 D。先建立 B 的引用。'};}
export function lockId(s:State, actor:Actor): 'L1'|'L2' {return actor==='B' && s.mode!=='pointer' ? 'L2':'L1';}
export function canStep(s:State,a:Action):boolean {
  if(s.violation) return false;
  if(a==='connect') return !s.connected;
  if(!s.connected) return false;
  const actor=a.endsWith('A')?'A':'B';
  if(a.startsWith('lock')) return s.phases[actor]==='idle';
  if(a.startsWith('enter')) return s.phases[actor]==='locked';
  return s.phases[actor]==='locked'||s.phases[actor]==='access';
}
export function step(s:State,a:Action):State {
  if(!canStep(s,a)) return s;
  const n:State={...s,locks:{...s.locks},usedLocks:{...s.usedLocks},phases:{...s.phases}};
  if(a==='connect') {
    if(s.mode==='copy-used') return {...n,violation:true,effect:'invalid',message:'b := a 试图复制已经使用的 Mutex，违反 Go 使用约定。这里不预测复制品可否加锁或是否死锁；该操作没有可依赖的通用合法语义。'};
    n.connected=true; n.effect='connected'; n.message=s.mode==='pointer'?'b := a（a 为 *Cache）：A、B 都引用对象 C1，锁 L1 与数据 D 的身份一起共享。':'b := a（a 为 Cache）：首次使用前复制零值锁得到 L2；数据引用仍指向 D。锁合法不代表共享数据被正确保护。'; return n;
  }
  const actor:Actor=a.endsWith('A')?'A':'B'; const other:Actor=actor==='A'?'B':'A'; const id=lockId(s,actor);
  if(a.startsWith('lock')) {
    if(n.locks[id]) {n.effect='blocked'; n.message=`${actor}.TryLock(${id}) 返回 false：${id} 仍被 ${n.locks[id]} 持有；${actor} 未进入临界区。失败的 TryLock 不建立同步关系。`;}
    else {n.locks[id]=actor;n.phases[actor]='locked';n.used=true;n.usedLocks[id]=true;n.effect='acquired';n.message=`${actor} 获得 ${id}，下一步才能访问 D。另一个锁实例不会因此自动上锁。`;}
  } else if(a.startsWith('enter')) {
    n.phases[actor]='access'; n.overlap=s.overlap||s.phases[other]==='access'; n.effect=s.phases[other]==='access'?'overlap':'access'; n.message=n.effect==='overlap'?`${actor} 与 ${other} 的访问区间同时覆盖 D，但分别持有 L1、L2。两把锁不能建立互斥；实际无同步冲突访问会产生数据竞争，不能保证读写结果。`:`${actor} 在持有 ${id} 时进入 D 的访问阶段；暂不结束，试着调度另一个任务获取它的锁。`;
  } else {n.locks[id]=null;n.phases[actor]='done';n.effect='released';n.message=`${actor} 结束访问并释放 ${id}；此后另一个任务才可能获得同一把锁。`;}
  return n;
}
export function trace(mode:Mode, sequence:Action[]):State[] {const states=[initialState(mode)];for(const action of sequence) states.push(step(states[states.length-1],action));return states;}

