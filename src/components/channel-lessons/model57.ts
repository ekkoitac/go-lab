export type Event57 = 'idle' | 'message' | 'cancel';
export type Worker57 = {
 hasDefault: boolean; listensCancel: boolean; status: 'running' | 'waiting' | 'stopped';
 checks: number; spins: number; received: number[]; canceled: boolean; last: string;
};
export function worker57(hasDefault: boolean, listensCancel = true): Worker57 {
 return {hasDefault,listensCancel,status:'running',checks:0,spins:0,received:[],canceled:false,last:'尚未进入 select'};
}
// One logical event at a time; a message is consumed before cancellation can arrive.
export function advance57(s: Worker57, event: Event57): Worker57 {
 if (s.status === 'stopped') return s;
 const checks = s.checks + (s.status === 'waiting' ? 0 : 1);
 if (event === 'cancel' && s.listensCancel) return {...s,checks,canceled:true,status:'stopped',last:'取消就绪 → 选择 Done 分支 → return'};
 if (event === 'message') return {...s,checks,status:'running',received:[...s.received,7],last:s.status==='waiting'?'消息 7 到达 → 唤醒原 select → 接收 7':'消息 7 就绪 → 接收 7 → 回到循环'};
 const canceled = s.canceled || event === 'cancel';
 if (s.hasDefault) return {...s,checks,canceled,spins:s.spins+1,status:'running',last:event==='cancel'?'未监听取消 → 没有就绪通信 → default 空转':'无消息 → default 立即返回 → for 再次循环'};
 return {...s,checks,canceled,status:'waiting',last:s.status==='waiting'?'没有新事件 → 仍在原 select 等待，不重复检查':event==='cancel'?'未监听取消 → 无消息，仍挂起等待':'无消息、无 default → 挂起等待事件'};
}
export type Pair57 = {tick:number; busy:Worker57; blocking:Worker57; event:string};
export const initial57 = ():Pair57 => ({tick:0,busy:worker57(true),blocking:worker57(false),event:'同一时序，两份独立的消息输入'});
export function pair57(s:Pair57,event:Event57):Pair57 {
 if (s.busy.status === 'stopped') return s;
 return {tick:s.tick+1,busy:advance57(s.busy,event),blocking:advance57(s.blocking,event),event:event==='idle'?'空闲观察步':event==='message'?'两组分别到达消息 7':'两组同时收到取消通知'};
}
export function tryReceive57(ready:boolean) {return {checks:1,received:ready?[7]:[],defaults:ready?0:1,returns:true};}
