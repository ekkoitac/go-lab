export type Strategy = 'isolated' | 'shared' | 'default';
export interface Config { strategy: Strategy; requests: number; drain: boolean; keepAlive: boolean }
export interface Connection { id: number; owner: string; status: 'busy' | 'idle' | 'closed'; eof: boolean }
export interface State { step: number; request: number; phase: 'ready' | 'dispatch' | 'read' | 'close'; clients: { id: string; transport: string }[]; pools: string[]; connections: Connection[]; opened: number; reused: number; active: number | null; event: string }
export const initialConfig: Config = { strategy: 'isolated', requests: 3, drain: true, keepAlive: true };
export const strategies: {value: Strategy; label: string}[] = [
 {value: 'isolated', label: '每次新建 Client + 独立 Transport'},
 {value: 'shared', label: '多个 Client 共享一个 Transport'},
 {value: 'default', label: '多个 Client 的 Transport 都为 nil'},
];
export function owner(strategy: Strategy, request: number): string {return strategy === 'isolated' ? `T${request}` : strategy === 'default' ? 'DefaultTransport' : '共享 T';}
export function atStep(config: Config, requestedStep: number): State {
 const count = Math.max(2, Math.min(5, Math.trunc(config.requests)));
 const clients = Array.from({length:count}, (_,i)=>({id:`C${i+1}`,transport:owner(config.strategy,i+1)}));
 const state: State = {step:0, request:0, phase:'ready', clients, pools:[...new Set(clients.map(c=>c.transport))], connections:[], opened:0, reused:0, active:null, event:'所有 Client 已配置；连接池为空。发送请求时才建立连接。'};
 const limit = Math.min(count*3, Math.max(0, Math.trunc(requestedStep)));
 for(let step=1;step<=limit;step++) {
  const request=Math.ceil(step/3), phase=(step-1)%3;
  state.step=step; state.request=request;
  const transport=owner(config.strategy,request);
  if(phase===0){
   state.phase='dispatch';
   let connection=state.connections.find(c=>c.owner===transport&&c.status==='idle');
   if(connection){ state.reused++; connection.status='busy';connection.eof=false;state.event=`C${request} → ${transport}：取出空闲连接 #${connection.id}，复用一次。`; }
   else { connection={id:++state.opened,owner:transport,status:'busy',eof:false};state.connections.push(connection);state.event=`C${request} → ${transport}：该池没有空闲连接，新建 #${connection.id}。`; }
   state.active=connection.id;
  } else {
   const connection=state.connections.find(c=>c.id===state.active)!;
   if(phase===1){state.phase='read';connection.eof=config.drain;state.event=config.drain?`请求 ${request}：读到 EOF。Body 仍有 Close 责任；本教学模型在 Close 后展示归还。`:`请求 ${request}：只读一部分，响应还有未消费字节。`;}
   else {state.phase='close';connection.status=config.drain&&config.keepAlive?'idle':'closed';state.event=connection.status==='idle'?`请求 ${request}：Close Body，连接 #${connection.id} 留在 ${transport} 的空闲池。`:`请求 ${request}：Close Body，${!config.drain?'没有读到 EOF':'服务器关闭连接'}；本次连接 #${connection.id} 不可复用。`;state.active=null;}
  }
 }
 return state;
}
export function finalState(config: Config) {return atStep(config, config.requests*3);}
