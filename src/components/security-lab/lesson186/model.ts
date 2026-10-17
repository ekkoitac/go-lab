export type Key = 'old' | 'new';
export type NodeId = 'A' | 'B' | 'C';
export type Action = 'publish-A' | 'publish-B' | 'publish-C' | 'switch' | 'issue' | 'wait' | 'retire' | 'emergency';
export interface Ticket {id:number; key:Key; issued:number; expires:number}
export interface Rotation {now:number; ttl:number; skew:number; signer:Key; known:Record<NodeId,Key[]>; tickets:Ticket[]; lastOld:number; revoked:boolean; events:string[]}
export const nodes:NodeId[]=['A','B','C'];
export const keyName=(key:Key)=>key==='old'?'旧钥':'新钥';
export const actions:Record<Action,string>={'publish-A':'给 A 发布新验证钥','publish-B':'给 B 发布新验证钥','publish-C':'给 C 发布新验证钥',switch:'切换为新钥签发',issue:'签发一张票据',wait:'推进 2 分钟',retire:'撤下全部旧验证钥',emergency:'泄露急停：撤销旧钥并切换签发'};
export function initial(ttl=6,skew=2):Rotation {return {now:0,ttl,skew,signer:'old',known:{A:['old'],B:['old'],C:['old']},tickets:[{id:1,key:'old',issued:0,expires:ttl}],lastOld:0,revoked:false,events:['t=0：旧票 #1 签发；A/B/C 只认识旧钥。']};}
export function deadline(s:Rotation){return s.lastOld+s.ttl+s.skew;}
export function verdict(s:Rotation,t:Ticket,node:NodeId):string {
  if(s.revoked&&t.key==='old')return '拒绝：紧急撤销';
  if(s.now>=t.expires+s.skew)return '拒绝：已过有效窗口';
  if(!s.known[node].includes(t.key))return '拒绝：未识别 key ID';
  return '接受';
}
export function countAccepted(s:Rotation,t=s.tickets[s.tickets.length-1]){return nodes.filter(n=>verdict(s,t,n)==='接受').length;}
export function transition(s:Rotation,a:Action):Rotation {
  const n:Rotation={...s,known:{A:[...s.known.A],B:[...s.known.B],C:[...s.known.C]},tickets:[...s.tickets],events:[...s.events]};
  let detail='';
  if(a.startsWith('publish-')){const node=a.slice(-1) as NodeId;const had=n.known[node].includes('new');if(!had)n.known[node].push('new');detail=had?`${node} 已认识新钥，集合未变化。`:`${node} 新增新验证钥，其他实例未自动同步。`;}
  else if(a==='switch'){n.signer='new';const missing=nodes.filter(v=>!n.known[v].includes('new'));detail=missing.length?`签发切到新钥；${missing.join('/')} 尚未收敛，下一张新票会被这些实例拒绝。`:'全部验证端已认识新钥；签发切到新钥，旧票仍可验证。';}
  else if(a==='issue'){const t={id:n.tickets.length+1,key:n.signer,issued:n.now,expires:n.now+n.ttl};n.tickets.push(t);if(n.signer==='old')n.lastOld=n.now;detail=`票 #${t.id} 用${keyName(t.key)}签发，名义过期 t=${t.expires}，含容差到 t<${t.expires+n.skew}；${countAccepted(n,t)}/3 实例接受。`;}
  else if(a==='wait'){n.now+=2;detail=`时间前进到 ${n.now}；票据窗口随时间缩短，验证集合不变。`;}
  else if(a==='retire'){for(const node of nodes)n.known[node]=n.known[node].filter(k=>k!=='old');detail=n.now<deadline(n)?`提前撤旧：旧票仍可能有效到 t<${deadline(n)}，现在会因不认识旧 key ID 被拒。`:n.signer==='old'?'旧票窗口已过，但签发者仍用旧钥！继续签发会制造无法验证的新票。':'旧票最长窗口已结束，旧验证能力可以退出；仍须确认签发端不再使用旧钥。';}
  else {n.revoked=true;n.signer='new';for(const node of nodes)n.known[node]=n.known[node].filter(k=>k!=='old');detail='已标记旧钥泄露并紧急撤销，优先阻断旧钥伪造风险；有效旧会话也失效。新票能否通过仍取决于新验证钥分发。';}
  n.events.push(`t=${n.now} · ${actions[a]}：${detail}`);return n;
}
