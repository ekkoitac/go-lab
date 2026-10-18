export type Strategy37='check-first'|'use-first'|'ignore';
export interface Config37 {success:boolean;strategy:Strategy37;name:string;error:string}
export interface State37 {phase:'start'|'loaded'|'checked'|'used'|'done'|'panic';resource:{name:string}|null;error:string|null;checked:boolean;value:string|null;outcome:string|null;reason:string}
export const initial37=():State37=>({phase:'start',resource:null,error:null,checked:false,value:null,outcome:null,reason:'先查看 load 的契约：失败返回 nil 与错误；成功返回可用配置。'});
export function next37(s:State37,c:Config37):State37{
 if(s.phase==='done'||s.phase==='panic')return s;
 if(s.phase==='start')return {...s,phase:'loaded',resource:c.success?{name:c.name}:null,error:c.success?null:c.error,reason:c.success?'load 返回配置与 nil 错误；成功值可用。':'load 返回 nil 与 '+c.error+'；不能访问不存在的配置字段。'};
 const check=(state:State37):State37=>state.error?{...state,checked:true,phase:'done',outcome:'load: '+state.error,reason:'检查 err 非 nil，立即返回带 load 上下文的错误；未访问配置。'}:{...state,checked:true,phase:'checked',reason:'检查 err == nil：符合 load 成功契约，可以使用配置。'};
 const use=(state:State37):State37=>state.resource?{...state,phase:'used',value:state.resource.name,reason:'读取 c.Name = '+state.resource.name+'；配置确实存在。'}:{...state,phase:'panic',outcome:'panic: nil pointer dereference',reason:'访问 nil 的 c.Name 导致 panic。原始错误 '+state.error+' 仍存在，但没有按协议返回给调用者，诊断被 nil 解引用故障遮蔽。'};
 if(s.phase==='loaded')return c.strategy==='check-first'?check(s):use(s);
 if(s.phase==='checked')return s.value===null?use(s):{...s,phase:'done',outcome:s.value,reason:'成功结果返回调用者。'};
 if(s.phase==='used')return c.strategy==='use-first'&&!s.checked?check(s):{...s,phase:'done',outcome:s.value,reason:c.strategy==='ignore'?'本次成功所以结果可用；忽略 err 的写法仍无法安全处理失败输入。':'返回成功结果 '+s.value+'。'};
 return s;
}
export function trace37(c:Config37):State37[]{const t=[initial37()];while(!['done','panic'].includes(t.at(-1)!.phase))t.push(next37(t.at(-1)!,c));return t;}
export interface ReadConfig37 {bytes:string;error:'EOF'|'read failure';policy:'data-first'|'error-first'}
export interface ReadState37 {phase:'received'|'processed'|'stopped';bytes:string;n:number;error:string;consumed:string;dropped:string;reason:string}
export function readTrace37(c:ReadConfig37):ReadState37[]{
 const start:ReadState37={phase:'received',bytes:c.bytes,n:c.bytes.length,error:c.error,consumed:'',dropped:'',reason:'Read 允许 n > 0 与 err 同时返回；这里只模拟 ASCII 字节。buf[:n] 是已读到的有效数据。'};
 if(c.policy==='error-first')return [start,{...start,phase:'stopped',dropped:c.bytes,reason:'先见 err 就退出，尚未处理的 '+c.bytes.length+' 个有效字节被丢弃。'}];
 const processed:ReadState37={...start,phase:'processed',consumed:c.bytes,reason:c.bytes.length?'先处理 buf[:n]：'+c.bytes+' 已交给消费者。':'n = 0，没有字节可交给消费者。'};
 return [start,processed,{...processed,phase:'stopped',reason:c.error==='EOF'?'有效数据已处理，再处理 EOF 并结束本次读取。':'有效数据已处理，再上报读取故障；错误不撤销已读到的字节。'}];
}
