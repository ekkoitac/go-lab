export type Caller = 'pod' | 'orders' | 'partner';
export type Action = 'read' | 'reserve' | 'admin';
export type Certificate = 'valid' | 'expired' | 'untrusted' | 'missing';
export type Outcome = 'pending' | 'network' | 'identity' | 'permission' | 'allowed';
export type Gate = 'waiting' | 'pass' | 'deny';
export interface Input {network:boolean; caller:Caller; tls:'server'|'mutual'; certificate:Certificate; claim:boolean; action:Action}
export interface State {stage:number; network:Gate; identity:Gate; permission:Gate; principal:Caller|null; outcome:Outcome; note:string}
export const callerNames:Record<Caller,string>={pod:'普通 Pod',orders:'订单服务',partner:'第三方查询服务'};
export const actionNames:Record<Action,string>={read:'读取库存',reserve:'预留库存',admin:'库存管理接口'};
export const outcomes:Record<Outcome,string>={pending:'尚未得出结论',network:'网络层拒绝',identity:'身份认证拒绝',permission:'接口授权拒绝',allowed:'业务执行成功'};
export const baseline:Input={network:true,caller:'pod',tls:'mutual',certificate:'valid',claim:true,action:'reserve'};
export function initial():State{return {stage:0,network:'waiting',identity:'waiting',permission:'waiting',principal:null,outcome:'pending',note:'尚未执行。请求头可以自报订单服务，但身份只能由可信凭据建立。'};}
export function permitted(caller:Caller,action:Action):boolean{return caller==='orders'&&action!=='admin'||caller==='partner'&&action==='read';}
export function step(c:Input,s:State):State{
  if(s.outcome!=='pending')return s;
  if(s.stage===0)return {...s,stage:1,network:c.network?'pass':'deny',outcome:c.network?'pending':'network',note:c.network?'网络可达：连接到库存服务；仍未证明调用方是谁。':'网络策略阻断连接；TLS 和业务授权均未执行。'};
  if(s.stage===1){
    const ok=c.tls==='mutual'&&c.certificate==='valid';
    const why=c.tls==='server'?'单向 TLS 只验证了服务端，本模型没有额外的客户端认证。':c.certificate==='expired'?'客户端证书已过期，不能建立当前有效身份。':c.certificate==='untrusted'?'客户端证书的签发者不在信任根集合中。':'客户端未提供身份证书。';
    return {...s,stage:2,identity:ok?'pass':'deny',principal:ok?c.caller:null,outcome:ok?'pending':'identity',note:ok?`mTLS 认证成功：可信签发流程绑定的身份是${callerNames[c.caller]}。${c.claim?'自报 X-Service: orders 不参与身份映射。':''}尚未检查动作权限。`:why+' 自报 X-Service 不能替代身份认证。'};
  }
  const ok=s.principal!==null&&permitted(s.principal,c.action);
  return {...s,stage:3,permission:ok?'pass':'deny',outcome:ok?'allowed':'permission',note:ok?`${callerNames[s.principal!]}有权${actionNames[c.action]}，执行业务。`:`身份已验证为${callerNames[s.principal!]}，但策略未授予“${actionNames[c.action]}”；业务不执行。`};
}
export function trace(c:Input):State[]{const states=[initial()];while(states.at(-1)!.outcome==='pending')states.push(step(c,states.at(-1)!));return states;}
export function networkOnly(c:Input):Outcome{return c.network?'allowed':'network';}
