export type Policy = 'split' | 'whole';
export type Action = 'debit' | 'credit' | 'observe';
export type Snapshot = {a:number; b:number; total:number};
export type State = {
  policy:Policy; amount:number; a:number; b:number; total:number;
  phase:'ready'|'debited'|'done'; locked:boolean;
  observed:Snapshot|null; reads:number; blocked:number; message:string;
};
export function initialState(policy:Policy='split',amount=10,a=60,b=40):State {
  if (![amount,a,b].every(Number.isSafeInteger) || amount<1 || amount>a || b<0) throw new Error('转移数量必须为正整数，且不能超过来源余额');
  return {policy,amount,a,b,total:a+b,phase:'ready',locked:false,observed:null,reads:0,blocked:0,message:'选择扣款、监控或入账的执行顺序。'};
}
export function canStep(s:State,action:Action):boolean {
  return action==='observe' || (action==='debit' ? s.phase==='ready' : s.phase==='debited');
}
export function observation(s:State):string {return s.locked ? 'blocked' : String(s.a+s.b);}
export function step(s:State,action:Action):State {
  if (!canStep(s,action)) return s;
  if (action==='debit') return {...s,a:s.a-s.amount,phase:'debited',locked:s.policy==='whole',message:`扣款 ${s.amount}：A ${s.a} → ${s.a-s.amount}，B 不变。${s.policy==='whole'?'转账继续持有共同锁；内部临时总额变小，遵守同一锁的监控还不能读取。':'本段已经解锁；监控现在可在入账前读到不完整状态。'}`};
  if (action==='credit') return {...s,b:s.b+s.amount,phase:'done',locked:false,message:`入账 ${s.amount}：B ${s.b} → ${s.b+s.amount}，总额恢复 ${s.total}。共同锁已释放，监控可以读取完成后的快照。`};
  if (s.locked) return {...s,blocked:s.blocked+1,message:'监控请求共同锁，但转账仍持有它：本次尝试阻塞，没有产生新快照。请先入账并解锁，再调度监控读取。'};
  return {...s,observed:{a:s.a,b:s.b,total:s.a+s.b},reads:s.reads+1,message:`监控取得共同锁，读取 A=${s.a}、B=${s.b} 后解锁；外部快照总额 ${s.a+s.b}。${s.a+s.b===s.total?'本次快照满足总额约束；一次成功不证明所有调度都安全。':'总额约束被打破，但每一次访问都遵守锁，因此此例不需要数据竞争也会出错。'}`};
}
export function runSchedule(policy:Policy,amount:number,actions:Action[],a=60,b=40):State {
  return actions.reduce(step,initialState(policy,amount,a,b));
}
