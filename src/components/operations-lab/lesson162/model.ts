export type Config = { scenario: 'tail' | 'aggregate'; slowCount: number; aCount: number };
export type Group = { name: string; samples: number[] };
export type State = { config: Config; step: number; groups: Group[]; samples: number[]; buckets: number[]; p99: number | null; rank: number | null; message: string };
export const bounds = [20, 40, 100, 500, 1000, 2000];
export const stages = ['采集各实例样本', '相加同边界的桶', '定位全站第 99 百分位', '关联慢请求的分段'];
export function quantile(samples: number[], p = .99): number | null {
 if (!samples.length) return null;
 if (!(p > 0 && p <= 1)) throw new RangeError('p must be in (0, 1]');
 return [...samples].sort((a,b)=>a-b)[Math.ceil(p*samples.length)-1];
}
export function mean(samples: number[]): number | null {return samples.length ? samples.reduce((a,b)=>a+b,0)/samples.length : null}
// Non-cumulative bins. All instances use the same boundaries.
export function histogram(samples: number[]): number[] {return bounds.map((end,i)=>samples.filter(v=>v<=end&&(i===0||v>bounds[i-1])).length)}
export function bucketForRank(buckets: number[], p=.99): {lower:number;upper:number}|null {
 const n=buckets.reduce((a,b)=>a+b,0);if(!n)return null;
 const rank=Math.ceil(n*p);let cumulative=0;
 for(let i=0;i<buckets.length;i++){cumulative+=buckets[i];if(cumulative>=rank)return {lower:i?bounds[i-1]:0,upper:bounds[i]}}
 return null;
}
export function generate(config:Config):Group[]{
 if(config.scenario==='tail')return [{name:'实例 A',samples:[...Array(100-config.slowCount).fill(20),...Array(config.slowCount).fill(20+1980/config.slowCount)]}];
 return [{name:'实例 A',samples:Array(config.aCount).fill(20)},{name:'实例 B',samples:[...Array(98).fill(20),2000,2000]}];
}
export function initial(partial:Partial<Config>={}):State {
 const raw={scenario:'tail' as const,slowCount:2,aCount:900,...partial};
 const config:Config={...raw,slowCount:Math.min(10,Math.max(1,Math.round(raw.slowCount)||1)),aCount:Math.min(900,Math.max(1,Math.round(raw.aCount)||1))};
 return {config,step:0,groups:[],samples:[],buckets:bounds.map(()=>0),p99:null,rank:null,message:'先预测全站 P99 是否超过 40ms，再采集样本。'};
}
export function next(state:State):State {
 if(state.step>=4)return state;
 const step=state.step+1;
 if(step===1)return {...state,step,groups:generate(state.config),message:'采集完成：每个实例保留请求数量与时延，样本还未合并。'};
 if(step===2){const samples=state.groups.flatMap(g=>g.samples);const buckets=state.groups.map(g=>histogram(g.samples)).reduce((a,b)=>a.map((v,i)=>v+b[i]),bounds.map(()=>0));return {...state,step,samples,buckets,message:`同边界的桶逐项相加，得到 ${samples.length} 个全站样本；不会平均各实例的 P99。`}}
 if(step===3){const rank=Math.ceil(state.samples.length*.99);const p99=quantile(state.samples);return {...state,step,rank,p99,message:`排序后取第 ${rank} 个 / 共 ${state.samples.length} 个，精确 P99 = ${p99}ms。桶只能定位区间，精确值来自这里保留的原始样本。`}}
 const slow=Math.max(...state.samples);return {...state,step,message:`选中 ${slow}ms 慢请求：服务 20ms + 排队 ${slow-20}ms。此构造样本的尾部来自排队；真实故障还需 trace 证据区分 GC、锁和下游。`};
}
export function run(config:Partial<Config>={}):State {let s=initial(config);for(let i=0;i<4;i++)s=next(s);return s}
export function fanoutRisk(slowProbability:number,fanout:number):number{return 1-(1-slowProbability)**fanout}
