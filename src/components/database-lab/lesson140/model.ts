export type Fault = 'rows' | 'transaction' | 'sql';
export type Fix = 'none' | 'close-rows' | 'short-tx' | 'index';
export type Config = {fault:Fault;fix:Fix;pool:number;requests:number};
export type Trace = {id:number;wait:number;sql:number;read:number;total:number};
export type Snapshot = {waitCount:number;waitDuration:number};
export const defaultConfig:Config={fault:'rows',fix:'none',pool:20,requests:4};
export function percentile(values:number[],p=0.99){if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];}
export function windowStats(before:Snapshot,after:Snapshot){const count=after.waitCount-before.waitCount;const duration=after.waitDuration-before.waitDuration;if(count<0||duration<0)return {valid:false,count:0,duration:0,average:null};return {valid:true,count,duration,average:count?duration/count:null};}
/** Simultaneous arrivals, deterministic service, a fixed cohort; this is not measured latency. */
export function simulate(config:Config){
 const pool=Math.max(20,Math.min(28,Math.round(config.pool)));
 const requests=Math.max(1,Math.min(8,Math.round(config.requests)));
 const sql=config.fault==='sql'?(config.fix==='index'?200:850):(config.fix==='index'?15:20);
 const read=config.fault==='sql'?50:30;
 // Four holders represent the diagnosed resource issue. Remaining holders finish at 850ms.
 const blocked=config.fault==='rows'?(config.fix==='close-rows'?0:Infinity):config.fault==='transaction'?(config.fix==='short-tx'?30:850):0;
 const freeAt=Array.from({length:pool},(_,i)=>config.fault==='sql'?0:i<4?blocked:i<20?850:0);
 const traces:Trace[]=[];
 for(let i=0;i<requests;i++){const earliest=Math.min(...freeAt);const slot=freeAt.indexOf(earliest);const wait=Math.max(0,earliest);const total=wait+sql+read;freeAt[slot]=total;traces.push({id:i+1,wait,sql,read,total});}
 const before:Snapshot={waitCount:100,waitDuration:50000};
 const after:Snapshot={waitCount:before.waitCount+traces.filter(t=>t.wait>0).length,waitDuration:before.waitDuration+traces.reduce((n,t)=>n+t.wait,0)};
 return {traces,before,after,window:windowStats(before,after),p99:percentile(traces.map(t=>t.total)),allocation:pool,budget:20,budgetExceeded:pool>20,held:config.fault==='sql'?0:config.fix==='close-rows'&&config.fault==='rows'?16:20,issueHolders:config.fault==='sql'?0:config.fix==='close-rows'&&config.fault==='rows'?0:4};
}
export type State = {config:Config;stage:number};
export function initialState(config:Config=defaultConfig):State{return {config:{...config},stage:0};}
export function step(state:State):State{return {...state,stage:Math.min(4,state.stage+1)};}
export function dominant(trace:Trace){return trace.wait>=trace.sql&&trace.wait>=trace.read?'wait':trace.sql>=trace.read?'sql':'read';}
