export type ReceiveMode54 = 'pair' | 'range' | 'zero';
export type Result54 = {value:number; ok:boolean; processed:boolean};
export type State54 = {queue:number[]; closed:boolean; waiting:boolean; stopped:boolean; mode:ReceiveMode54; results:Result54[]; processed:number[]; event:string; line:'setup'|'send'|'close'|'receive'|'process'|'break'};
export type Action54 = {type:'receive'} | {type:'close'} | {type:'send'; value:number};
export const capacity54=3;
export function initial54(mode:ReceiveMode54='pair', queue:number[]=[0,5]):State54 {
 return {queue:[...queue],closed:false,waiting:false,stopped:false,mode,results:[],processed:[],event:queue.length?'缓冲中已有 '+queue.join('、')+'；先预测，再决定何时关闭或接收。':'开放且缓冲为空；先预测接收会等待还是返回，再尝试唤醒。',line:'setup'};
}
export function outcome54(s:State54):string {
 if(s.queue.length) return `data${s.queue[0]}`;
 return s.closed?'end':'waiting';
}
function complete(s:State54,value:number,ok:boolean):State54 {
 const stopped=s.mode==='zero'?value===0:s.mode==='range'&&!ok;
 const processed=ok&&!stopped;
 const event=!ok ? (s.mode==='range'?'缓冲已排空且通道已关闭：range 结束，循环体没有收到额外的 0。':'缓冲已排空且通道已关闭：接收立即得到 0,false；这不是新消息。') : stopped?'收到 0,true，却因 v==0 提前退出；这条有效消息没被处理，后续缓冲仍保留。':`收到 ${value},true：这是实际发送的值，${value===0?'0 也必须保留。':'进入处理记录。'}`;
 return {...s,waiting:false,stopped,results:[...s.results,{value,ok,processed}],processed:processed?[...s.processed,value]:s.processed,event,line:stopped?'break':processed?'process':'receive'};
}
export function transition54(s:State54,a:Action54):State54 {
 if(a.type==='receive') {
  if(s.stopped||s.waiting) return s;
  if(s.queue.length) return complete({...s,queue:s.queue.slice(1)},s.queue[0]!,true);
  if(s.closed) return complete(s,0,false);
  return {...s,waiting:true,event:'开放且缓冲为空：接收停在这里，尚无 value/ok。后续发送或关闭会唤醒这次接收。',line:'receive'};
 }
 if(a.type==='close') {
  if(s.closed) return s;
  const closed={...s,closed:true,event:`close(ch) 只标记结束，保留 ${s.queue.length} 个缓冲值。`,line:'close' as const};
  return s.waiting?complete(closed,0,false):closed;
 }
 if(s.closed||s.queue.length>=capacity54) return s;
 if(s.waiting) return complete({...s,event:'发送唤醒正在等待的接收。'},a.value,true);
 return {...s,queue:[...s.queue,a.value],event:`发送 ${a.value}，进入队尾。`,line:'send'};
}

