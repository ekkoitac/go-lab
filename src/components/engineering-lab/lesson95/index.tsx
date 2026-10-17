import { useState } from 'react';
import { defaultConfig, poolAt, sourceFor, type PoolConfig, type PoolSource } from './model';
import './style.css';
const sources: Record<PoolSource, string> = { reused: '复用 buffer-1', new: 'New 创建 buffer-2', nil: '返回 nil' };
const phases = ['A 正在使用', 'A.Put', '运行时分支', 'B.Get', 'B.WriteString', '检查归还后访问'];
function Flow({ missing, hasNew }: { missing: boolean; hasNew: boolean }) {
  return <svg className="eg95-flow" viewBox="0 0 330 320" role="img" aria-label={`Get 分支：${missing ? hasNew ? '无可用项，New 创建新对象' : '无可用项，没有 New，返回 nil' : '本次命中旧对象'}`}>
    <path d="M165 55V90 M120 150V188H80V230 M210 150V188H250V230" fill="none" stroke="#a3b7b1" strokeWidth="3"/>
    <path d={missing ? 'M165 55V90 M210 150V188H250V230' : 'M165 55V90 M120 150V188H80V230'} fill="none" stroke="#0c8d73" strokeWidth="5"/>
    <path d="m159 82 6 8 6-8 M74 222l6 8 6-8 M244 222l6 8 6-8" fill="none" stroke="#0c8d73" strokeWidth="2"/>
    <rect x="105" y="10" width="120" height="45" rx="10" fill="#e0f4ed"/><text x="165" y="39" textAnchor="middle">Get()</text>
    <rect x="85" y="90" width="160" height="60" rx="10" fill="#f0f5f3"/><text x="165" y="116" textAnchor="middle">本次有可用项？</text><text x="165" y="138" textAnchor="middle">不保证命中旧对象</text>
    <text x="80" y="211" textAnchor="middle">是</text><text x="250" y="211" textAnchor="middle">否</text>
    <rect x="10" y="230" width="140" height="68" rx="10" fill={missing ? '#f0f5f3' : '#c5efdf'}/><text x="80" y="259" textAnchor="middle">复用旧对象</text><text x="80" y="282" textAnchor="middle">需清理旧状态</text>
    <rect x="180" y="230" width="140" height="68" rx="10" fill={missing ? '#c5efdf' : '#f0f5f3'}/><text x="250" y="259" textAnchor="middle">{hasNew ? '调用 New' : '没有 New'}</text><text x="250" y="282" textAnchor="middle">{hasNew ? '新空缓冲' : '返回 nil'}</text>
  </svg>;
}
export default function Lesson95() {
  const [config, setConfig] = useState<PoolConfig>({ ...defaultConfig });
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState<PoolSource | ''>('');
  const [reason, setReason] = useState('');
  const state = poolAt(step, config);
  const change = (patch: Partial<PoolConfig>) => { setConfig({ ...config, ...patch }); setStep(0); setPrediction(''); setReason(''); };
  return <section className="eg95-lab" data-testid="engineering-lab-95">
    <header><h3>缓冲交接台：借出、归还、再取用</h3><p>扮演请求 A，把缓冲交给 Pool，再观察请求 B 得到什么。改变一个条件，找到“必须重建”和“必须重置”各自的证据。</p></header>
    <fieldset className="eg95-controls"><legend>选择本次轨迹 · 修改条件会重新开始</legend>
      <label>运行时分支<select aria-label="运行时分支" value={config.discard ? 'discard' : 'reuse'} onChange={e => change({ discard: e.target.value === 'discard' })}><option value="discard">丢弃池中项</option><option value="reuse">保留并在本次 Get 命中</option></select></label>
      <label><input type="checkbox" checked={config.hasNew} onChange={e => change({ hasNew: e.target.checked })}/>设置 New 构造空缓冲</label>
      <label><input type="checkbox" checked={config.resetOnPut} onChange={e => change({ resetOnPut: e.target.checked })}/>归还前 Reset 逻辑内容</label>
      <label><input type="checkbox" checked={config.staleWrite} onChange={e => change({ staleWrite: e.target.checked })}/>注入错误：A 在 Put 后仍写入</label>
    </fieldset>
    <div className="eg95-prediction"><label>先预测：B.Get 会得到什么？<select aria-label="B.Get 预测" value={prediction} disabled={step > 0} onChange={e => setPrediction(e.target.value as PoolSource)}><option value="">请选择预测</option>{Object.entries(sources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>你的理由<textarea aria-label="Pool 预测理由" placeholder="结合运行时分支与 New 解释你的判断" value={reason} disabled={step > 0} onChange={e => setReason(e.target.value)}/></label></div>
    <div data-testid="live-model" data-state={JSON.stringify({ ...state, config, prediction })}>
      <div className="eg95-track">{phases.map((phase, i) => <span key={phase} className={step === i ? 'eg95-active' : ''}>{i}. {phase}</span>)}</div>
      <div className="eg95-board"><article className={state.owner === 'A' ? 'eg95-owned' : ''}><b>请求 A</b><p>{step === 0 ? '使用权：buffer-1' : '使用权：已交出'}</p><small>{step > 0 ? '旧引用即使还在，也不能继续使用' : '内容：A:订单;'}</small></article><article className={state.owner === 'pool' ? 'eg95-owned' : ''}><b>sync.Pool</b><p>{state.pool ?? '无可用项'}</p><small>随时可移除，不承诺数量</small></article><article className={state.owner === 'B' ? 'eg95-owned' : ''}><b>请求 B</b><p>{step < 3 ? '尚未 Get' : state.source === 'nil' ? 'nil：没有缓冲' : `使用权：${state.id}`}</p><small>追加自己的响应</small></article></div>
      <div className="eg95-content"><b>正在追踪的内容</b><code>{state.id ? `${state.id} → ${JSON.stringify(state.content)}` : '没有可用对象'}</code><span>累计创建：{state.allocations} 个（模型计数）</span></div>
    </div>
    <div className="eg95-actions"><button data-eg-action="back" disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button data-eg-action="step" disabled={step === 5 || !prediction || !reason.trim()} onClick={() => setStep(step + 1)}>{step === 5 ? '本次轨迹已结束' : `单步：${phases[step + 1]}`}</button><button data-eg-action="reset" onClick={() => { setStep(0); setPrediction(''); setReason(''); }}>重置本次实验</button></div>
    <p className="eg95-feedback" role="status">{state.feedback}</p>
    {step >= 3 && <p className="eg95-result">你的预测：{prediction && sources[prediction]}；实际：{state.source && sources[state.source]}。{prediction === state.source ? '该分支下预测一致。' : '检查 Get 时是否有可用项，以及无可用项时是否配置了 New。'} 理由记录：{reason}</p>}
    <p className="eg95-boundary">这是可控的合法轨迹模型，不模拟 Go 的内部调度或测量性能。保留项也不保证被 Get 取回；GC 不等于必定清空。Reset 只清空逻辑长度，不保证擦除敏感字节。连接、文件等需要明确关闭的资源不适合靠 Pool 管理。</p>
  </section>;
}
function Example() {
  const [reset, setReset] = useState(false);
  const state = poolAt(4, { ...defaultConfig, discard: false, resetOnPut: reset });
  return <><h4>同一对象，为什么出现上个请求的内容？</h4><p>固定本次 Get 命中 buffer-1，只改变归还时是否 Reset。</p><label><input type="checkbox" checked={reset} onChange={e => setReset(e.target.checked)}/>在 A.Put 前 Reset</label><div className="eg95-content"><code>A 写入 → {reset ? 'Reset → ' : ''}Put → B.Get → B 追加</code><code>B 的内容：{JSON.stringify(state.content)}</code></div><p>{reset ? '对象身份没变，但逻辑长度已归零，B 的输出不再混入 A 的内容。' : 'Put 只交接对象，旧内容不会自动消失。'}</p></>;
}
function Diagram() {
  const [missing, setMissing] = useState(true); const [hasNew, setNew] = useState(true);
  return <><h4>沿着 Get 的分支追踪对象来源</h4><label><input type="checkbox" checked={missing} onChange={e => setMissing(e.target.checked)}/>本次没有可用项</label><label><input type="checkbox" checked={hasNew} onChange={e => setNew(e.target.checked)}/>已设置 New</label><Flow missing={missing} hasNew={hasNew}/><p>高亮路径由条件决定；Pool 允许无可用项，构造回退让调用者仍能工作。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0); const state = poolAt(step, { hasNew: true, discard: true, resetOnPut: true, staleWrite: false });
  return <><h4>把一次安全交接拆开看</h4><p>固定修复：Reset + New + 归还后停止访问。</p><div className="eg95-content"><b>{phases[step]}</b><code>使用权：{state.owner} / 对象：{state.id ?? '无'} / 内容：{JSON.stringify(state.content)}</code></div><p>{state.feedback}</p><div className="eg95-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 5} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>从头看</button></div></>;
}
function Try() {
  const [hasNew, setNew] = useState(false); const [prediction, setPrediction] = useState(''); const [reason, setReason] = useState(''); const [revealed, setRevealed] = useState(false);
  const actual = sourceFor({ ...defaultConfig, hasNew });
  return <><h4>换情境：日志缓冲被运行时移除</h4><p>Logger 刚 Put 过一个缓冲，但现在已经没有可用项。预测下次 Get。此处是辅助练习，不记录正式测验成绩。</p><label><input type="checkbox" checked={hasNew} onChange={e => { setNew(e.target.checked); setRevealed(false); setPrediction(''); setReason(''); }}/>给 Logger 配置 New</label><label>预测结果<select value={prediction} disabled={revealed} onChange={e => setPrediction(e.target.value)}><option value="">选择结果</option><option value="reused">总能拿回刚 Put 的缓冲</option><option value="new">新空缓冲</option><option value="nil">nil</option></select></label><label>解释依据<textarea value={reason} disabled={revealed} onChange={e => setReason(e.target.value)}/></label><div className="eg95-actions"><button disabled={!prediction || !reason.trim() || revealed} onClick={() => setRevealed(true)}>验证这个预测</button><button onClick={() => { setPrediction(''); setReason(''); setRevealed(false); }}>重新预测</button></div>{revealed && <p role="status" className="eg95-feedback">{prediction === actual ? '预测一致。' : '预测与本次路径不同。'}Get 返回：{sources[actual]}。没有可用项时，{hasNew ? 'New 构造新空缓冲，不恢复旧内容。' : '没有 New 就返回 nil，刚 Put 过也不是保证。'}</p>}</>;
}
export function Help({ mode }: { mode: string }) { return <section className="eg95-help" data-testid="engineering-help-95">{mode === 'diagram' ? <Diagram/> : mode === 'steps' ? <Steps/> : mode === 'try' ? <Try/> : <Example/>}</section>; }
