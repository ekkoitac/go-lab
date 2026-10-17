export type Strategy = 'direct' | 'outbox';
export type Phase = 'commit' | 'publish' | 'mark' | 'consume' | 'deduplicate' | 'idle';
export type Action = 'step' | 'crash' | 'restart' | 'wait';
export interface State {
  strategy: Strategy; idempotent: boolean; clock: number; running: boolean;
  order: boolean; event: 'absent' | 'pending' | 'sent'; createdAt: number | null;
  directPending: boolean; publishUnmarked: boolean; broker: string[];
  deliveries: number; consumed: number; processed: string[]; effects: number; skipped: number;
  log: string[];
}
export const initial = (strategy:Strategy='outbox',idempotent=true):State => ({strategy,idempotent,clock:0,running:true,order:false,event:'absent',createdAt:null,directPending:false,publishUnmarked:false,broker:[],deliveries:0,consumed:0,processed:[],effects:0,skipped:0,log:['准备创建订单 O-1，对应事件 E-1。']});
export function nextPhase(s:State):Phase {
  if (!s.running) return 'idle';
  if (!s.order) return 'commit';
  if (s.publishUnmarked) return 'mark';
  if (s.directPending || s.event==='pending') return 'publish';
  if (s.broker.length) return s.idempotent&&s.processed.includes(s.broker[0])?'deduplicate':'consume';
  return 'idle';
}
export const phaseLabel:Record<Phase,string> = {commit:'提交本地事务',publish:'向 broker 投递',mark:'确认并标记发送完成',consume:'消费并产生业务效果',deduplicate:'识别重复，跳过效果',idle:'无可执行工作'};
export function metrics(s:State){return {backlog:s.event==='pending'?1:0,oldestAge:s.event==='pending'&&s.createdAt!==null?s.clock-s.createdAt:0,brokerPending:s.broker.length};}
export function transition(s:State,action:Action):State {
  if(action==='crash'&&!s.running || action==='restart'&&s.running || action==='step'&&nextPhase(s)==='idle')return s;
  const n:State={...s,clock:s.clock+1,broker:[...s.broker],processed:[...s.processed],log:[...s.log]};
  const record=(message:string)=>{n.log.push(`t=${n.clock} · ${message}`);return n;};
  if(action==='crash') {n.running=false;n.directPending=false;n.publishUnmarked=false;return record('进程崩溃：内存发送意图与未标记确认丢失；订单、Outbox、broker 和消费账本保留。');}
  if(action==='restart'){n.running=true;return record(n.event==='pending'?'重启扫描到待发 E-1，可以重投。':'进程重启；没有持久化待发记录就无法自动补发。');}
  if(action==='wait')return record('教学时钟前进 1 秒；不执行投递，观察积压年龄。');
  switch(nextPhase(s)){
    case 'commit':n.order=true;if(s.strategy==='outbox'){n.event='pending';n.createdAt=n.clock;}else n.directPending=true;return record(s.strategy==='outbox'?'同一事务提交订单 O-1 和待发 E-1：两者一起持久化。':'订单 O-1 已提交；发送 E-1 的意图仅在内存，尚无持久化依据。');
    case 'publish':n.broker.push('E-1');n.deliveries++;n.publishUnmarked=true;return record('broker 已接收 E-1，但应用还没持久化发送完成；此处崩溃可能重投。');
    case 'mark':n.publishUnmarked=false;n.directPending=false;if(s.strategy==='outbox')n.event='sent';return record('投递器确认成功，Outbox 标记已发送（直接双写仅清内存意图）。');
    case 'consume': {const id=n.broker.shift()!;n.consumed++;n.effects++;if(!n.processed.includes(id))n.processed.push(id);return record(`消费 ${id}，业务效果 +1；${s.idempotent?'去重记录与业务效果在同一消费者本地事务提交。':'未按事件 ID 拦截重复。'}`);}
    case 'deduplicate':n.broker.shift();n.consumed++;n.skipped++;return record('E-1 已处理：去重账本命中，业务效果保持不变。');
    default:return s;
  }
}
export interface Prediction {deliveries:number;effects:number;reason:string}
export interface Run {prediction:Prediction;actual:Phase;actualDeliveries:number;actualEffects:number;message:string}
export interface Timeline {states:State[];runs:(Run|null)[]}
export const createTimeline=(strategy:Strategy='outbox',idempotent=true):Timeline=>({states:[initial(strategy,idempotent)],runs:[]});
export function apply(t:Timeline,action:Action,prediction?:Prediction):Timeline {
  const s=t.states.at(-1)!;if(action==='step'&&(!prediction?.reason.trim()||!Number.isInteger(prediction.deliveries)||prediction.deliveries<0||!Number.isInteger(prediction.effects)||prediction.effects<0))return t;
  const n=transition(s,action);if(n===s)return t;
  return {states:[...t.states,n],runs:[...t.runs,action==='step'&&prediction?{prediction,actual:nextPhase(s),actualDeliveries:n.deliveries,actualEffects:n.effects,message:n.log.at(-1)!}:null]};
}
export const back=(t:Timeline):Timeline=>t.states.length>1?{states:t.states.slice(0,-1),runs:t.runs.slice(0,-1)}:t;
export function crashScenario(strategy:Strategy,afterPublish:boolean,idempotent=true):State {
  let s=transition(initial(strategy,idempotent),'step');
  if(afterPublish)s=transition(s,'step');
  s=transition(transition(s,'crash'),'restart');
  for(let i=0;i<8&&nextPhase(s)!=='idle';i++)s=transition(s,'step');
  return s;
}