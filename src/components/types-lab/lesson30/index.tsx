import {useState} from 'react';
import {initial, inspect, snapshot, repair, maxStep, routes, type Config, type Channel, type Route} from './model';
import './style.css';
const definitions = 'type Sender interface { Send() string }\n// Mail、SMS、Push 均实现 Send() string\nfunc pair[T any](a, b T) []T { return []T{a, b} }\nfunc Clone[T any](in []T) []T {\n  out := make([]T, len(in)); copy(out, in); return out\n}';
function ConfigControls({config, change}: {config:Config; change:(c:Config)=>void}) {
  return <div className="t30-controls">{config.channels.map((ch,i) => <label key={i}>第 {i+1} 个通道<select value={ch} onChange={e => {const next:[Channel,Channel]=[...config.channels]; next[i]=e.target.value as Channel; change({...config, channels:next});}}>{(['Mail','SMS','Push'] as Channel[]).map(x=><option key={x}>{x}</option>)}</select></label>)}<button onClick={()=>change({...config,channels:[config.channels[1],config.channels[0]]})}>交换顺序</button><label>装配方式<select value={config.route} onChange={e=>change({...config,route:e.target.value as Route})}>{routes.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>{config.route==='clone' && <label>输入切片元素类型<select value={config.cloneType} onChange={e=>change({...config,cloneType:e.target.value as Config['cloneType']})}><option>Mail</option><option>Sender</option></select></label>}</div>;
}
function View({config, step}: {config:Config; step:number}) {
  const r=inspect(config), s=snapshot(config,step);
  return <div className="t30-model" data-testid="live-model" data-state={JSON.stringify({config,step,output:s.output})}>
    <div className="t30-flow"><article><small>① 输入实参</small>{config.channels.map((ch,i)=><strong key={i}>{i+1}. {ch}{'{}'}</strong>)}</article><span aria-hidden="true">→</span><article><small>② 静态类型关系</small><strong>{step ? r.allowed ? `元素类型 = ${r.elementType}` : '类型检查未通过' : '待检验'}</strong><span>{step && r.allowed ? `容器：[]${r.elementType}` : '运行前检查入口契约'}</span></article><span aria-hidden="true">→</span><article><small>③ 运行时队列</small>{s.built ? config.channels.map((ch,i)=><span key={i} className={i<s.sent?'t30-sent':''}>{i<s.sent?'✓':'○'} {i+1}. {r.elementType==='Sender'?`Sender → ${ch}`:ch}</span>) : <span>尚未构造</span>}</article></div>
    <div role="status" aria-live="polite"><strong>{s.status}</strong><p>输出：<code>{s.output.length ? s.output.join(',') : '（无）'}</code></p>{step>0 && <p>{step===1 ? r.reason : step===2 ? `只创建容器，尚未调用任何方法。${config.route==='clone'?'复制的是切片元素；这不是递归深拷贝。':''}` : `调用 queue[${s.sent-1}].Send()，${config.channels[s.sent-1]} 实现追加 ${s.output[s.sent-1]}。其他元素尚未执行时不会提前产生输出。`}</p>}</div>
  </div>;
}
export default function Lab() {
  const [config,setConfig]=useState<Config>(initial), [step,setStep]=useState(0);
  const [prediction,setPrediction]=useState(''), [reason,setReason]=useState('');
  const [baseline,setBaseline]=useState<Config|null>(null), [history,setHistory]=useState<Config[]>([]);
  const r=inspect(config);
  function change(c:Config) {setHistory([...history,config]); setConfig(c); setStep(0); setPrediction(''); setReason('');}
  function reset() {setConfig(initial);setStep(0);setPrediction('');setReason('');setBaseline(null);setHistory([]);}
  return <section className="types-30" data-testid="types-lab-30">
    <header><p className="t30-eyebrow">同一静态类型 · 不同动态实现</p><h3>给通知通道选择装配契约</h3><p>保留同一组邮件、短信输入，只改变入口契约。先预测编译结果，再逐个发送，追踪类型关系与行为分派。</p></header>
    <pre>{definitions}</pre><ConfigControls config={config} change={change}/><pre aria-label="本次执行代码">{r.code}</pre>
    <View config={config} step={step}/>
    <fieldset disabled={step>0}><legend>揭晓前，记录预测与理由</legend><label>本次装配能否通过编译？<select value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">请选择</option><option value="pass">能通过</option><option value="fail">不能通过</option></select></label><label>为什么？<textarea rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明 T 的来源，或每个值如何满足容器元素类型。"/></label></fieldset>
    <div className="t30-actions"><button disabled={!prediction || !reason.trim() || step>0} onClick={()=>setStep(1)}>验证预测</button><button disabled={step===0 || step>=maxStep(config)} onClick={()=>setStep(step+1)}>{step===1?'构造容器':'单步发送'}</button><button disabled={step===0&&!history.length} onClick={()=>{if(step>0)setStep(step-1);else {const prev=history[history.length-1];setHistory(history.slice(0,-1));setConfig(prev);setPrediction('');setReason('');}}}>回退一步</button><button onClick={reset}>重置实验</button></div>
    {step>0 && <aside className="t30-feedback"><strong>{(prediction==='pass')===r.allowed?'预测吻合':'预测与检查结果不同'}</strong><p>你的理由：{reason}</p><p>{r.reason}</p>{!r.allowed && <button onClick={()=>{setBaseline(config);change(repair(config));}}>保持输入，修复为 Sender 后重新预测</button>}{r.allowed && <p>下一步：{step<4?'继续单步，查看编译通过与真实发送之间的区别。':'交换通道顺序再运行，观察类型关系是否变化、输出顺序是否变化。'}</p>}</aside>}
    {baseline && <aside className="t30-compare"><strong>同输入修复对照</strong><p>两边输入均为 {baseline.channels.join('、')}。</p><div><article><h4>修复前</h4><pre>{inspect(baseline).code}</pre><p>{inspect(baseline).reason}</p><p>输出：（无）</p></article><article><h4>修复后</h4><pre>{r.code}</pre><p>{config.channels.join()!==baseline.channels.join()?'输入已变更，当前不再是控制变量对照。':step ? r.reason : '等待重新预测与检查。'}</p></article></div></aside>}
    <p className="t30-boundary">范围：固定的三个无状态、非 nil 通道均实现 Send；模型模拟这些代码的类型检查与顺序调用，不执行任意 Go。Clone 是元素复制，不保证深拷贝。泛型与接口可以组合；这里没有性能测量，不能据此判断谁更快。本实验属于辅助探索，不写入独立掌握成绩。</p>
  </section>;
}
function Example() {
  const [route,setRoute]=useState<Route>('queue');
  const config:Config={...initial,channels:['Mail','Push'],route};
  return <><h4>配送队列：统一服务承诺，保留实际通道</h4><p>“都能发送”像共同服务承诺；每个通道仍保留自身实现。把入口改成自动推断，观察同一订单列表能否进入。</p><div className="t30-actions">{routes.filter(r=>r.id!=='clone').map(r=><button key={r.id} aria-pressed={route===r.id} onClick={()=>setRoute(r.id)}>{r.label}</button>)}</div><pre>{inspect(config).code}</pre><View config={config} step={inspect(config).allowed?4:1}/><p>类比边界：语言检查的是类型与方法集，不会验证真实服务的质量或可靠性。</p></>;
}
function Diagram() {
  const [input,setInput]=useState<'Mail'|'Sender'>('Mail');
  const [mixed,setMixed]=useState(false);
  const config:Config={channels:mixed?['Mail','SMS']:['Mail','Mail'],route:'clone',cloneType:input};
  return <><h4>连接输入、T 与输出的类型路径</h4><p>修改左侧输入类型，观察中间 T 和右侧返回类型如何同步。再向同一容器放入 SMS，检验边界。</p><div className="t30-controls"><label>输入切片类型<select value={input} onChange={e=>setInput(e.target.value as 'Mail'|'Sender')}><option value="Mail">[]Mail</option><option value="Sender">[]Sender</option></select></label><label><input type="checkbox" checked={mixed} onChange={e=>setMixed(e.target.checked)}/>将第二个 Mail 换成 SMS</label></div><div className="t30-type-path"><code>[] {input}</code><span>→</span><code>T = {input}</code><span>→</span><code>[] {input}</code></div><pre>{inspect(config).code}</pre><View config={config} step={inspect(config).allowed?2:1}/><p>当 T=Sender 时，保留的是 Sender 静态类型关系，元素的动态类型可以不同。</p></>;
}
function Steps() {
  const [step,setStep]=useState(0), [reverse,setReverse]=useState(false);
  const config:Config={...initial,channels:reverse?['SMS','Mail']:['Mail','SMS'],route:'explicit'};
  return <><h4>泛型与接口合用：从检查到分派</h4><pre>{inspect(config).code+'\nfor _, s := range queue { out = append(out, s.Send()) }'}</pre><View config={config} step={step}/><div className="t30-actions"><button disabled={step===4} onClick={()=>setStep(step+1)}>{['检查类型','构造 []Sender','发送第 1 项','发送第 2 项','已结束'][step]}</button><button disabled={!step} onClick={()=>setStep(step-1)}>回退一步</button><button onClick={()=>{setReverse(!reverse);setStep(0);}}>交换顺序并重新运行</button><button onClick={()=>{setReverse(false);setStep(0);}}>重置推导</button></div><p>回退是本地模拟回放；真实发送的外部副作用不能靠撤销时间线收回。</p></>;
}
function Try() {
  const [type,setType]=useState<'Mail'|'Sender'>('Mail'), [prediction,setPrediction]=useState(''), [reason,setReason]=useState(''), [shown,setShown]=useState(false);
  const config:Config={...initial,channels:['Mail','Push'],route:'clone',cloneType:type};
  const r=inspect(config);
  return <><h4>修复挑战：输入顺序和通道都不能变</h4><p>目标：让 Mail、Push 经 Clone 后保持两种发送行为，输出顺序仍为 mail:ok,push:ok。只能调整输入切片元素类型。</p><label>选择类型<select value={type} onChange={e=>{setType(e.target.value as 'Mail'|'Sender');setShown(false);setPrediction('');setReason('');}}><option>Mail</option><option>Sender</option></select></label><pre>{r.code}</pre><fieldset disabled={shown}><legend>先判断再执行</legend><label>能否实现目标？<select value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">请选择</option><option value="yes">可以</option><option value="no">不可以</option></select></label><label>给出理由<textarea rows={2} value={reason} onChange={e=>setReason(e.target.value)}/></label></fieldset><div className="t30-actions"><button disabled={shown||!prediction||!reason.trim()} onClick={()=>setShown(true)}>运行构造方案</button><button onClick={()=>{setType('Mail');setShown(false);setPrediction('');setReason('');}}>重做辅助挑战</button></div><View config={config} step={shown?(r.allowed?4:1):0}/>{shown&&<p>{(prediction==='yes')===r.allowed?'判断吻合。':'判断有差异。'}{r.reason} 你的理由：{reason}；{r.allowed?'Clone 保留 []Sender，而每个接口元素仍记着动态类型。':'检查输入元素能否赋给 Mail，再调整切片类型。'}</p>}</>;
}
export function Help({mode}:{mode:string}) {return <section className="types-30" data-testid="types-help-30">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Try/>}<p className="t30-boundary">这是带支架的辅助理解，不记录为无提示的独立掌握。</p></section>;}
