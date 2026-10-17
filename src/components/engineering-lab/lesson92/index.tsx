import { useId, useState } from 'react';
import { buildTrace, initialConfig, stages, type Config, type Snapshot, type Strategy } from './model';
import './style.css';

const strategies: Record<Strategy, string> = { slice: '普通切片 data[:n]', limited: '限制容量 data[:n:n]', copy: 'make + copy 独立副本' };
function Graph({ config, state }: { config: Config; state: Snapshot }) {
  const marker = useId().replace(/:/g, '');
  return <div className="eg92-graph" data-testid="live-model" data-state={JSON.stringify(state)}>
    <svg viewBox="0 0 330 265" role="img" aria-label={`引用关系：原数组${state.largeReachable ? '仍可达' : '不可达'}，缓存${state.cache === 'large' ? '指向原数组' : state.cache === 'small' ? '指向副本' : '为空'}`}>
      <defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="#b86a3c" /></marker></defs>
      {[{ label: 'data', x: 5, active: state.source }, { label: '缓存', x: 116, active: state.cache !== 'none' }, { label: '其他持有者', x: 227, active: state.other }].map(n => <g key={n.label} opacity={n.active ? 1 : .45}><rect x={n.x} y="8" width="98" height="42" rx="8" /><text x={n.x + 49} y="34" textAnchor="middle">{n.label}</text></g>)}
      {state.source && <path className="eg92-edge" d="M54 50V105" markerEnd={`url(#${marker})`} />}
      {state.other && <path className="eg92-edge" d="M276 50V78H230V105" markerEnd={`url(#${marker})`} />}
      {state.cache === 'large' && <path className="eg92-edge" d="M165 50V105" markerEnd={`url(#${marker})`} />}
      {state.cache === 'small' && <path className="eg92-edge" d="M165 50V78H317V219H238" markerEnd={`url(#${marker})`} />}
      <rect x="10" y="110" width="290" height="68" rx="8" className={state.largeReachable ? 'eg92-alive' : 'eg92-dead'} />
      <text x="155" y="136" textAnchor="middle">原数组 · {config.size} B</text><text x="155" y="159" textAnchor="middle">{state.largeReachable ? '仍可达 · 必须保留' : '无引用 · 可回收'}</text>
      <rect x="75" y="198" width="160" height="52" rx="8" className={state.cache === 'small' ? 'eg92-alive' : 'eg92-dead'} />
      <text x="155" y="220" textAnchor="middle">{config.strategy === 'copy' && state.step > 0 ? `独立副本 · ${config.keep} B` : '尚无独立副本'}</text><text x="155" y="240" textAnchor="middle">{state.cache === 'small' ? '缓存持有' : '没有可达引用'}</text>
    </svg>
    <div className="eg92-metrics"><span>缓存 len / cap <b>{state.len} / {state.cap}</b></span><span>可达数组合计 <b>{state.retainedBytes} B</b></span><span>累计复制 <b>{state.copyBytes} B</b></span><span>累计分配模型 <b>{state.allocatedBytes} B</b></span></div>
  </div>;
}
function Options({ config, change }: { config: Config; change: (c: Config) => void }) {
  return <div className="eg92-options"><label>缓存方式<select value={config.strategy} onChange={e => change({ ...config, strategy: e.target.value as Strategy })}>{Object.entries(strategies).map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label><label>原数组大小<select value={config.size} onChange={e => change({ ...config, size: Number(e.target.value) })}><option value={1024}>1 KiB（1024 B）</option><option value={1048576}>1 MiB（1048576 B）</option></select></label><label>保留字节<select value={config.keep} onChange={e => change({ ...config, keep: Number(e.target.value) })}>{[4, 8, 16].map(v => <option key={v}>{v}</option>)}</select></label><label className="eg92-check"><input type="checkbox" checked={config.other} onChange={e => change({ ...config, other: e.target.checked })} />另一个存活对象也引用原数组</label></div>;
}
const Boundary = () => <p className="eg92-boundary">模型边界：这里只统计显式可达数组的字节数，假设这些持有者确实仍会被使用。没有运行 Go GC，也未测量堆占用、逃逸、分配耗时或 GC 时机；实际实现还受编译器优化、分配粒度和其他对象影响。cap 决定切片可扩展范围，不决定整个数组能否回收。</p>;
export default function Lesson92() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const trace = buildTrace(config); const state = trace[step];
  const reset = (c: Config) => { setConfig(c); setStep(0); setPrediction(''); setReason(''); setFeedback(''); };
  const advance = () => { const next = trace[step + 1]; setFeedback(`${prediction === String(next.largeReachable) ? '预测吻合' : '需要修正'}：你预测原数组${prediction === 'true' ? '仍可达' : '可回收'}。理由：${reason}。实际：${next.event}`); setStep(step + 1); setPrediction(''); setReason(''); };
  return <section className="eg92" data-testid="engineering-lab-92"><h3>引用断路实验：4 字节为什么留住整块数组？</h3><p>先猜下一步，再沿箭头找仍存活的持有者。修改条件会开始新一轮，可比较限制 cap 与真正复制的区别。</p><Options config={config} change={reset} />
    <p className="eg92-status">步骤 {step}/4 · {stages[step]}</p><Graph config={config} state={state} /><p>{state.event}</p>
    {step < 4 && <fieldset className="eg92-predict"><legend>下一步：{stages[step + 1]}</legend><label>执行后，原大数组会怎样？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">先选择预测</option><option value="true">仍可达，必须保留</option><option value="false">不可达，满足可回收条件</option></select></label><label>哪条引用会保留或断开？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="请指出持有者和它指向的数组" /></label></fieldset>}
    <div className="eg92-actions"><button data-eg-action="step" disabled={step === 4 || !prediction || !reason.trim()} onClick={advance}>记录预测并单步</button><button data-eg-action="back" disabled={step === 0} onClick={() => { setStep(step - 1); setFeedback('已回退模型；下一步可以重新预测。'); setPrediction(''); setReason(''); }}>回退</button><button data-eg-action="reset" onClick={() => reset(config)}>重置本轮</button></div><p className="eg92-feedback" role="status">{feedback || '观察引用路径，写下你的判断后再执行。'}</p><Boundary /></section>;
}
function Example() {
  const [other, setOther] = useState(false);
  return <><h4>同样保留 8 字节，比较两种成本</h4><label className="eg92-check"><input type="checkbox" checked={other} onChange={e => setOther(e.target.checked)} />data 退出后，还有其他对象持有原数组</label><div className="eg92-compare">{(['limited', 'copy'] as Strategy[]).map(strategy => { const config = { size: 1024, keep: 8, strategy, other }; const state = buildTrace(config)[2]; return <article key={strategy}><h4>{strategies[strategy]}</h4><Graph config={config} state={state} /><p>{state.event}</p></article>; })}</div><p>两边 cap 都是 8，但引用目标不同。复制花费 8 B 拷贝与新分配；只有最后一条旧引用消失，旧数组才可回收。</p></>;
}
function Diagram() {
  const [other, setOther] = useState(true); const [copy, setCopy] = useState(false);
  const config: Config = { size: 1024, keep: 4, strategy: copy ? 'copy' : 'limited', other };
  return <><h4>切断引用边，检查可达路径</h4><p>固定在 data 已退出的时刻。箭头代表真实的数组引用；灰色节点表示没有存活的引用。</p><div className="eg92-actions"><button onClick={() => setOther(!other)}>{other ? '断开' : '恢复'}其他持有者</button><button onClick={() => setCopy(!copy)}>{copy ? '恢复共享前缀' : '把缓存改为独立副本'}</button></div><Graph config={config} state={buildTrace(config)[2]} /></>;
}
function Steps() {
  const [step, setStep] = useState(0); const config: Config = { ...initialConfig, strategy: 'copy', other: true }; const state = buildTrace(config)[step];
  return <><h4>分步追踪：复制了却仍保留原数组</h4><ol className="eg92-steps">{stages.map((s, i) => <li key={s} aria-current={step === i ? 'step' : undefined}>{s}</li>)}</ol><Graph config={config} state={state} /><p>{state.event}</p><div className="eg92-actions"><button disabled={!step} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 4} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>从头追踪</button></div></>;
}
function Try() {
  const [other, setOther] = useState(true); const [answer, setAnswer] = useState(''); const [reason, setReason] = useState(''); const [revealed, setRevealed] = useState(false);
  const config: Config = { size: 1048576, keep: 16, strategy: 'copy', other }; const state = buildTrace(config)[2];
  return <><h4>局部迁移：副本已建，旧引用还在吗？</h4><p>从 1 MiB 缓冲复制 16 B 到缓存，随后 data 退出。预测仍可达数组的合计大小。</p><label className="eg92-check"><input type="checkbox" checked={other} onChange={e => { setOther(e.target.checked); setRevealed(false); setAnswer(''); setReason(''); }} />后台对象仍持有原数组</label><label>我的预测<select value={answer} disabled={revealed} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="16">16 B</option><option value="1048576">1048576 B</option><option value="1048592">1048592 B</option></select></label><label>依据<textarea rows={2} disabled={revealed} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="eg92-actions"><button disabled={!answer || !reason.trim() || revealed} onClick={() => setRevealed(true)}>验证引用路径</button><button onClick={() => { setRevealed(false); setAnswer(''); setReason(''); }}>重新预测</button></div>{revealed && <><Graph config={config} state={state} /><p role="status">{Number(answer) === state.retainedBytes ? '预测吻合' : '检查遗漏的数组'}：实际 {state.retainedBytes} B。{state.event} 你的理由：{reason}</p></>}<p>这是带条件的局部练习，不计入正式测验或掌握记录。</p></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="eg92 eg92-help" data-testid="engineering-help-92">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}<Boundary /></section>;
}
