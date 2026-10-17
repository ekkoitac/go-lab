export interface Trace {id:string; start:number; end:number; error:boolean; hash:number}
export interface Config {capacity:number; wait:number; headPercent:number; prefilter:boolean; budget:number}
export type Status='pending'|'buffered'|'kept'|'head-drop'|'overflow'|'timeout'|'normal-drop'|'budget-drop';
export interface Result {id:string; status:Status; errorKnown:boolean; late:boolean; reason:string}
export const traces:Trace[]=[
  {id:'A',start:0,end:1,error:false,hash:10}, {id:'B',start:0,end:2,error:true,hash:70},
  {id:'C',start:1,end:3,error:false,hash:30}, {id:'D',start:2,end:6,error:true,hash:80},
  {id:'E',start:3,end:4,error:false,hash:40}, {id:'F',start:4,end:5,error:true,hash:90},
];
export const defaults:Config={capacity:3,wait:3,headPercent:50,prefilter:false,budget:3};
export function simulate(config:Config,tick:number,input:Trace[]=traces) {
  const tail:Result[]=input.map(t=>({id:t.id,status:'pending',errorKnown:false,late:false,reason:'尚未到达'}));
  const log:string[]=[];let peak=0;
  const kept=()=>tail.filter(r=>r.status==='kept');
  for(let time=0;time<=tick;time++){
    // End spans arriving at the deadline are accepted before expiration.
    for(let i=0;i<input.length;i++){
      const t=input[i],r=tail[i];
      if(t.end!==time)continue;
      if(r.status==='buffered'){
        r.errorKnown=t.error;
        if(!t.error&&t.hash>=20){r.status='normal-drop';r.reason='结果正常且未选中正常基线样本';}
        else {
          if(kept().length>=config.budget&&t.error){
            const victim=kept().find(k=>!k.errorKnown);
            if(victim){victim.status='budget-drop';victim.reason='批次存储预算满，为错误样本让位';}
          }
          const room=kept().length<config.budget;
          r.status=room?'kept':'budget-drop';r.reason=room?(t.error?'终态为错误，优先保留':'正常基线样本保留'):'批次存储预算满';
        }
        log.push(`t=${time} ${t.id}：${r.reason}`);
      }else if(r.status==='timeout'){
        r.late=true;r.reason='终态 Span 迟到；本模型不恢复已超时丢弃的 Trace';
        log.push(`t=${time} ${t.id}：终态迟到，无法补回已释放缓存`);
      }
    }
    for(let i=0;i<input.length;i++){
      const t=input[i],r=tail[i];
      if(r.status==='buffered'&&time>=t.start+config.wait){r.status='timeout';r.reason='等待窗口耗尽，未知终态即丢弃';log.push(`t=${time} ${t.id}：等待超时，释放缓存`);}
    }
    for(let i=0;i<input.length;i++){
      const t=input[i],r=tail[i];if(t.start!==time)continue;
      if(config.prefilter&&t.hash>=config.headPercent){r.status='head-drop';r.reason='前置头采已丢弃，尾采无法恢复';}
      else if(tail.filter(v=>v.status==='buffered').length>=config.capacity){r.status='overflow';r.reason='缓存已满，拒收新 Trace；后续 Span 一并忽略';}
      else {r.status='buffered';r.reason=`等待终态，截止 t=${t.start+config.wait}`;}
      log.push(`t=${time} ${t.id}：${r.reason}`);
    }
    peak=Math.max(peak,tail.filter(r=>r.status==='buffered').length);
  }
  const head:Result[]=input.map(t=>({id:t.id,status:tick<t.start?'pending':t.hash<config.headPercent?'kept':'head-drop',errorKnown:tick>=t.end&&t.hash<config.headPercent&&t.error,late:false,reason:tick<t.start?'尚未到达':t.hash<config.headPercent?'入口散列命中，持续采集':'入口已丢弃，结束时无法恢复'}));
  const countErrors=(rows:Result[])=>rows.filter(r=>r.status==='kept'&&r.errorKnown).length;
  return {tick,head,tail,peak,buffered:tail.filter(r=>r.status==='buffered').length,headErrors:countErrors(head),tailErrors:countErrors(tail),late:tail.filter(r=>r.late).length,log,truthErrors:input.filter(t=>t.error&&t.end<=tick).length,completed:input.filter(t=>t.end<=tick).length};
}
export function winner(s:ReturnType<typeof simulate>){return s.tailErrors>s.headErrors?'tail':s.tailErrors<s.headErrors?'head':'same';}
export const transferTraces=traces.map(t=>t.id==='D'?{...t,end:8}:t);
