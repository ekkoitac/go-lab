export type Scenario = 'waiting' | 'cpu';
export type Repair = 'json' | 'connection' | 'none';
export type Tool = 'segments' | 'cpu' | 'trace';
export interface Config { scenario: Scenario; repair: Repair; downstreamSpare: boolean }
export interface Timing { json: number; otherCPU: number; wait: number; other: number }
export interface Prediction { value: 'large' | 'small'; reason: string }
export interface State { config: Config; phase: number; prediction: Prediction | null }
export const defaults: Config = {scenario:'waiting',repair:'json',downstreamSpare:true};
export function baseline(scenario: Scenario): Timing {
  if(scenario==='waiting') return {json:20,otherCPU:60,wait:700,other:20};
  if(scenario==='cpu') return {json:280,otherCPU:20,wait:60,other:20};
  throw new Error('未知场景');
}
export function total(t:Timing){return t.json+t.otherCPU+t.wait+t.other;}
export function validate(c:Config){
  baseline(c.scenario);
  if(!['json','connection','none'].includes(c.repair)||typeof c.downstreamSpare!=='boolean')throw new Error('无效实验条件');
}
export function after(c:Config):Timing{
  validate(c);const t=baseline(c.scenario);
  if(c.repair==='json') t.json*=0.75;
  if(c.repair==='connection'&&c.downstreamSpare)t.wait*=0.25;
  return t;
}
export function evidence(t:Timing,tool:Tool){
  if(tool==='cpu')return [{name:'JSON CPU',ms:t.json},{name:'其他 CPU',ms:t.otherCPU}];
  if(tool==='trace')return [{name:'CPU 执行',ms:t.json+t.otherCPU},{name:'连接等待',ms:t.wait},{name:'其他时段',ms:t.other}];
  return [{name:'JSON CPU',ms:t.json},{name:'其他 CPU',ms:t.otherCPU},{name:'连接等待',ms:t.wait},{name:'其他时段',ms:t.other}];
}
export function outcome(c:Config):Prediction['value']{return total(baseline(c.scenario))-total(after(c))>=200?'large':'small';}
export function initial(config:Config=defaults):State{validate(config);return {config:{...config},phase:0,prediction:null};}
export function step(s:State,prediction?:Prediction):State{
  if(s.phase>=3)return s;
  const p=s.prediction??prediction;
  if(!p||!['large','small'].includes(p.value)||!p.reason.trim())throw new Error('请先预测并填写理由');
  return {...s,phase:s.phase+1,prediction:{...p}};
}
export function back(s:State):State{return s.phase<=1?initial(s.config):{...s,phase:s.phase-1};}
