export type Scheme='memory'|'mark-first'|'effect-first'|'transaction';
export type Incident='none'|'crash'|'restart'|'other'|'expiry';
export type Config={scheme:Scheme;incident:Incident;key:'event'|'delivery'};
export const defaults:Config={scheme:'effect-first',incident:'crash',key:'event'};
export const stages=['准备同一支付事件','首次投递到 A','执行第一项写入','提交或在窗口崩溃','改变重投条件','再次投递同一事件','检查并执行第一项写入','完成重投'];
export type Snapshot={phase:number;points:number;inbox:string[];seenA:string[];seenB:string[];active:'A'|'B';eventId:string;deliveryId:string;key:string;pending:boolean;skipped:boolean;time:number;note:string};
export type Prediction={value:'0'|'10'|'20';reason:string};
export type Timeline={config:Config;phase:number;prediction:Prediction|null};
function validate(c:Config){if(!['memory','mark-first','effect-first','transaction'].includes(c.scheme)||!['none','crash','restart','other','expiry'].includes(c.incident)||!['event','delivery'].includes(c.key))throw new Error('Invalid configuration');}
export function initial(config:Config=defaults):Timeline{validate(config);return {config:{...config},phase:0,prediction:null};}
export function step(t:Timeline,prediction?:Prediction):Timeline{if(t.phase===0&&(!prediction||!['0','10','20'].includes(prediction.value)||!prediction.reason.trim()))throw new Error('Prediction and reason required');return {...t,phase:Math.min(7,t.phase+1),prediction:t.phase===0?{...prediction!}:t.prediction};}
export function back(t:Timeline):Timeline{return {...t,phase:Math.max(0,t.phase-1),prediction:t.phase<=1?null:t.prediction};}
export function inspect(c:Config,phase:number):Snapshot{
 validate(c);if(!Number.isInteger(phase)||phase<0||phase>7)throw new Error('Invalid phase');
 const s:Snapshot={phase,points:0,inbox:[],seenA:[],seenB:[],active:'A',eventId:'payment-e1',deliveryId:'delivery-1',key:c.key==='event'?'payment-e1':'delivery-1',pending:false,skipped:false,time:0,note:'同一支付事件应只贡献 10 分。先预测完整重投后的积分。'};
 function first(){const records=c.scheme==='memory'?(s.active==='A'?s.seenA:s.seenB):s.inbox;s.skipped=records.includes(s.key);if(s.skipped){s.note=`${s.key} 已存在，跳过副作用。`;return;}if(c.scheme==='transaction'){s.pending=true;s.note='事务暂存 inbox 与 +10；持久数据仍未改变。';}else if(c.scheme==='effect-first'){s.points+=10;s.note='积分已独立提交 +10；inbox 仍为空，存在重复窗口。';}else {records.push(s.key);s.note=c.scheme==='memory'?s.active+' 的内存记住 ID；持久库还未加分。':'inbox 已独立提交；积分尚未增加，存在漏处理窗口。';}}
 function finish(crash:boolean){if(s.skipped)return;if(crash){s.pending=false;s.seenA=[];s.note=c.scheme==='transaction'?'提交前崩溃：事务暂存全部回滚，持久库仍是 0 分、无 inbox。':c.scheme==='mark-first'?'写标记后崩溃：inbox 留下“已处理”，但积分为 0。':c.scheme==='effect-first'?'加分后崩溃：10 分已经持久化，inbox 尚未写入。':'进程崩溃：A 的内存标记丢失，积分尚未增加。';return;}if(c.scheme==='transaction'){s.inbox.push(s.key);s.points+=10;s.pending=false;s.note='同一事务提交 inbox 和 +10；两项同时成为持久结果。';}else if(c.scheme==='effect-first'){s.inbox.push(s.key);s.note='独立写入 inbox 完成；此前的崩溃窗口依旧存在。';}else {s.points+=10;s.note='继续执行加分，积分已持久化。';}}
 if(phase>=1)s.note='收到 payment-e1，投递编号 delivery-1。投递编号不是业务事件身份。';
 if(phase>=2)first();if(phase>=3)finish(c.incident==='crash');
 if(phase>=4){s.pending=false;if(c.incident==='restart'){s.seenA=[];s.note='首次处理后 A 重启：内存清空，持久 inbox 和积分保留。';}else if(c.incident==='other'){s.active='B';s.note='重投转到实例 B：B 不共享 A 的 seen map，持久库由两者共用。';}else if(c.incident==='expiry'){s.time=8;s.inbox=[];s.seenA=[];s.seenB=[];s.note='到第 8 天：7 天去重记录已清理；积分不会跟着撤销。';}else s.note=c.incident==='crash'?'A 重启，broker 准备重投未确认事件。':'首次提交后确认丢失，broker 准备重投。';}
 if(phase>=5){s.deliveryId='delivery-2';s.key=c.key==='event'?s.eventId:s.deliveryId;s.skipped=false;s.note=`仍是 payment-e1，但投递编号变为 delivery-2；本次去重键=${s.key}。`;}
 if(phase>=6)first();if(phase>=7)finish(false);return s;
}
export function outcome(s:Snapshot){return s.phase<7?'pending':String(s.points);}

