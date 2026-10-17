export type Config = {total:number;used:number;reserve:number;inventory:number;price:number;policy:'shared'|'fixed';propagate:boolean;respond:boolean};
export const baseline:Config={total:200,used:50,reserve:20,inventory:60,price:60,policy:'shared',propagate:true,respond:true};
export type Snapshot={now:number;stage:string;budget:number;deadline:number|null;client:boolean;active:string|null;signal:boolean;wasted:number;outcome:'pending'|'success'|'timeout'|'insufficient';statuses:string[];reason:string};
export function allocation(total:number,used:number,reserve:number,steps:number){return steps>0?Math.max(0,Math.floor((total-used-reserve)/steps)):0;}
export function simulate(c:Config):Snapshot[]{
  let s:Snapshot={now:c.used,stage:'等待分配',budget:0,deadline:null,client:c.used<c.total,active:null,signal:false,wasted:0,outcome:'pending',statuses:['未开始','未开始'],reason:'先扣除已耗时间与回包预留，再给两个串行调用分配预算。'};
  const trace:Snapshot[]=[];
  const push=(patch:Partial<Snapshot>)=>{s={...s,...patch,statuses:[...(patch.statuses??s.statuses)]};trace.push(s);};
  push({});
  if(!s.client){push({outcome:'timeout',stage:'父请求已到期',reason:'开始时父请求已到 deadline，不再启动下游。'});return trace;}
  const names=['库存','价格'];const costs=[c.inventory,c.price];
  for(let i=0;i<2;i++){
    const budget=c.policy==='shared'?allocation(c.total,s.now,c.reserve,2-i):1000;
    if(budget<=0){push({budget:0,stage:'预算不足',outcome:'insufficient',reason:'剩余时间不足以保留回包开销；拒绝启动新的下游调用。'});return trace;}
    const local=s.now+budget;const deadline=c.propagate?Math.min(local,c.total):local;
    const statuses=[...s.statuses];statuses[i]='运行中';
    push({budget,deadline,active:names[i],stage:`启动${names[i]}`,statuses,reason:c.policy==='shared'?`(${c.total} − ${s.now} − ${c.reserve}) ÷ ${2-i} = ${budget}ms；子 deadline 为 ${deadline}ms。`:`局部固定 1000ms；${c.propagate?'继承父期限，实际截止时间被截短':'使用独立 context，父期限不再约束子调用'}。`});
    const completion=s.now+costs[i];
    const signalTime=Math.min(deadline,c.total);
    if(completion>=signalTime){
      const parentFirst=c.total<=deadline;const receives=deadline<=c.total||c.propagate;
      const stopped=receives&&c.respond;
      const next=[...s.statuses];next[i]=stopped?'已取消':receives?'忽略取消，仍运行':'未收到父取消，仍运行';
      push({now:signalTime,client:signalTime<c.total,signal:receives,active:stopped?null:names[i],statuses:next,stage:parentFirst?'父 deadline 到达':'子预算耗尽',outcome:'timeout',reason:`${parentFirst?'父请求到期':'子调用到期'} → ${receives?'取消信号送达':'父取消未传递'} → ${stopped?'I/O 响应并停止；后续调用跳过':'I/O 继续占用资源；取消并不强杀 goroutine'}。`});
      if(!stopped){
        if(!receives && deadline<=completion){
          const localStatuses=[...s.statuses];localStatuses[i]=c.respond?'已取消':'忽略局部取消，仍运行';
          push({now:deadline,signal:true,active:c.respond?null:names[i],statuses:localStatuses,wasted:deadline-signalTime,stage:'局部 deadline 到达',reason:c.respond?'虽然父取消丢失，但独立子超时仍会生效；I/O 响应局部取消并释放。':'独立子超时也已发出取消，但 I/O 仍然不响应。'});
          if(c.respond)return trace;
        }
        if(signalTime<c.total&&completion>c.total)push({now:c.total,client:false,stage:'客户端离开',reason:'父 deadline 已过，但正在执行的 I/O 没有响应取消，仍占用资源。'});
        const done=[...s.statuses];done[i]='迟到结果丢弃';
        push({now:completion,client:completion<c.total,active:null,wasted:Math.max(0,completion-signalTime),statuses:done,stage:'无用工作结束',reason:`已失败后又消耗 ${completion-signalTime}ms；结果丢弃，不启动下一串行调用。`});
      }
      return trace;
    }
    const done=[...s.statuses];done[i]='完成';
    push({now:completion,active:null,statuses:done,stage:`${names[i]}完成`,reason:`${names[i]}用了 ${costs[i]}ms，剩余 ${c.total-completion}ms；后续预算从当前时间重新计算。`});
  }
  const finish=s.now+c.reserve;
  push({now:Math.min(finish,c.total),client:finish<=c.total,active:null,stage:'回包',outcome:finish<=c.total?'success':'timeout',reason:finish<=c.total?`回包使用预留 ${c.reserve}ms，在 ${finish}ms 完成。`:'回包开销超出父期限，不能把下游成功当作整个请求成功。'});
  return trace;
}

