import {useState} from 'react';
import {back,defaults,initial,inspect,memoryMB,stages,step,verdict,type Config,type Entry,type Snapshot} from './model';
import './style.css';

function Cell({title,entry,time}:{title:string;entry:Entry|null;time:number}) {
  return <div className={`cm141-cell ${entry&&entry.price===100?'cm141-old':''}`}><span>{title}</span><strong>{entry?`${entry.price} 元`:'空'}</strong><small>{entry?entry.expires<=time?'已过期，下一次读才重载':`到 t=${entry.expires} 过期`:'下次读取需向下一层取值'}</small></div>;
}
function Board({config,state}:{config:Config;state:Snapshot}){
  return <div className="cm141-board">
    <div className="cm141-processes">{config.scheme==='shared'?<><div className="cm141-cell"><span>Go 实例 A</span><strong>无 L1</strong></div><div className="cm141-cell"><span>Go 实例 B</span><strong>无 L1</strong></div></>:<><Cell title="实例 A · 独立 L1" entry={state.a} time={state.time}/><Cell title="实例 B · 独立 L1" entry={state.b} time={state.time}/></>}</div>
    <div className="cm141-path">↓ {config.scheme==='local'?'各自未命中才回源':config.scheme==='shared'?'每次读取经过共享层':'读取下一层；L1 命中会跳过共享层'}</div>
    {config.scheme!=='local'&&<><Cell title="共享 Redis · TTL 60 秒" entry={state.shared} time={state.time}/><div className="cm141-path">↓ 共享未命中才回源</div></>}
    <div className="cm141-authority"><span>权威数据库</span><strong>{state.database} 元</strong><span>订单在这里校验</span></div>
    <div className="cm141-stats"><span>共享层读取 <b>{state.networkReads}</b></span><span>数据库读取 <b>{state.databaseReads}</b></span><span>L1 总预算 <b>{memoryMB(config).toLocaleString()} MB</b></span></div>
    {state.lastRead&&<div className={state.lastRead.price!==state.database?'cm141-warning':'cm141-success'}>t={state.lastRead.time}，用户从 {state.lastRead.instance} 看到 <strong>{state.lastRead.price} 元</strong> · {state.lastRead.source}</div>}
    {state.checkout!==null&&<div className="cm141-success">订单权威校验：{state.checkout} 元</div>}
  </div>;
}
export default function Lab(){
  const [timeline,setTimeline]=useState(()=>initial());const [prediction,setPrediction]=useState<'fresh'|'stale'|''>('');const [reason,setReason]=useState('');
  const {config,phase}=timeline,state=inspect(config,phase),result=verdict(state);
  const change=(patch:Partial<Config>)=>{setTimeline(initial({...config,...patch}));setPrediction('');setReason('');};
  const reset=()=>{setTimeline(initial());setPrediction('');setReason('');};
  return <section className="cm141" data-testid="cache-message-lab-141">
    <h3>切换实例，为什么价格没跟着变？</h3><p>价格在 t=1 从 100 改为 120。让用户先访问 A 再切到 B，检验 t=6 时是否满足“更新后 5 秒内一致”。</p>
    <fieldset disabled={phase>0} className="cm141-config"><legend>控制缓存路径与失效条件</legend>
      <label>缓存架构<select value={config.scheme} onChange={e=>change({scheme:e.target.value as Config['scheme']})}><option value="local">独立进程缓存</option><option value="shared">共享 Redis</option><option value="layered">本地 L1 + 共享 L2</option></select></label>
      <label>L1 TTL<select value={config.ttl} disabled={config.scheme==='shared'} onChange={e=>change({ttl:Number(e.target.value)})}><option value={60}>60 秒</option><option value={3}>3 秒</option></select></label>
      <label>实例数量<select value={config.instances} onChange={e=>change({instances:Number(e.target.value)})}><option value={3}>3</option><option value={30}>30</option><option value={100}>100</option></select></label>
      {config.scheme!=='local'&&<label className="cm141-check"><input type="checkbox" checked={config.invalidateShared} onChange={e=>change({invalidateShared:e.target.checked})}/>共享失效成功</label>}
      {config.scheme==='layered'&&<label className="cm141-check"><input type="checkbox" checked={config.broadcast} onChange={e=>change({broadcast:e.target.checked})}/>B 收到 L1 失效广播</label>}
    </fieldset>
    <div className="cm141-predict"><label>先预测：t=6，B 会返回什么？<select disabled={phase>0} value={prediction} onChange={e=>setPrediction(e.target.value as typeof prediction)}><option value="">请选择预测</option><option value="fresh">120 元，已更新</option><option value="stale">100 元，仍陈旧</option></select></label><label>理由：哪一层会命中或过期？<textarea disabled={phase>0} value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：B 的副本没有收到失效，且……"/></label></div>
    <div className="cm141-actions"><button data-cm-action="step" disabled={phase===stages.length-1||!prediction||!reason.trim()} onClick={()=>setTimeline(step(timeline,{value:prediction as 'fresh'|'stale',reason}))}>{phase===0?'记录预测并开始':'执行下一步'}</button><button data-cm-action="back" disabled={phase===0} onClick={()=>setTimeline(back(timeline))}>回退一步</button><button data-cm-action="reset" onClick={reset}>重置基线</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({...state,config,result,prediction:timeline.prediction})}><h4>{phase+1}/{stages.length} · {stages[phase]}</h4><Board config={config} state={state}/></div>
    <p className="cm141-evidence" aria-live="polite">{state.note}</p>
    {result!=='pending'&&<div className={result==='stale'?'cm141-warning':'cm141-success'} role="status"><strong>{timeline.prediction?.value===result?'预测与本轮证据一致':'预测需要修正'}：t=6 的 B {result==='stale'?'仍读到 100 元，未守住 5 秒承诺':'读到 120 元，本轮守住 5 秒承诺'}。</strong><p>你的理由：{timeline.prediction?.reason}</p><p>{result==='stale'?'回退到起点，沿 B 的读取路径找出仍旧的那一层，再修改 TTL 或失效条件。':'继续试试：保留短 L1 TTL，但取消共享失效。短 TTL 能保证读到新源吗？'}</p></div>}
    <p className="cm141-note">教学模型：顺序执行、无网络耗时与竞态；共享 TTL 固定 60 秒，失效在 t=1 生效。A、B 是代表实例，每份 L1 按 200 MB 配置预算计算；未实测延迟或吞吐。本轮成功不能证明生产一致性上界，真实协议还需处理在途旧值回填、版本与失效补偿。练习只保存局部状态，不计正式成绩。</p>
  </section>;
}
function ExampleHelp(){
  const [immutable,setImmutable]=useState(false);const c={...defaults,immutable},s=inspect(c,5);
  return <><h4>换情境：同样的 60 秒本地缓存</h4><label>被缓存的内容<select value={immutable?'immutable':'mutable'} onChange={e=>setImmutable(e.target.value==='immutable')}><option value="mutable">会改价的商品 /price/42</option><option value="immutable">不可变版本内容 /image/hash-v1</option></select></label><div className="cm141-compare"><div>同一键的权威值<strong>{s.database}</strong></div><div>B 的缓存值<strong>{s.lastRead?.price}</strong></div></div><p className={verdict(s)==='stale'?'cm141-warning':'cm141-success'}>{immutable?'同一版本键不修改，旧键的缓存仍正确；更新图片要使用新版本键。':'同一商品键更新了，B 的 60 秒旧副本违反 5 秒要求。'}</p><p>控制变量：缓存位置、TTL 和访问时刻相同。改变的是“同一个键会不会变”，因此长缓存是否合适也会变。</p></>;
}
function DiagramHelp(){
  const [delivered,setDelivered]=useState(false);const c={...defaults,scheme:'layered' as const,broadcast:delivered};const s=inspect(c,4);
  return <><h4>沿着读取路径找旧副本</h4><button aria-pressed={delivered} onClick={()=>setDelivered(!delivered)}>{delivered?'让 B 漏收失效':'把失效事件送到 B'}</button><div className="cm141-event">DB 更新 → 共享失效 ✓ → B 的 L1 {delivered?'失效 ✓':'未收到 ×'}</div><Board config={c} state={s}/><p>B 的 L1 {delivered?'被清空，所以读取已更新的共享层。':'命中 100，所以这次请求根本没有到共享层。'}连线描述读取依赖；失效事件负责改变副本状态。</p></>;
}
function StepsHelp(){
  const [phase,setPhase]=useState(0);const c={...defaults,scheme:'layered' as const,broadcast:true,ttl:3},s=inspect(c,phase);
  return <><h4>亲手走一遍更新协议</h4><ol className="cm141-step-list">{stages.slice(0,7).map((stage,i)=><li key={stage} aria-current={phase===i?'step':undefined}>{phase>i?'✓ ':phase===i?'→ ':''}{stage}</li>)}</ol><div className="cm141-actions"><button disabled={phase>=6} onClick={()=>setPhase(phase+1)}>执行协议下一步</button><button disabled={!phase} onClick={()=>setPhase(phase-1)}>回退</button><button onClick={()=>setPhase(0)}>重置</button></div><div className="cm141-compare"><div>数据库<strong>{s.database}</strong></div><div>B 的 L1<strong>{s.b?.price??'空'}</strong></div><div>共享缓存<strong>{s.shared?.price??'空'}</strong></div></div><p aria-live="polite">{s.note}</p><p>顺序示意没有证明并发安全；实际系统还要用版本等机制拒绝在途旧结果重新填回。</p></>;
}
function TryHelp(){
  const [ttl,setTtl]=useState(3);const [invalidation,setInvalidation]=useState(false);const [answer,setAnswer]=useState('');const [reason,setReason]=useState('');const [checked,setChecked]=useState(false);
  const c={...defaults,scheme:'layered' as const,ttl,invalidateShared:invalidation,broadcast:false},s=inspect(c,5),v=verdict(s);
  const clear=()=>{setChecked(false);setAnswer('');setReason('');};
  return <><h4>找反例：短 L1 TTL 就足够？</h4><p>B 漏收广播；共享层 TTL 仍为 60 秒。设置条件后，先预测再检验。</p><label>L1 TTL<select value={ttl} onChange={e=>{setTtl(Number(e.target.value));clear();}}><option value={3}>3 秒</option><option value={60}>60 秒</option></select></label><label className="cm141-check"><input type="checkbox" checked={invalidation} onChange={e=>{setInvalidation(e.target.checked);clear();}}/>共享失效成功</label><label>t=6，B 返回<select value={answer} onChange={e=>{setAnswer(e.target.value);setChecked(false);}}><option value="">先选结果</option><option value="fresh">120 元</option><option value="stale">100 元</option></select></label><label>解释原因<textarea value={reason} onChange={e=>{setReason(e.target.value);setChecked(false);}} placeholder="L1 过期后从哪里重新取值？"/></label><button disabled={!answer||!reason.trim()} onClick={()=>setChecked(true)}>验证反例</button>{checked&&<div role="status"><p className={v==='stale'?'cm141-warning':'cm141-success'}>{answer===v?'预测吻合':'修正预测'}：实际 {s.lastRead?.price} 元。</p><p>{s.lastRead?.source}。{v==='stale'&&!invalidation?'短 L1 过期后仍可从旧 L2 回填；每一层都承担陈旧责任。':v==='stale'?'共享已更新，但 B 的长 TTL 阻止请求到达共享层。':'短 L1 过期且共享层已失效，这条访问轨迹取到新值。'}</p><p>本轮理由：{reason}。这是可重试练习，不计正式成绩。</p></div>}</>;
}
export function Help({mode}:{mode:string}){return <section className="cm141 cm141-help" data-testid="cache-message-help-141">{mode==='example'?<ExampleHelp/>:mode==='diagram'?<DiagramHelp/>:mode==='steps'?<StepsHelp/>:<TryHelp/>}</section>;}
