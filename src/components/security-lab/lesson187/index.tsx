import {useState} from 'react';
import {actionNames,baseline,callerNames,networkOnly,outcomes,trace,type Input,type Outcome,type State} from './model';
import './style.css';
const answerOptions=Object.entries(outcomes).filter(([key])=>key!=='pending');
function Predict({choice,reason,setChoice,setReason}:{choice:string;reason:string;setChoice:(v:string)=>void;setReason:(v:string)=>void}){
  return <div className="sec187-controls"><label>预测三层检查结果<select value={choice} onChange={e=>setChoice(e.target.value)}><option value="">请选择预测</option>{answerOptions.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>预测理由<textarea rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="哪个证据能证明身份？谁有权执行这个动作？"/></label></div>;
}
function Controls({c,onChange}:{c:Input;onChange:(c:Input)=>void}){
  return <div className="sec187-controls"><label>调用方工作负载<select value={c.caller} onChange={e=>onChange({...c,caller:e.target.value as Input['caller']})}>{Object.entries(callerNames).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label><label>连接方式<select value={c.tls} onChange={e=>onChange({...c,tls:e.target.value as Input['tls']})}><option value="server">单向 TLS</option><option value="mutual">双向 TLS（mTLS）</option></select></label><label>客户端证书<select value={c.certificate} onChange={e=>onChange({...c,certificate:e.target.value as Input['certificate']})}><option value="valid">可信签发且有效</option><option value="expired">证书已过期</option><option value="untrusted">非可信签发者</option><option value="missing">没有客户端证书</option></select></label><label>请求动作<select value={c.action} onChange={e=>onChange({...c,action:e.target.value as Input['action']})}>{Object.entries(actionNames).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label><label className="sec187-check"><input type="checkbox" checked={c.network} onChange={e=>onChange({...c,network:e.target.checked})}/>网络策略允许连接</label><label className="sec187-check"><input type="checkbox" checked={c.claim} onChange={e=>onChange({...c,claim:e.target.checked})}/>自报 X-Service: orders</label></div>;
}
function Flow({c,s,focus}:{c:Input;s:State;focus?:number}){
  const gates=[{title:'1 · 网络连通',value:s.network,detail:c.network?'10 网段，路径允许':'路径被网络策略阻断'},{title:'2 · 工作负载身份',value:s.identity,detail:s.principal?`已验证：${callerNames[s.principal]}`:'尚无已验证客户端身份'},{title:'3 · 接口授权',value:s.permission,detail:`请求：${actionNames[c.action]}`}];
  return <div data-testid="live-model" data-state={JSON.stringify({input:c,...s})}><div className="sec187-flow">{gates.map((g,i)=><div className="sec187-gate" key={g.title} data-result={g.value} data-focused={focus===i}><strong>{g.title}</strong><span>{g.detail}</span><b>{g.value==='waiting'?'未执行':g.value==='pass'?'通过':'拒绝'}</b>{i<2&&<small>通过后 ↓</small>}</div>)}</div><p className="sec187-evidence" role="status">{s.note}</p><p>实际业务执行：<strong>{s.outcome==='allowed'?'已执行':'未执行'}</strong></p></div>;
}
function Policy(){return <div className="sec187-policy"><strong>当前可信授权策略</strong><p>订单服务 → 读取 / 预留库存；第三方查询服务 → 只读；普通 Pod → 无库存权限。库存管理接口不对这三个身份授权。</p></div>;}
function Workbench({guided=false}:{guided?:boolean}){
  const [c,setC]=useState<Input>(guided?{...baseline,caller:'orders',action:'admin'}:baseline);
  const [index,setIndex]=useState(0),[choice,setChoice]=useState(''),[reason,setReason]=useState('');
  const [prediction,setPrediction]=useState<{choice:string;reason:string}|null>(null);
  const frames=trace(c),s=frames[index],complete=s.outcome!=='pending';
  const reset=()=>{setIndex(0);setPrediction(null);setChoice('');setReason('');};
  const change=(next:Input)=>{setC(next);reset();};
  const forward=()=>{if(!guided&&!prediction)setPrediction({choice,reason:reason.trim()});setIndex(Math.min(index+1,frames.length-1));};
  return <><p>{guided?'逐步检查订单服务调用管理接口：停在身份认证成功处，再判断是否可以执行业务。':'在同一 10 网段里换调用方和动作，比较只信网络位置与三层检查。先提交预测及理由，再逐步观察。'}</p><Policy/><Controls c={c} onChange={change}/>{!guided&&(prediction?<p className="sec187-prediction">已记录预测：{outcomes[prediction.choice as Outcome]}；理由：{prediction.reason}</p>:<Predict choice={choice} reason={reason} setChoice={setChoice} setReason={setReason}/>)}<div className="sec187-actions"><button data-security-action="step" disabled={complete||(!guided&&!prediction&&(!choice||!reason.trim()))} onClick={forward}>{index===0&&!guided?'记录预测并检查网络':index===0?'检查网络':index===1?'验证工作负载身份':'检查接口授权'}</button><button data-security-action="back" disabled={index===0} onClick={()=>setIndex(index-1)}>回退一步</button><button data-security-action="reset" onClick={reset}>重置推演</button></div><p>步骤 {index} / {frames.length-1}。修改条件会清空本轮推演与预测。</p><Flow c={c} s={s}/><div className="sec187-compare"><article><h4>仅凭内网位置</h4><strong>{index===0?'尚未检查':outcomes[networkOnly(c)]}</strong><p>{index===0?'等待网络检查。':c.network?'旧策略直接放行业务，跳过身份与动作授权。':'无网络连接，业务不能执行。'}</p></article><article><h4>网络 + 身份 + 权限</h4><strong>{outcomes[s.outcome]}</strong><p>{s.principal?'已验证主体：'+callerNames[s.principal]:'没有已验证主体'}；请求头：{c.claim?'orders（自报）':'未提供'}。</p></article></div>{complete&&!guided&&prediction&&<p className="sec187-feedback" role="status">{prediction.choice===s.outcome?'预测与模型一致。':'预测需要修正：你选了“'+outcomes[prediction.choice as Outcome]+'”，实际是“'+outcomes[s.outcome]+'”。'} {s.note} 试着只改变一个条件重做，检验是哪一层改变结论。</p>}</>;
}
function Example(){
  const [badge,setBadge]=useState<'visitor'|'staff'|'expired'>('visitor'),[room,setRoom]=useState<'store'|'control'>('store');
  const c:Input={...baseline,caller:badge==='visitor'?'pod':'orders',certificate:badge==='expired'?'expired':'valid',action:room==='store'?'reserve':'admin'};
  const s=trace(c).at(-1)!;
  return <><p>把集群想成园区：走到仓库门口是网络可达，验证工牌是认证，检查房间权限是授权。“我是仓管”的口头声明不能改写工牌身份。</p><div className="sec187-controls"><label>出示的工牌<select value={badge} onChange={e=>setBadge(e.target.value as typeof badge)}><option value="visitor">有效访客工牌</option><option value="staff">有效仓管工牌</option><option value="expired">过期仓管工牌</option></select></label><label>要进入的房间<select value={room} onChange={e=>setRoom(e.target.value as typeof room)}><option value="store">库存操作间</option><option value="control">管理控制室</option></select></label></div><Flow c={c} s={s}/><p>访客 → 普通 Pod；仓管 → 订单服务；工牌验证 → mTLS；房间规则 → 接口授权。尝试“有效仓管 + 管理控制室”，观察认证通过但授权拒绝。</p><p>类比边界：真实证书还有私钥持有证明、信任链和身份绑定；工牌只是帮助区分三道检查。</p></>;
}
function Diagram(){
  const [c,setC]=useState<Input>({...baseline,caller:'orders'}),[focus,setFocus]=useState(1);
  const s=trace(c).at(-1)!;
  const detail=['连接边：网络策略只控制是否能到达库存端点；切断后后两层均不执行。','身份边：可信证书将工作负载绑定到主体。自报头没有通往主体的可信映射。','授权边：已验证主体与请求动作共同查询策略；同一身份更换动作可以得到不同结果。'];
  return <><p>切换条件让路径重新求值，选择一条关系追踪它的输入与结果。图中“未执行”表示前置关卡没有通过。</p><Controls c={c} onChange={setC}/><div className="sec187-actions" aria-label="选择关系">{['网络 → 连接','证书 → 主体','主体 + 动作 → 权限'].map((t,i)=><button key={t} aria-pressed={focus===i} onClick={()=>setFocus(i)}>{t}</button>)}</div><Flow c={c} s={s} focus={focus}/><p className="sec187-evidence">{detail[focus]}</p><Policy/></>;
}
const challenges=[
  {title:'跨集群查询服务持有可信且未过期的客户端证书，通过 mTLS 读取库存；网络可达，不自报订单服务。',c:{...baseline,caller:'partner',action:'read',claim:false} as Input},
  {title:'同一个第三方查询服务持有效证书，通过 mTLS 请求预留库存，且自报 X-Service: orders。',c:{...baseline,caller:'partner',action:'reserve',claim:true} as Input},
  {title:'订单服务要预留库存，网络可达，启用 mTLS，但证书由未受信的第三方 CA 签发。',c:{...baseline,caller:'orders',certificate:'untrusted'} as Input},
];
function Try(){
  const [index,setIndex]=useState(0),[choice,setChoice]=useState(''),[reason,setReason]=useState(''),[submitted,setSubmitted]=useState(false);
  const item=challenges[index],s=trace(item.c).at(-1)!;
  const next=()=>{setIndex((index+1)%challenges.length);setChoice('');setReason('');setSubmitted(false);};
  return <><p>迁移练习 {index+1} / {challenges.length}：{item.title}</p><Policy/>{!submitted?<><Predict choice={choice} reason={reason} setChoice={setChoice} setReason={setReason}/><button disabled={!choice||!reason.trim()} onClick={()=>setSubmitted(true)}>提交判断并检验</button></>:<><p className="sec187-feedback" role="status">{choice===s.outcome?'结果判断一致':'需要修正判断'}：预测 {outcomes[choice as Outcome]}；实际 {outcomes[s.outcome]}。你的理由：{reason}。{s.note}</p><Flow c={item.c} s={s}/></>}<div className="sec187-actions"><button onClick={next}>换一个新情境</button><button onClick={()=>{setChoice('');setReason('');setSubmitted(false);}}>重做本情境</button></div><p>这是帮助区内的练习，反馈不会记入独立掌握证据。</p></>;
}
export default function Lesson187Lab(){return <section className="sec187" data-testid="security-lab-187"><h3>三道闸门：位置、身份、权限</h3><Workbench/><p className="sec187-boundary">模型边界：假设服务端证书始终可信；mTLS 校验客户端证书及持钥证明，身份由受控签发流程绑定。这里只模拟静态权限，不模拟签发、轮换、撤销、代理转发或密钥泄露。单向 TLS 可配合其他认证机制，本实验未配置。</p></section>;}
export function Lesson187Help({mode}:{mode:'example'|'diagram'|'steps'|'try'}){return <section className="sec187" data-testid="security-help-187" key={mode}>{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Workbench guided/>:<Try/>}</section>;}
