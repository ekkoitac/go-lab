export type Config = { strategy:'stream'|'readall'; target:'direct'|'memory'; size:number; chunk:number; rate:number; budget:number; limit:number };
export type Transfer = { read:number; written:number; pending:number; peak:number; ticks:number; status:'running'|'done'|'oom'|'limited'|'cancelled'; event:string; message:string };
export const defaults:Config={strategy:'stream',target:'direct',size:10240,chunk:128,rate:64,budget:512,limit:0};
export function initial():Transfer{return {read:0,written:0,pending:0,peak:0,ticks:0,status:'running',event:'ready',message:'先预测下一步，再推动 Reader → 缓冲 → Writer。'};}
export function memory(c:Config,s:Transfer){return (c.strategy==='readall'?s.read:s.read>0?c.chunk:0)+(c.target==='memory'?s.written:0);}
export function step(c:Config,s:Transfer):Transfer{
 if(s.status!=='running')return s;
 const n={...s,ticks:s.ticks+1};
 const cap=c.limit>0?Math.min(c.size,c.limit):c.size;
 const mayWrite=c.strategy==='stream'?s.pending>0:s.read>=cap&&s.written<s.read;
 if(mayWrite){
  if(c.rate===0){n.event='blocked';n.message='Writer 尚未接收当前块，Read 暂停：背压没有让新数据继续堆积。';return n;}
  const bytes=Math.min(c.rate,s.pending);n.pending-=bytes;n.written+=bytes;n.event='write';n.message=`Writer 接收 ${bytes} MiB；${n.pending>0?'当前块还未写完，下一步仍不能读新块。':'当前块已写完，下一步才可继续读取。'}`;
 } else if(s.read<cap){
  const bytes=Math.min(c.chunk,cap-s.read);n.read+=bytes;n.pending+=bytes;n.event='read';n.message=`Reader 读取 ${bytes} MiB。${c.strategy==='readall'?'ReadAll 保留全部已读数据，读完前不输出。':'同一块未写完前不会再读。'}`;
 } else {n.status=c.size>cap?'limited':'done';n.event=n.status;n.message=n.status==='limited'?`达到显式总量上限 ${cap} MiB，停止并标记传输不完整；已写部分不能撤回。`:'输入与待写块均处理完毕，传输完成。';}
 n.peak=Math.max(s.peak,memory(c,n));
 if(n.peak>c.budget){n.status='oom';n.event='oom';n.message=`模型内存 ${n.peak} MiB 超过预算 ${c.budget} MiB。${c.target==='memory'?'内存输出在累积；小 copy buffer 并不限制总内存。':'整体保留输入或块容量超过预算。'}`;}
 return n;
}
export function cancel(s:Transfer):Transfer{return s.status==='running'?{...s,status:'cancelled',event:'cancelled',message:`模拟取消已传播并关闭上游，停止后续读取；已写 ${s.written} MiB 无法收回。`}:s;}
export function run(c:Config){let s=initial();for(let i=0;i<10000&&s.status==='running';i++){s=step(c,s);if(s.event==='blocked')break;}return s;}
export const eventNames:Record<string,string>={read:'读入一块',write:'写出一部分',blocked:'背压等待',oom:'内存超预算',limited:'总量限制停止',done:'传输完成'};

