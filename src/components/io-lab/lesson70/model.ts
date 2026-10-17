export type Phase = 'waiting' | 'processing' | 'exited';
export type Choice = 'tick' | 'done';
export type Action = 'tick' | 'step' | 'stop' | 'cancel';
export type Policy = 'stop' | 'both' | 'cancel';
export interface State { clock:number; active:boolean; channel:'open'; done:boolean; ready:boolean; range:Phase; select:Phase; rangeCount:number; selectCount:number; event:string; }
export const labels:Record<Phase,string>={waiting:'等待',processing:'处理 tick',exited:'已退出'};
export function start():State { return {clock:0,active:true,channel:'open',done:false,ready:false,range:'waiting',select:'waiting',rangeCount:0,selectCount:0,event:'两个独立实验使用相同时间条件，worker 都在等待。'}; }
export function transition(s:State,action:Action,choice:Choice='done'):State {
 const n={...s};
 if(action==='stop'){n.active=false;n.ready=false;n.event='Stop 返回：停止后续 tick；C 仍打开，已接收的工作不会被撤销。';return n;}
 if(action==='cancel'){n.done=true;n.event='cancel 关闭 Done；只有监听 Done 的 worker 才能在执行 select 时退出。';return n;}
 if(action==='tick'){n.clock++;n.ready=n.active;n.event=n.active?'逻辑时间前进一个周期：到达接收机会。慢消费者可能错过 tick，不累积无限队列。':'逻辑时间前进，但源已停止：没有新的 tick，C 依然打开。';return n;}
 let sawTick=false;
 if(s.range==='processing'){n.range='waiting';n.rangeCount++;}
 else if(s.range==='waiting'&&s.ready){n.range='processing';sawTick=true;}
 if(s.select==='processing'){n.select='waiting';n.selectCount++;}
 else if(s.select==='waiting'){
  if(s.done&&(!s.ready||choice==='done'))n.select='exited';
  else if(s.ready){n.select='processing';sawTick=true;}
 }
 n.ready=false;
 n.event=s.done&&s.ready&&s.select==='waiting'?`两个 case 都就绪，本次演示选择 ${choice}；这不是优先级保证。`:sawTick?'等待方接收 tick，进入处理；下一步完成本次工作。':n.select==='exited'&&s.select!=='exited'?'select 收到 Done，执行 return；range 无法观察 Done，仍等待 C。':'完成当前处理或继续等待；等待 C 不等于等待通道关闭通知已经到达。';
 return n;
}
export function plan(policy:Policy):Action[]{return ['tick','step','step',...(policy==='stop'?['stop'] as Action[]:policy==='both'?['stop','cancel'] as Action[]:['cancel'] as Action[]),'step'];}
export function run(policy:Policy):State{return plan(policy).reduce((s,a)=>transition(s,a),start());}
export function outcome(s:State){return s.select==='exited'?(s.active?'source-running':'select-exited'):'both-waiting';}
export const outcomes:Record<string,string>={'both-waiting':'源停止；两个 worker 仍等待','select-exited':'源停止；仅 select worker 退出','source-running':'select worker 退出；源仍运行'};
