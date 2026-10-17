export type Evidence = 'message' | 'parent' | 'version';
export type Event = {id:string; process:string; wall:number; mono:number; label:string; message?:string; parent?:string; version?:number; order?:string; effect?:string};
export const rawEvents:readonly Event[] = Object.freeze([
 {id:'O',process:'order',wall:3000,mono:10,label:'创建订单',order:'o9',version:1},
 {id:'S',process:'order',wall:3200,mono:210,label:'发送支付消息',message:'m7',parent:'O'},
 {id:'P',process:'pay',wall:1000,mono:40,label:'消费消息并入账',message:'m7',parent:'S',effect:'tx-1'},
 {id:'R',process:'pay',wall:1800,mono:840,label:'再次收到消息',message:'m7',parent:'S'},
 {id:'U',process:'order',wall:5200,mono:2210,label:'提交订单新版本',parent:'P',order:'o9',version:2},
 {id:'X',process:'audit',wall:900,mono:88,label:'独立审计心跳'},
].map(event=>Object.freeze(event)));
export const evidenceOrder:Evidence[]=['message','parent','version'];
export function eventsFor(doubleCharge=false):Event[]{
 return rawEvents.map(event=>({...event,...(event.id==='R'?{effect:doubleCharge?'tx-2':'tx-1',label:doubleCharge?'重试再次入账':'重试命中原入账结果'}:{})}));
}
export type Edge={from:string;to:string;why:string};
export function edgesFor(evidence:readonly Evidence[]):Edge[]{
 const edges:Edge[]=[];
 if(evidence.includes('message')) edges.push({from:'S',to:'P',why:'m7 生产→消费'},{from:'S',to:'R',why:'m7 生产→再次投递'});
 if(evidence.includes('parent')) edges.push({from:'O',to:'S',why:'parent=O'},{from:'P',to:'U',why:'parent=P'});
 if(evidence.includes('version')) edges.push({from:'O',to:'U',why:'同一订单提交 v1→v2'});
 return edges;
}
export function relation(a:string,b:string,edges:readonly Edge[]):'before'|'after'|'unknown'{
 const reaches=(from:string,to:string,seen=new Set<string>()):boolean=>{if(seen.has(from))return false;seen.add(from);return edges.some(e=>e.from===from&&(e.to===to||reaches(e.to,to,seen)));};
 return a===b?'unknown':reaches(a,b)?'before':reaches(b,a)?'after':'unknown';
}
export function timeline(correction:number,doubleCharge=false){
 const safe=Number.isFinite(correction)?Math.max(-4000,Math.min(4000,correction)):0;
 return eventsFor(doubleCharge).map(e=>({...e,display:e.wall-(e.process==='pay'?safe:0)})).sort((a,b)=>a.display-b.display||a.id.localeCompare(b.id));
}
export function duration(a:Event,b:Event):number|null{return a.process===b.process&&b.mono>=a.mono?b.mono-a.mono:null;}
export function snapshot(correction:number,phase:number,doubleCharge=false){
 const count=Math.max(0,Math.min(3,Math.floor(Number.isFinite(phase)?phase:0)));
 const edges=edgesFor(evidenceOrder.slice(0,count));
 return {phase:count,correction,timeline:timeline(correction,doubleCharge),edges,orderToPayment:relation('O','P',edges),auditToPayment:relation('X','P',edges),charges:new Set(eventsFor(doubleCharge).map(e=>e.effect).filter(Boolean)).size};
}
