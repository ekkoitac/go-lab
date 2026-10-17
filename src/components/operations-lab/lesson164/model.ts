export type Config={hard:number;external:number;reserve:number;soft:number;live:number;overhead:number;garbage:number;burst:number};
export type Outcome='hard-risk'|'soft-only'|'within';
export const defaults:Config={hard:1024,external:180,reserve:100,soft:1024,live:600,overhead:80,garbage:400,burst:100};
export const challenge:Config={hard:768,external:120,reserve:80,soft:568,live:520,overhead:80,garbage:220,burst:80};
export function budget(c:Config){return c.hard-c.external-c.reserve;}
export function calculate(c:Config){
 for(const value of Object.values(c))if(!Number.isFinite(value)||value<0)throw new RangeError('Memory inputs must be finite nonnegative MiB');
 const floor=c.live+c.overhead;
 const demand=floor+c.garbage;
 // Illustrative best-effort reclamation, not the Go pacer or real RSS measurement.
 const reclaimed=Math.min(c.garbage,Math.max(0,demand-c.soft));
 const runtime=demand-reclaimed;
 const steady=runtime+c.external;
 const peak=steady+c.burst;
 const softExceeded=runtime>c.soft;
 const hardExceeded=peak>c.hard;
 const outcome:Outcome=hardExceeded?'hard-risk':softExceeded?'soft-only':'within';
 return {budget:budget(c),floor,demand,reclaimed,runtime,steady,peak,headroom:c.hard-peak,softExceeded,hardExceeded,outcome,pressure:floor>=c.soft?'目标不可达':c.soft-floor<100?'回收空间紧张':'仍有回收空间'};
}
export type State={config:Config;phase:number;prediction:{value:Outcome;reason:string}|null};
export function initial(config:Config=defaults):State{return {config:{...config},phase:0,prediction:null};}
export function step(s:State,prediction?:{value:Outcome;reason:string}):State{
 if(s.phase===3)return s;
 if(s.phase===0){if(!prediction?.reason.trim())return s;return {...s,phase:1,prediction:{...prediction,reason:prediction.reason.trim()}};}
 return {...s,phase:s.phase+1};
}
export function back(s:State):State{return s.phase===0?s:{...s,phase:s.phase-1,prediction:s.phase===1?null:s.prediction};}
export const outcomeLabels:Record<Outcome,string>={'hard-risk':'计入突发后超硬预算','soft-only':'未超硬预算，但突破软目标','within':'两条预算均未突破（仅此模型）'};
