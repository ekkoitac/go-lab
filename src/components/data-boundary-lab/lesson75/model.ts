export type Strategy = 'concat' | 'bind';
export type Config = {input:string; tenant:boolean};
export const defaults:Config = {input:'7 OR 1=1',tenant:false};
export const accounts = [{id:7,name:'Ada',tenant:'A'},{id:8,name:'Bo',tenant:'B'},{id:9,name:'Cy',tenant:'A'}];
export function query(config:Config,strategy:Strategy){
 const text=config.input.trim();
 const numeric=/^\d+$/.test(text), injection=/^\d+\s+OR\s+1\s*=\s*1$/i.test(text);
 const supported=strategy==='bind'||numeric||injection;
 const expanded=strategy==='concat'&&injection;
 const predicate=expanded?'OR(id = 输入数字, TRUE)':strategy==='bind'?'id = 参数槽 $1':numeric?'id = 数字':'本模型不解析此语法';
 const rows=supported?accounts.filter(a=>(expanded||(strategy==='bind'?String(a.id)===config.input:numeric&&BigInt(a.id)===BigInt(text)))&&(!config.tenant||a.tenant==='A')):[];
 return {strategy,supported,expanded,predicate,sql:`SELECT id, name FROM accounts WHERE ${config.tenant?'tenant = \'A\' AND (':''}id = ${strategy==='bind'?'?':config.input}${config.tenant?')':''}`,args:strategy==='bind'?[config.input]:[],rows,foreign:rows.some(r=>r.tenant!=='A')};
}
export function snapshot(config:Config,step:number){
 const cursor=Math.max(0,Math.min(3,Math.trunc(step)));
 return {cursor,input:config.input,tenant:config.tenant,lanes:(['concat','bind'] as const).map(strategy=>{
  const q=query(config,strategy);return {...q,sql:cursor>=1?q.sql:'尚未构建',args:cursor>=1?q.args:[],predicate:cursor>=2?q.predicate:'尚未解析',expanded:cursor>=2&&q.expanded,rows:cursor>=3?q.rows:[],foreign:cursor>=3&&q.foreign};
 })};
}
export function outcome(config:Config){const a=query(config,'concat'),b=query(config,'bind');return !a.supported?'unknown':a.rows.length>b.rows.length?'more':'same';}
export type SortStrategy='raw'|'parameter'|'allowlist';
export function sortPlan(input:string,strategy:SortStrategy){
 const allowed=input==='name'||input==='created_at';
 if(strategy==='allowlist')return {accepted:allowed,clause:allowed?`ORDER BY ${input}`:'拒绝：不在 name / created_at 白名单中',column:allowed?input:null,reason:allowed?'枚举映射选中固定标识符':'不把未知输入加入语法'};
 if(strategy==='parameter')return {accepted:false,clause:'ORDER BY ?',column:null,reason:'普通值参数不代表列名；驱动可能拒绝或按常量排序，本模型不判定具体驱动行为'};
 return {accepted:false,clause:`ORDER BY ${input}`,column:null,reason:'用户原文进入结构；即使此样例正常，也没有建立结构白名单'};
}
export function repair(value:Strategy,sort:SortStrategy,tenant:boolean){return {correct:value==='bind'&&sort==='allowlist'&&tenant,query:query({input:'8 OR 1=1',tenant},value),sort:sortPlan('created_at',sort)};}


