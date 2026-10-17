export type Contract = 'valid' | 'expired' | 'none';
export type Local = 'idle' | 'waiting' | 'unknown' | 'confirmed';
export type Action = 'send' | 'lose' | 'receive' | 'same' | 'new' | 'query';
export type Config = { contract: Contract; samePayload: boolean; retryable: boolean; deadline: number; maxAttempts: number };
export type State = { config: Config; local: Local; receipts: {key:string;amount:number}[]; attempts: number; elapsed: number; key: string; event: string; log: string[] };
export const defaults:Config={contract:'valid',samePayload:true,retryable:true,deadline:600,maxAttempts:3};
export function initial(config:Config=defaults):State{return {config:{...config},local:'idle',receipts:[],attempts:0,elapsed:0,key:'pay-1',event:'准备支付：订单 O-152，金额 100 元，稳定键 pay-1。',log:[]};}
export function retryBlock(s:State):string|null{
 if(s.local!=='unknown')return '只有结果未知时才进入重试判定。';
 if(!s.config.retryable)return '错误契约不可重试：停止自动重试，查询或核对。';
 if(s.config.contract!=='valid')return '服务端幂等保障缺失或保留期已过，稳定字符串本身不能阻止再次扣款。';
 if(!s.config.samePayload)return '同键请求内容改变：服务端拒绝冲突，必须核对原订单。';
 if(s.attempts>=s.config.maxAttempts)return '尝试次数已用完（包括首次），停止自动重试。';
 if(s.elapsed+200>s.config.deadline)return '剩余 deadline 不够 100 ms 退避 + 100 ms 请求，停止自动重试。';
 return null;
}
function record(s:State,event:string):State{return {...s,event,log:[...s.log,event]};}
export function transition(state:State,action:Action):State{
 const s:State={...state,config:{...state.config},receipts:state.receipts.map(r=>({...r})),log:[...state.log]};
 if(action==='send'){
  if(s.local!=='idle')return record(s,'首次请求只能发送一次；后续需明确重试或查询。');
  if(s.config.deadline<100||s.config.maxAttempts<1)return record(s,'首次请求也必须有 100 ms 和一次尝试预算。');
  s.attempts=1;s.elapsed=100;s.local='waiting';s.receipts.push({key:'pay-1',amount:100});
  return record(s,'发送 pay-1 → 远端已扣款 100 元 → 响应在途中。本地尚未得到结果。');
 }
 if(action==='lose'||action==='receive'){
  if(s.local!=='waiting')return record(s,'当前没有待投递的支付响应。');
  s.local=action==='lose'?'unknown':'confirmed';
  return record(s,action==='lose'?'响应丢失 → 本地超时、结果未知；远端扣款没有被撤销。':'响应到达 → 本地确认成功；响应不会再次扣款。');
 }
 if(action==='query'){
  if(s.local!=='unknown')return record(s,'先制造结果未知，再查询原订单。');
  if(s.elapsed+100>s.config.deadline)return record(s,'查询也需要 100 ms；本轮预算耗尽，保持未知，交给独立核对流程。');
  s.elapsed+=100;s.local='confirmed';
  return record(s,`按订单 O-152 查询 → 找到 ${s.receipts.length} 笔扣款；没有新增支付。${s.receipts.length>1?'已发现重复扣款，仍需对账处理，查询不会退款。':'本地可以确认原支付。'}`);
 }
 if(s.local!=='unknown')return record(s,'先让响应丢失，才能观察重试分支。');
 if(action==='same'){
  const blocked=retryBlock(s);if(blocked)return record(s,`拦截重试：${blocked}`);
  s.attempts++;s.elapsed+=200;s.local='waiting';s.key='pay-1';
  return record(s,'退避 100 ms → 重发原键 pay-1 和原内容 → 服务端命中原凭证 → 返回原结果，新增扣款 0。');
 }
 if(!s.config.retryable)return record(s,'不可重试错误：新键请求同样被策略拦截。');
 if(s.attempts>=s.config.maxAttempts||s.elapsed+200>s.config.deadline)return record(s,'新键错误示范也受到次数与 deadline 限制；本次没有发送。');
 s.attempts++;s.elapsed+=200;s.key=`pay-${s.attempts}`;s.receipts.push({key:s.key,amount:100});s.local='waiting';
 return record(s,`错误示范：新键 ${s.key} 被当作新支付 → 又扣款 100 元。原 pay-1 的成功没有失效。`);
}
export function reconfigure(s:State,change:Partial<Config>):State{return record({...s,config:{...s.config,...change}},'修改下一次重试的条件；已发生的扣款和已消耗预算保留。');}
export function transferOutcome(choice:string):string{return choice==='query'?'查询旧订单仍为 1 笔扣款；过期的幂等记录不能保证隔天重试去重。查询不新增副作用。':choice==='same'?'同键记录已过期，远端可能把请求当新支付，再扣一次；不能假定稳定键永久有效。':'超时没有撤销昨晚的扣款；换新键会作为新支付，再扣一次。';}
