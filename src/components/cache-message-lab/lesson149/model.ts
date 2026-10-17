export type Route = 'global' | 'order' | 'round-robin';
export type Workers = 'serial' | 'parallel';
export type Workload = 'balanced' | 'hot';
export type Order = 'A' | 'B';
export interface Config {route:Route; workers:Workers; guard:boolean; workload:Workload}
export interface Event {id:string; order:Order; version:number; name:string; duration:number; partition:number}
export interface Running {event:Event; remaining:number}
export interface Completion {id:string; order:Order; tick:number; version:number; accepted:boolean; before:number; after:number; explanation:string}
export interface Snapshot {tick:number; queues:Event[][]; running:Running[][]; versions:Record<Order,number>; completed:Completion[]; rejected:string[]; violations:number; peakConcurrency:number; note:string; done:boolean}
export type Result = 'ordered' | 'unordered' | 'blocked';
export interface Prediction {value:Result; reason:string}
export interface Timeline {config:Config; phase:number; prediction?:Prediction}
export const defaults:Config={route:'order',workers:'parallel',guard:false,workload:'balanced'};
export const stateNames=['不存在','已创建','已付款','已发货','已完成'];
function validate(config:Config){if(!['global','order','round-robin'].includes(config.route)||!['serial','parallel'].includes(config.workers)||!['balanced','hot'].includes(config.workload)||typeof config.guard!=='boolean')throw new Error('无效实验配置');}
export function events(config:Config):Event[]{validate(config);return [0,1,2,3].map((i)=>{const order:Order=config.workload==='hot'||i<2?'A':'B';const version=config.workload==='hot'?i+1:i%2+1;return {id:`${order}-v${version}`,order,version,name:['创建','付款','发货','完成'][version-1],duration:version===1?3:1,partition:config.route==='global'?0:config.route==='order'?(order==='A'?0:1):i%2};});}
export function initial(config:Config=defaults):Timeline {validate(config);return {config:{...config},phase:0};}
export function inspect(config:Config,phase:number):Snapshot {
 validate(config);if(!Number.isInteger(phase)||phase<0||phase>12)throw new Error('无效时间步');
 const count=config.route==='global'?1:2;
 const state:Snapshot={tick:0,queues:Array.from({length:count},()=>[]),running:Array.from({length:count},()=>[]),versions:{A:0,B:0},completed:[],rejected:[],violations:0,peakConcurrency:0,note:'四条消息已按生产顺序入队；先预测完成顺序，再推进时间。',done:false};
 events(config).forEach(event=>state.queues[event.partition].push(event));
 for(let tick=1;tick<=phase&&!state.done;tick++){
  state.tick=tick;const notes:string[]=[];
  state.running.forEach((running,p)=>{const capacity=config.workers==='serial'?1:2;while(running.length<capacity&&state.queues[p].length){const event=state.queues[p].shift()!;running.push({event,remaining:event.duration});notes.push(`P${p} 派发 ${event.id}，需 ${event.duration} 拍`);}});
  state.peakConcurrency=Math.max(state.peakConcurrency,state.running.reduce((n,items)=>n+items.length,0));
  state.running.forEach((running,p)=>{
   const finished:Running[]=[];running.forEach(item=>{item.remaining--;if(item.remaining===0)finished.push(item);});
   finished.forEach(({event})=>{
    const before=state.versions[event.order];const inOrder=event.version===before+1;const accepted=!config.guard||inOrder;
    const explanation=accepted?(inOrder?`${event.id} 完成：订单 ${event.order} v${before} → v${event.version}`:`${event.id} 越序完成：需要 v${event.version-1}，实际 v${before}；仍强行覆盖到 v${event.version}`):`${event.id} 被拒绝：需要 v${event.version-1}，实际 v${before}；进入待恢复清单，尚未生效`;
    if(!inOrder)state.violations++;
    if(accepted)state.versions[event.order]=event.version;else state.rejected.push(event.id);
    state.completed.push({id:event.id,order:event.order,tick,version:event.version,accepted,before,after:state.versions[event.order],explanation});notes.push(explanation);
   });state.running[p]=running.filter(item=>item.remaining>0);
  });
  const active=state.running.flat().map(item=>`${item.event.id} 剩 ${item.remaining} 拍`);if(active.length)notes.push(`仍在执行：${active.join('、')}`);
  state.done=state.queues.every(q=>!q.length)&&state.running.every(q=>!q.length);
  state.note=`第 ${tick} 拍：${notes.join('；')}。${state.done?'所有本轮尝试结束。':''}`;
 }
 return state;
}
export function result(state:Snapshot):Result {return state.rejected.length?'blocked':state.violations?'unordered':'ordered';}
export function finalState(config:Config){return inspect(config,12);}
export function step(timeline:Timeline,prediction?:Prediction):Timeline {
 if(inspect(timeline.config,timeline.phase).done)return timeline;
 const recorded=timeline.prediction??prediction;if(!recorded||!['ordered','unordered','blocked'].includes(recorded.value)||!recorded.reason.trim())throw new Error('先记录预测与理由');
 return {...timeline,phase:timeline.phase+1,prediction:{...recorded}};
}
export function back(timeline:Timeline):Timeline {if(!timeline.phase)return timeline;if(timeline.phase===1)return initial(timeline.config);return {...timeline,phase:timeline.phase-1};}
