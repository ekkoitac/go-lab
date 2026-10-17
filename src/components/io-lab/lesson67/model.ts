export type Policy = 'read-close' | 'close' | 'read';
export type Result = 'open' | 'released' | 'candidate';
export interface Config { size:number; budget:number; policy:Policy; keepAlive:boolean }
export interface State { config:Config; consumed:number; eof:boolean; closed:boolean; done:boolean; event:string; reads:number }
export const initialConfig:Config={size:4,budget:2,policy:'read-close',keepAlive:true};
export function start(config:Config=initialConfig):State {
 const safe={...config,size:Math.max(0,Math.min(16,Math.floor(config.size)||0)),budget:Math.max(0,Math.min(16,Math.floor(config.budget)||0))};
 return {config:safe,consumed:0,eof:false,closed:false,done:false,reads:0,event:'Do 成功：调用者接手 Body，尚未读取或关闭。'};
}
export function result(s:State):Result {return !s.closed?'open':s.eof&&s.config.keepAlive?'candidate':'released';}
export const resultLabel:Record<Result,string>={open:'仍有关闭责任',released:'已关闭，放弃复用候选',candidate:'已关闭，具备复用候选条件'};
export function read(s:State):State {
 if(s.closed||s.done||s.eof)return s;
 if(s.consumed>=s.config.budget&&s.config.size>s.consumed)return {...s,event:'读取预算耗尽：停止读取，优先限制成本。'};
 const consumed=Math.min(s.config.size,s.consumed+1),eof=consumed===s.config.size;
 return {...s,consumed,eof,reads:s.reads+1,event:eof?'源 Body 返回 EOF：边界已确认，但 Body 仍需关闭。':`读取第 ${consumed} 字节，源 Body 尚未返回 EOF。`};
}
export function close(s:State):State {if(s.closed)return s;return {...s,closed:true,done:true,event:s.eof?'执行 Body.Close：关闭责任完成；是否实际复用仍由 Transport 和连接状态决定。':'执行 Body.Close：本模型不额外 drain，剩余字节未读，放弃复用候选。'};}
export function step(s:State):State {
 if(s.done)return s;
 if(s.config.policy==='close')return close(s);
 if(!s.eof&&(s.consumed<s.config.budget||s.config.size===0))return read(s);
 if(s.config.policy==='read')return {...s,done:true,event:'程序结束却遗漏 Close：即使已读到 EOF，关闭责任也没有完成。'};
 return close(s);
}
export function finish(config:Config):State {let s=start(config);for(let i=0;i<20&&!s.done;i++)s=step(s);return s;}
