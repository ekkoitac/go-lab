export type Strategy = 'none' | 'atomic' | 'late';
export interface Receipt { id: string; key: string; amount: number; balance: number }
export interface Snapshot { strategy: Strategy; key: string; amount: number; loseResponse: boolean; phase: number; balance: number; ledger: Receipt[]; records: Record<string, Receipt>; outcome: 'pending'|'new'|'replay'|'conflict'|'invalid'|'insufficient'; receipt: Receipt|null; client: string; notice: string }
export interface State extends Snapshot { history: Snapshot[] }
export function initial(strategy: Strategy = 'none'): State { return { strategy,key:'request-7',amount:10,loseResponse:true,phase:0,balance:100,ledger:[],records:{},outcome:'pending',receipt:null,client:'尚未收到结果',notice:'准备发送：账本与客户端所知是不同视图。',history:[] }; }
function snapshot(state:State):Snapshot { const {history,...rest}=state; void history; return rest; }
function commit(state:State,patch:Partial<Snapshot>):State { return {...state,...patch,history:[...state.history,snapshot(state)]}; }
export function rewind(state:State):State { const prior=state.history.at(-1); return prior ? {...prior,history:state.history.slice(0,-1)} : state; }
export function request(state:State,patch:Partial<Pick<Snapshot,'key'|'amount'|'loseResponse'>>={}):State {
 return commit(state,{...patch,phase:0,outcome:'pending',receipt:null,client:'尚未收到本轮结果',notice:'账本和已存结果保留；开始一轮新请求或重试。'});
}
export function advance(state:State):State {
 if(state.phase>=4)return state;
 if(state.phase===0){
  let outcome:Snapshot['outcome']='new';let receipt:Receipt|null=null;
  const old=Object.hasOwn(state.records,state.key)?state.records[state.key]:undefined;
  if(!state.key.trim()||!Number.isInteger(state.amount)||state.amount<=0)outcome='invalid';
  else if(state.strategy!=='none'&&old){outcome=old.amount===state.amount?'replay':'conflict';if(outcome==='replay')receipt=old;}
  else if(state.amount>state.balance)outcome='insufficient';
  return commit(state,{phase:1,outcome,receipt,notice:outcome==='replay'?'命中同键同金额：取回原收据，不重新计算当前余额。':outcome==='conflict'?'同键异金额：拒绝冲突，账本不变。':outcome==='new'?'新意图：准备执行副作用。':outcome==='invalid'?'请求键不能为空，金额必须为正整数。':'余额不足：不执行扣款。'});
 }
 if(state.phase===1){
  if(state.outcome!=='new')return commit(state,{phase:2,notice:'本轮未新增扣款；保留分类结果。'});
  const receipt={id:`receipt-${state.ledger.length+1}`,key:state.key,amount:state.amount,balance:state.balance-state.amount};
  return commit(state,{phase:2,balance:receipt.balance,ledger:[...state.ledger,receipt],receipt,records:state.strategy==='atomic'?{...state.records,[state.key]:receipt}:state.records,notice:state.strategy==='atomic'?'教学原子提交：扣款与收据一起可见，不存在已扣款但没记录的中间态。':'扣款已发生；此刻尚无对应幂等记录。'});
 }
 if(state.phase===2)return commit(state,{phase:3,records:state.strategy==='late'&&state.outcome==='new'?{...state.records,[state.key]:state.receipt!}:state.records,notice:state.strategy==='late'&&state.outcome==='new'?'扣款之后补存收据；前一步与此步之间存在崩溃窗口。':state.strategy==='none'?'未配置去重，不存可复用的请求结果。':'检查结果存储：新扣款与收据已一起提交，重放仍使用旧收据。'});
 return commit(state,{phase:4,client:state.loseResponse?'响应丢失：客户端不知道本轮结果':state.receipt?`收到 ${state.receipt.id}：amount=${state.receipt.amount}, balance=${state.receipt.balance}`:`收到拒绝：${state.outcome}`,notice:state.loseResponse?'丢失只影响传输；查看账本确认服务器是否已经产生副作用。':'客户端获得本轮响应；收据余额描述原请求完成时，而非当前账本查询。'});
}
export function crash(state:State):State {
 if(state.phase!==2||state.outcome!=='new'||state.strategy!=='late')return state;
 return commit(state,{phase:0,outcome:'pending',receipt:null,client:'连接中断：结果未知',notice:'崩溃窗口：已扣款账本保留，但补存收据未发生。重启后同键被当作新请求。'});
}
export function finish(state:State):State { while(state.phase<4)state=advance(state);return state; }
