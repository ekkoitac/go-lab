export type Strategy59 = 'plain' | 'before' | 'select';
export type Phase59 = 'sending' | 'blocked' | 'cleanup' | 'done';
export type Outcome59 = 'send' | 'block' | 'cancel' | 'clean' | 'done';
export interface State59 { capacity:number; strategy:Strategy59; queue:number[]; next:number; cancelled:boolean; phase:Phase59; cleaned:boolean; confirmed:boolean; last:string }
export function initial59(capacity=0,strategy:Strategy59='plain'):State59 {return {capacity:Math.max(0,Math.min(2,Math.floor(capacity))),strategy,queue:[],next:2,cancelled:false,phase:'sending',cleaned:false,confirmed:false,last:'下游已收到结果 1 并提前离开；上游准备发送结果 2。'};}
export function outcomes59(s:State59):Outcome59[]{
 if(s.phase==='done')return ['done'];
 if(s.phase==='cleanup')return ['clean'];
 if(s.strategy==='before'&&s.cancelled&&s.phase==='sending')return ['cancel'];
 const ready:Outcome59[]=[];
 if(s.queue.length<s.capacity)ready.push('send');
 if(s.strategy==='select'&&s.cancelled)ready.push('cancel');
 return ready.length?ready:['block'];
}
export function step59(s:State59,choice?:Outcome59):State59 {
 const allowed=outcomes59(s);const pick=choice&&allowed.includes(choice)?choice:allowed[0];
 if(pick==='done')return s;
 if(pick==='clean')return {...s,phase:'done',cleaned:true,last:'上游执行清理，释放资源并关闭 done；下游仍需接收 done 确认。'};
 if(pick==='cancel')return {...s,phase:'cleanup',last:'选中取消出口，离开发送循环；清理尚未执行，done 仍未关闭。'};
 if(pick==='block')return {...s,phase:'blocked',last:s.cancelled?'取消已发出，但当前发送没有取消出口，仍等待永远不会来的接收者。':'发送无法完成：下游已退出，通道也没有空位。'};
 const next=s.next+1;return {...s,queue:[...s.queue,s.next],next,phase:next>5?'cleanup':'sending',last:`结果 ${s.next} 放入缓冲，没人消费；${next>5?'生产完毕，准备清理。':`下一条是 ${next}。容量只推迟堵塞。`}`};
}
export function cancel59(s:State59):State59 {return {...s,cancelled:true,last:'下游调用 cancel：通知已经发出，尚不能据此认定上游已退出。'};}
export function confirm59(s:State59):State59 {return {...s,confirmed:s.phase==='done',last:s.phase==='done'?'下游接收到已关闭的 done：确认上游清理并退出。':'下游等待 done，当前 done 尚未关闭；取消通知不等于退出确认。'};}
