export type Config={order:'early'|'after';incident:'none'|'dbfail'|'crash'|'acklost';idempotent:boolean};
export const defaults:Config={order:'early',incident:'dbfail',idempotent:true};
export const stages=['准备发券事件','消息投递，登记未确认','执行提前确认策略','尝试持久提交发券','执行提交后确认策略','连接断开，检查恢复依据','重新投递并处理','完成恢复确认'];
export type Prediction={value:'0'|'1'|'2';reason:string};
export type Timeline={config:Config;phase:number;prediction:Prediction|null};
export type Snapshot={phase:number;eventId:string;queued:boolean;unacked:boolean;coupons:number;inbox:boolean;deliveries:number;ackSent:number;ackReceived:number;committed:boolean;retried:boolean;skipped:boolean;connection:'connected'|'closed'|'reconnected';note:string};
function validate(c:Config){if(!['early','after'].includes(c.order)||!['none','dbfail','crash','acklost'].includes(c.incident)||typeof c.idempotent!=='boolean')throw new Error('Invalid configuration');}
export function initial(config:Config=defaults):Timeline{validate(config);return {config:{...config},phase:0,prediction:null};}
export function step(t:Timeline,prediction?:Prediction):Timeline{if(t.phase===0&&(!prediction||!['0','1','2'].includes(prediction.value)||!prediction.reason.trim()))throw new Error('Prediction and reason required');return {...t,phase:Math.min(7,t.phase+1),prediction:t.phase===0?{...prediction!}:t.prediction};}
export function back(t:Timeline):Timeline{return {...t,phase:Math.max(0,t.phase-1),prediction:t.phase<=1?null:t.prediction};}
export function inspect(c:Config,phase:number):Snapshot{
 validate(c);if(!Number.isInteger(phase)||phase<0||phase>7)throw new Error('Invalid phase');
 const s:Snapshot={phase,eventId:'coupon-e1',queued:true,unacked:false,coupons:0,inbox:false,deliveries:0,ackSent:0,ackReceived:0,committed:false,retried:false,skipped:false,connection:'connected',note:'一条事件应产生 1 张优惠券。预测故障恢复后的持久结果，再运行。'};
 const ack=(lost:boolean)=>{s.ackSent++;if(!lost){s.ackReceived++;s.unacked=false;}return lost?'ack 已发出但丢失，broker 仍保留未确认记录。':'broker 收到 ack，移除未确认记录；它不检查优惠券是否落库。';};
 if(phase>=1){s.queued=false;s.unacked=true;s.deliveries=1;s.note='broker 把 coupon-e1 交给消费者，登记 1 条未确认；持久优惠券仍为 0。';}
 if(phase>=2){s.note=c.order==='early'?ack(c.incident==='acklost'):'策略要求先提交：此时不发 ack，broker 仍保留未确认记录。';}
 if(phase>=3){if(c.incident==='dbfail'){s.note='首次数据库提交失败：优惠券与幂等记录均未落库。'+(s.unacked?'未确认记录还在，仍可恢复。':'提前确认已解除 broker 责任，没有重投依据。');}else{s.coupons=1;s.committed=true;s.inbox=c.idempotent;s.note='数据库持久提交 1 张优惠券'+(c.idempotent?'及 coupon-e1 幂等记录（同一事务）。':'；本方案没有持久幂等记录。');}}
 if(phase>=4){if(c.incident==='crash'){s.connection='closed';s.note='业务提交后消费者崩溃，来不及执行后置 ack；已持久提交的券不回滚。'+(s.unacked?'broker 仍有未确认记录。':'提前 ack 已送达，本消息不会重投。');}else if(c.order==='after'&&s.committed){s.note=ack(c.incident==='acklost');}else if(!s.committed){s.note='提交失败，不再发送 ack。'+(s.unacked?'待连接关闭后重投。':'但之前的提前 ack 无法撤销，券仍为 0。');}else{s.note='提前确认步骤已结束；提交成功没有额外的后置 ack。';}}
 if(phase>=5){s.connection='closed';if(s.unacked){s.unacked=false;s.queued=true;s.note='broker 检测连接关闭，把未确认的 coupon-e1 重新入队。数据库不会因此回滚。';}else{s.note='连接关闭，但 broker 没有未确认记录：不重投。持久优惠券保持 '+s.coupons+' 张。';}}
 if(phase>=6){s.connection='reconnected';if(s.queued){s.queued=false;s.unacked=true;s.deliveries++;s.retried=true;if(c.idempotent&&s.inbox){s.skipped=true;s.note='同一 coupon-e1 重投，事务命中持久幂等记录：跳过重复发券，仍为 1 张。';}else{s.coupons++;s.committed=true;s.inbox=c.idempotent;s.note='重投后数据库可用，持久提交一张券；总计 '+s.coupons+' 张。'+(s.coupons===2?'原券已经提交，没有幂等保护便重复发券。':'首次失败没有留下副作用，本次补齐发券。');}}else{s.note='消费者重连，但没有可重投的消息；持久优惠券仍为 '+s.coupons+' 张。';}}
 if(phase>=7){s.note=s.retried?ack(false)+'恢复后总计 '+s.coupons+' 张优惠券。':'恢复结束，没有重投。'+(s.coupons===0?'优惠券为 0：提前 ack 后提交失败，事件失去恢复依据。':c.order==='early'?'优惠券为 1：本轮成功不代表提前 ack 能承受提交失败。':'优惠券为 1：先持久提交，再确认，broker 已解除本次责任。');}
 return s;
}

