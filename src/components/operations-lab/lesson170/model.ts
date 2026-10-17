export type Config = {share:number; reduction:number; memoryExtra:number; tailExtra:number; correct:boolean; comparison:'same'|'load'|'cpu'};
export type Sample = {before:number; after:number};
export type State = {samples:Sample[]; reviewed:boolean};
export const defaults:Config={share:5,reduction:30,memoryExtra:320,tailExtra:35,correct:true,comparison:'same'};
export const initial=():State=>({samples:[],reviewed:false});
export const round=(n:number)=>Math.round(n*100)/100;
export function theoretical(c:Config){
 const saved=c.share*c.reduction/100;
 return {saved:round(saved),before:100,after:round(100-saved),localBefore:c.share,localAfter:round(c.share*(1-c.reduction/100)),other:100-c.share,speedGain:round((100/(100-saved)-1)*100)};
}
export function sample(c:Config,index:number):Sample{
 const noise=[0.5,-0.5,0][index%3];
 const multiplier=c.comparison==='load'?0.8:c.comparison==='cpu'?0.75:1;
 return {before:100+noise,after:round(theoretical(c).after*multiplier+noise)};
}
export function metrics(c:Config,s:State){
 const t=theoretical(c),n=s.samples.length;
 const before=n?s.samples.reduce((a,b)=>a+b.before,0)/n:0;
 const after=n?s.samples.reduce((a,b)=>a+b.after,0)/n:0;
 const saved=n?round((before-after)/before*100):0;
 return {n,before:round(before),after:round(after),saved,memory:256+c.memoryExtra,p99:round(t.after+c.tailExtra),correct:c.correct,comparable:c.comparison==='same'};
}
export function gates(c:Config,s:State){
 const m=metrics(c,s);
 return [
  {key:'conditions',label:'同负载、同工具链与同资源',pass:m.comparable},
  {key:'samples',label:'至少 3 组成对教学样本',pass:m.n>=3},
  {key:'correctness',label:'正确性保持',pass:m.correct},
  {key:'benefit',label:'平均耗时降低 ≥ 1%',pass:m.n>0&&m.saved>=1},
  {key:'memory',label:'内存 ≤ 512 MiB',pass:m.memory<=512},
  {key:'p99',label:'P99 ≤ 120 ms',pass:m.p99<=120},
 ];
}
export function verdict(c:Config,s:State){if(!s.reviewed)return '待验收';return gates(c,s).every(g=>g.pass)?'教学门槛通过，进入真实验证':'暂停发布，修复或回退';}
export function step(c:Config,s:State):State{
 if(s.reviewed)return s;
 if(s.samples.length<3)return {...s,samples:[...s.samples,sample(c,s.samples.length)]};
 return {...s,reviewed:true};
}
export function run(c:Config){let s=initial();for(let i=0;i<4;i++)s=step(c,s);return s;}
