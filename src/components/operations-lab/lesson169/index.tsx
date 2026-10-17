import { useState } from 'react';
import { defaults, meanInFlight, metrics, predictionOutcome, run, type Config, type State } from './model';
import './styles.css';
const outcomes = { clear: '队列不持续增长', grow: '队列持续增长', reject: '出现拒绝' };
const f = (n: number) => Number(n.toFixed(2));
function View({ state, capacity }: { state: State; capacity: number }) {
  const m = metrics(state);
  return <div data-testid="live-model" data-state={JSON.stringify({ ...state, ...m })}>
    <div className="ops169-flow" aria-label="当前请求流向">
      <article><b>到达</b><strong>{state.arrivals}</strong><small>累计请求</small></article><span>→</span>
      <article><b>等待区</b><strong>{state.queue.length}</strong><small>已准入，尚未处理</small></article><span>→</span>
      <article><b>服务区</b><strong>{state.active.length} / {capacity}</strong><progress max={capacity} value={state.active.length} aria-label="服务槽占用" /></article><span>→</span>
      <article><b>完成</b><strong>{state.completed}</strong><small>拒绝 {state.rejected}</small></article>
    </div>
    <p className="ops169-event" role="status">t={state.timeMs}ms：本步完成 {state.lastCompleted}，到达 {state.lastArrivals}，拒绝 {state.lastRejected}；当前在途 {m.unfinished}（等待 + 服务）。</p>
    <div className="ops169-metrics"><span>窗口平均在途 L̄：<b>{f(m.averageL)}</b></span><span>窗口完成吞吐：<b>{f(m.throughput)}/s</b></span><span>已完成请求平均停留：<b>{state.completed ? f(m.completedW) + 'ms' : '尚无样本'}</b></span></div>
    <p className="ops169-note">窗口 [0, {state.timeMs}]ms 从空系统开始。L̄ 按在途人数的时间面积计算；吞吐只计窗口内完成；停留只平均已完成请求。右边界尚有 {m.unfinished} 个请求未完成，因此这里不要求 L̄ = 窗口吞吐 × 已完成平均停留。</p>
  </div>;
}
function Controls({ value, change }: { value: Config; change: (c: Config) => void }) {
  return <fieldset className="ops169-controls"><legend>改变条件会从空系统重新开始</legend>
    <label>到达速率：{value.qps}/s<input aria-label="到达速率" type="range" min="100" max="2000" step="100" value={value.qps} onChange={e => change({ ...value, qps: +e.target.value })} /></label>
    <label>固定服务时长：{value.serviceMs}ms<input aria-label="固定服务时长" type="range" min="10" max="200" step="10" value={value.serviceMs} onChange={e => change({ ...value, serviceMs: +e.target.value })} /></label>
    <label>服务槽容量：{value.capacity}<input aria-label="服务槽容量" type="range" min="10" max="200" step="10" value={value.capacity} onChange={e => change({ ...value, capacity: +e.target.value })} /></label>
    <label>满载准入策略<select aria-label="满载准入策略" value={value.admission} onChange={e => change({ ...value, admission: e.target.value as Config['admission'] })}><option value="queue">准入排队（演示无界积压）</option><option value="reject">满槽拒绝（无等待区）</option></select></label>
  </fieldset>;
}
function Boundary() { return <p className="ops169-note">模型每 10ms 到达一批请求，固定服务时长，FIFO，不模拟 CPU、随机突发或尾延迟。稳态 Little 定律使用相同系统边界下的平均吞吐与平均停留；这里的服务槽不等同生产 worker 数。平均在途不能直接推出硬并发上限、峰值或 P99。本模块为辅助探索，不记录独立掌握。</p>; }
export default function Lab() {
  const [config, setConfig] = useState<Config>({ ...defaults });
  const [ticks, setTicks] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  function reset() { setTicks(0); setPrediction(''); setReason(''); }
  function change(c: Config) { setConfig(c); reset(); }
  const state = run(config, ticks);
  return <section className="ops169" data-testid="operations-lab-169"><h3>在途人数与积压实验台</h3><p>基线：稳定吞吐 1000/s、平均系统停留 50ms，平均在途为 50。先预测满载行为，再让请求真正流过等待区和服务区。</p>
    <Controls value={config} change={change} />
    <fieldset className="ops169-controls"><legend>先预测：持续运行后会发生什么？</legend><label>长期趋势<select aria-label="长期趋势" value={prediction} disabled={ticks > 0} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option>{Object.entries(outcomes).map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label><label>预测理由<textarea aria-label="预测理由" value={reason} disabled={ticks > 0} onChange={e => setReason(e.target.value)} placeholder="比较到达需求、服务时长与服务槽容量" /></label></fieldset>
    <div className="ops169-actions"><button type="button" data-ops-action="step" disabled={!prediction || !reason.trim() || ticks >= 100} onClick={() => setTicks(ticks + 1)}>单步推进 10ms</button><button type="button" disabled={!prediction || !reason.trim() || ticks >= 100} onClick={() => setTicks(Math.min(ticks + 10, 100))}>推进 100ms</button><button type="button" data-ops-action="back" disabled={!ticks} onClick={() => setTicks(ticks - 1)}>回退一步</button><button type="button" data-ops-action="reset" onClick={reset}>重置轨迹</button></div>
    {(!prediction || !reason.trim()) && <p>选择趋势并填写理由后开始。上限为 1000ms，可回退或重置重试。</p>}
    <View state={state} capacity={config.capacity} />
    {ticks > 0 && <div className="ops169-result"><p>无排队、输入全部完成的稳态候选：{config.qps}/s × {config.serviceMs / 1000}s = <b>{f(meanInFlight(config.qps, config.serviceMs))} 个平均服务中请求</b>；服务槽 {config.capacity}。此候选不是当前窗口的测量值。</p><p>若排队，系统停留 = 等待 + 服务；若拒绝，完成吞吐可能低于到达速率。</p></div>}
    {ticks >= 50 && <p className="ops169-event">持续负载推断：{outcomes[predictionOutcome(config)]}。{prediction === predictionOutcome(config) ? '与你的预测一致。' : '与你的预测不同：检查服务槽每秒可完成多少请求，再核对准入策略。'} 你的理由：{reason}。先回退查看队列开始增长的位置，再改变容量重试。</p>}
    <Boundary />
  </section>;
}
function Example() {
  const [slow, setSlow] = useState(100);
  const [ticks, setTicks] = useState(0);
  return <><h4>只让服务变慢，比较同一批输入</h4><label>实验组服务时长<select value={slow} onChange={e => { setSlow(+e.target.value); setTicks(0); }}><option value={50}>50ms</option><option value={100}>100ms</option><option value={200}>200ms</option></select></label><div className="ops169-actions"><button type="button" onClick={() => setTicks(Math.min(100, ticks + 10))} disabled={ticks === 100}>两组一起推进 100ms</button><button type="button" onClick={() => setTicks(0)}>重置对照</button></div><div className="ops169-compare">{[50, slow].map((serviceMs, i) => <article key={i}><h4>{i ? '实验组' : '基线'} · {serviceMs}ms</h4><View state={run({ ...defaults, serviceMs }, ticks)} capacity={80} /></article>)}</div><p>到达均为 1000/s、容量均为 80。变慢后在途占槽更久；满槽后等待进入 W，不能继续把固定服务时间当系统停留。</p></>;
}
function Diagram() {
  const [boundary, setBoundary] = useState('system');
  const [wait, setWait] = useState(20);
  const w = boundary === 'system' ? 50 + wait : 50;
  return <><h4>移动系统边界，联动公式与区域</h4><p>给定稳态测量样本：完成吞吐 1000/s，平均服务 50ms。等待均值可编辑；这是均值关系图，不是排队性能预测器。</p><label>样本平均等待：{wait}ms<input aria-label="样本平均等待" type="range" min="0" max="100" step="10" value={wait} onChange={e => setWait(+e.target.value)} /></label><div className="ops169-actions"><button type="button" aria-pressed={boundary === 'system'} onClick={() => setBoundary('system')}>边界包含等待区</button><button type="button" aria-pressed={boundary === 'service'} onClick={() => setBoundary('service')}>边界只含服务区</button></div><div className="ops169-flow" data-testid="live-model" data-state={JSON.stringify({ boundary, wait, w, l: meanInFlight(1000, w) })}><article className={boundary === 'system' ? 'ops169-selected' : ''}><b>等待区</b><strong>{wait}ms</strong><span>平均 {wait} 个</span></article><span>→</span><article className="ops169-selected"><b>服务区</b><strong>50ms</strong><span>平均 50 个</span></article></div><p>高亮边界：W = {w}ms，L = 1000 × {w / 1000} = <b>{w}</b>。改变边界就必须同时改变 L 与 W 的统计口径。</p></>;
}
function Steps() {
  const [order, setOrder] = useState<string[]>([]);
  const [show, setShow] = useState(false);
  const correct = ['seconds', 'multiply', 'boundary'];
  const names: Record<string, string> = { multiply: '吞吐乘秒数', boundary: '解释均值与容量边界', seconds: '毫秒转换成秒' };
  return <><h4>搭建一个量纲正确的推导</h4><p>依次选择三个步骤，为 1000/s、50ms 建立推导。</p><div className="ops169-actions">{Object.entries(names).map(([id, label]) => <button type="button" key={id} disabled={order.includes(id)} onClick={() => { setOrder([...order, id]); setShow(false); }}>{label}</button>)}</div><ol>{order.map(id => <li key={id}>{names[id]}</li>)}</ol><div className="ops169-actions"><button type="button" disabled={order.length !== 3} onClick={() => setShow(true)}>执行推导</button><button type="button" onClick={() => { setOrder(order.slice(0, -1)); setShow(false); }}>撤回末步</button><button type="button" onClick={() => { setOrder([]); setShow(false); }}>清空重建</button></div>{show && <p role="status">{order.join() === correct.join() ? '顺序成立：50ms ÷ 1000 = 0.05s；1000/s × 0.05s = 50。它是同边界稳态平均在途，容量还需验证突发与尾部。' : '依赖尚未满足：先把毫秒换成秒，再相乘消去时间单位，最后解释均值边界。撤回并重建，避免得到错误的 50000。'}</p>}</>;
}
function Try() {
  const [ms, setMs] = useState(50);
  const [reason, setReason] = useState('');
  const [show, setShow] = useState(false);
  return <><h4>从目标反推平均停留</h4><p>新场景：稳定完成吞吐 800/s，希望平均在途恰为 80。调整系统平均停留（含等待），并说明单位。</p><label>候选平均停留：{ms}ms<input aria-label="候选平均停留" type="range" min="10" max="200" step="10" value={ms} onChange={e => { setMs(+e.target.value); setShow(false); }} /></label><label>反推理由<textarea value={reason} onChange={e => { setReason(e.target.value); setShow(false); }} placeholder="从 L/λ 推导秒数，再换成毫秒" /></label><div className="ops169-actions"><button type="button" disabled={!reason.trim()} onClick={() => setShow(true)}>验证候选</button><button type="button" onClick={() => { setMs(50); setReason(''); setShow(false); }}>重新反推</button></div>{show && <div role="status" className="ops169-result"><p>800 × {ms / 1000} = {meanInFlight(800, ms)}；{ms === 100 ? '达到均值目标。' : '尚未达到目标，尝试用 80 ÷ 800 反推 W。'} 你的理由：{reason}</p><progress max={160} value={meanInFlight(800, ms)} aria-label="候选平均在途" /><p>即使达到 80，也不能据此证明容量 80 足够或 P99 达标。</p></div>}</>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="ops169" data-testid="operations-help-169">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}<Boundary /></section>;
}
