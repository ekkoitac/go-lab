export type Policy = 'immediate' | 'classified';
export type Fault = 'permanent' | 'transient';
export type Destination = 'queue' | 'retry' | 'dead';
export interface Config { policy: Policy; fault: Fault; maxAttempts: number; recoveryAt: number; jitter: boolean }
export interface Message { id: string; version: number; attempts: number; payload: string; fault: Fault | null }
export interface DeadLetter { message: Message; reason: string; originalVersion: number; originalPayload: string; failedAt: number }
export interface Snapshot { time: number; queue: Message[]; delayed: {message: Message; due: number}[]; dead: DeadLetter[]; archive: DeadLetter[]; completed: string[]; work: number; failures: number; note: string; firstDestination: Destination | null; replayAfter: number }
export interface Prediction { value: Destination; reason: string }
export interface Timeline { config: Config; history: Snapshot[]; prediction: Prediction | null }
export type Action = 'step' | 'repair' | 'replay';
export const defaults: Config = {policy:'immediate',fault:'permanent',maxAttempts:3,recoveryAt:4,jitter:true};
function validate(c:Config) { if (!['immediate','classified'].includes(c.policy)||!['permanent','transient'].includes(c.fault)||!Number.isInteger(c.maxAttempts)||c.maxAttempts<1||c.maxAttempts>5||!Number.isInteger(c.recoveryAt)||c.recoveryAt<0||c.recoveryAt>20||typeof c.jitter!=='boolean') throw new Error('Invalid simulation configuration'); }
export function initial(config:Config=defaults):Timeline { validate(config); return {config:{...config},prediction:null,history:[{time:0,queue:[{id:'problem-1',version:1,attempts:0,payload:config.fault==='permanent'?'{invalid-json':JSON.stringify({order:'problem-1'}),fault:config.fault},...['order-A','order-B'].map(id=>({id,version:1,attempts:0,payload:JSON.stringify({order:id}),fault:null}))],delayed:[],dead:[],archive:[],completed:[],work:0,failures:0,firstDestination:null,replayAfter:0,note:'t=0：问题消息位于队首，正常订单 A、B 等待。每步最多处理一条消息，并推进一个模拟时间单位。'}]}; }
export const current=(t:Timeline)=>t.history[t.history.length-1];
export function retryDelay(attempt:number,jitter:boolean) { return 2**attempt+(jitter?(attempt%2===1?1:0):0); }
export function advance(c:Config,before:Snapshot,action:Action='step'):Snapshot {
 validate(c); const s:Snapshot=structuredClone(before);
 if(action==='repair') { const d=s.dead[0];if(!d) return s;if(d.message.fault==='permanent'){d.message.version+=1;d.message.fault=null;d.message.payload=JSON.stringify({order:d.message.id});s.note=`修复 ${d.message.id}：可重放副本升级到 v${d.message.version}；原始 v${d.originalVersion} 和失败证据仍保留。尚未重放，也没有新增业务效果。`;}else{s.note='暂时依赖错误不应修改消息；推进模拟时间等待依赖恢复，再限速重放。';}return s; }
 if(action==='replay') { if(!s.dead.length||s.time<s.replayAfter)return s;const d=s.dead.shift()!;s.queue.push({...d.message,attempts:0});s.replayAfter=s.time+3;s.note=`${d.message.id} 以同一事件 ID 进入队尾，版本 v${d.message.version}；本次重放最多 1 条，下一次须到 t=${s.replayAfter}。新一轮尝试预算归零，是否修复由实际处理验证。`;return s; }
 if(action!=='step')throw new Error('Unknown simulation action');
 const due=s.delayed.filter(x=>x.due<=s.time);s.delayed=s.delayed.filter(x=>x.due>s.time);s.queue.push(...due.map(x=>x.message));
 const m=s.queue.shift();
 if(!m){s.note=`t=${s.time}：没有可执行消息，时钟前进；${s.delayed.length?'延迟队列尚未到期，等待不占消费者处理次数。':'没有新业务效果。'}`;s.time++;return s;}
 m.attempts++;s.work++;
 const fail=m.fault==='permanent'||(m.fault==='transient'&&s.time<c.recoveryAt);
 if(!fail){const duplicate=s.completed.includes(m.id);if(!duplicate)s.completed.push(m.id);s.note=`t=${s.time}：处理 ${m.id} 第 ${m.attempts} 次${duplicate?'，命中稳定事件 ID，跳过重复业务效果。':`成功，完成记录新增 1 条${m.fault==='transient'?'；依赖已恢复':''}。`}`;}
 else {s.failures++;let destination:Destination;const reason=m.fault==='permanent'?'schema-invalid：永久格式错误':'dependency-unavailable：暂时依赖错误';
 if(c.policy==='immediate'){destination='queue';s.queue.unshift(m);s.note=`t=${s.time}：${m.id} 第 ${m.attempts} 次失败（${reason}），立即插回队首；A、B 仍无法越过它。`;}
 else if(m.fault==='permanent'||m.attempts>=c.maxAttempts){destination='dead';const record={message:m,reason,originalVersion:m.version,originalPayload:m.payload,failedAt:s.time};s.dead.push(record);s.archive.push(structuredClone(record));s.note=`t=${s.time}：${m.id} 进入死信并产生待处理告警；${m.fault==='permanent'?'明确永久错误，等待不会修复它':`已用尽 ${c.maxAttempts} 次总尝试预算`}。事件 ID、原始 v${m.version}、尝试 ${m.attempts} 次和原因已保留；正常订单可继续。`;}
 else {destination='retry';const delay=retryDelay(m.attempts,c.jitter);s.delayed.push({message:m,due:s.time+delay});s.note=`t=${s.time}：${m.id} 第 ${m.attempts} 次暂错，转入延迟队列；退避 ${2**m.attempts} + 抖动 ${delay-2**m.attempts}，到 t=${s.time+delay} 才可重试，期间正常订单可以执行。`;}
 if(s.firstDestination===null)s.firstDestination=destination;
 }
 s.time++;return s;
}
export function act(t:Timeline,action:Action,prediction?:Prediction):Timeline {let p=t.prediction;if(!p){if(!prediction||!['queue','retry','dead'].includes(prediction.value)||!prediction.reason.trim())throw new Error('Record a prediction and reason first');p={...prediction};}return {...t,prediction:p,history:[...t.history,advance(t.config,current(t),action)]};}
export function back(t:Timeline):Timeline {if(t.history.length===1)return t;const history=t.history.slice(0,-1);return {...t,history,prediction:history.length===1?null:t.prediction};}
