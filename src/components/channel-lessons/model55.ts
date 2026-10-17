export type Branch55 = 'a'|'b';
export interface Channel55 {nil:boolean;closed:boolean;queue:number[]}
export interface State55 {a:Channel55;b:Channel55;disableEnded:boolean;guard:boolean;status:'running'|'waiting'|'done';received:number[];emptyReads:number;last:string;selected:Branch55|null}
export function initial55():State55 {return {a:{nil:false,closed:true,queue:[0]},b:{nil:false,closed:false,queue:[9]},disableEnded:false,guard:true,status:'running',received:[],emptyReads:0,last:'A 已关闭但仍有真实数据 0；B 开放且有 9。先预测本轮候选。',selected:null};}
export function ready55(s:State55):Branch55[] {return (['a','b'] as const).filter(k=>!s[k].nil&&(s[k].queue.length>0||s[k].closed));}
export function candidate55(s:State55):string {if(s.guard&&s.a.nil&&s.b.nil)return 'exit';return ready55(s).join('+')||'none';}
export function execute55(s:State55,random:()=>number=Math.random):State55 {
 if(s.status==='done')return s;
 if(s.guard&&s.a.nil&&s.b.nil)return {...s,status:'done',selected:null,last:'循环守卫发现 a == nil && b == nil，退出；没有进入 select。'};
 const ready=ready55(s);
 if(!ready.length)return {...s,status:'waiting',selected:null,last:s.a.nil&&s.b.nil?'所有分支为 nil，又没有循环守卫或 default：select 永久等待。':'没有就绪分支，select 等待；开放输入到达数据或关闭后才能继续。'};
 const k=ready[Math.min(ready.length-1,Math.max(0,Math.floor(random()*ready.length)))];const c=s[k];
 if(c.queue.length)return {...s,[k]:{...c,queue:c.queue.slice(1)},status:'running',selected:k,received:[...s.received,c.queue[0]],last:`选择 ${k.toUpperCase()}：收到 ${c.queue[0]}, ok=true。即使值为 0 也是真实数据；${c.closed?'关闭后先排空缓冲。':'该通道仍开放。'}`};
 return {...s,[k]:{...c,nil:s.disableEnded},status:'running',selected:k,emptyReads:s.emptyReads+1,last:`选择 ${k.toUpperCase()}：0, ok=false。${s.disableEnded?'执行 '+k+' = nil，下轮禁用此分支。':'保留关闭引用，下轮仍立即就绪，重复接收可造成空转。'}`};
}
export function supply55(s:State55,k:Branch55):State55 {const c=s[k];if(c.nil||c.closed||c.queue.length>=3||s.status==='done')return s;return {...s,[k]:{...c,queue:[...c.queue,9]},last:`生产者把 9 放入 ${k.toUpperCase()} 的缓冲；等待中的接收现可继续。`};}
export function close55(s:State55,k:Branch55):State55 {const c=s[k];if(c.nil||c.closed||s.status==='done')return s;return {...s,[k]:{...c,closed:true},last:`生产者关闭 ${k.toUpperCase()}；剩余缓冲先读完，之后接收为 0,false。`};}
export interface Direct55 {variable:'nil'|'new';captured:'not-started'|'nil'|'new';result:'not-started'|'waiting'|'received'}
export function initialDirect55():Direct55 {return {variable:'nil',captured:'not-started',result:'not-started'};}
export function direct55(s:Direct55,action:'assign'|'receive'):Direct55 {
 if(action==='assign')return {...s,variable:'new'};
 if(s.result!=='not-started')return s;
 return {...s,captured:s.variable,result:s.variable==='nil'?'waiting':'received'};
}
