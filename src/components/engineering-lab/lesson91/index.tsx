import { useState } from 'react';
import { costs, defaults, predictionMatches, snapshot, type Config, type Target } from './model';
import './style.css';
const num = (value: number) => Number(value.toFixed(1));
function CostBar({ cpu, network, label }: { cpu: number; network: number; label: string }) {
  return <div className="eg91-bar-row"><strong>{label} · {num(cpu + network)} 单位</strong><div className="eg91-bar" aria-label={`计算 ${num(cpu)}，网络 ${num(network)}，总计 ${num(cpu + network)}`}><span style={{ width: `${cpu}%` }} className="eg91-cpu" /><span style={{ width: `${network}%` }} className="eg91-network" /></div><small>计算 {num(cpu)} ＋ 网络等待 {num(network)}</small></div>;
}
export default function Lesson91() {
  const [config, setConfig] = useState<Config>(defaults);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const result = costs(config);
  const state = snapshot(config, step);
  const ready = prediction.trim() !== '' && Number.isFinite(Number(prediction)) && Number(prediction) >= 0 && reason.trim().length > 0;
  function configure(next: Partial<Config>) { setConfig({ ...config, ...next }); setStep(0); setPrediction(''); setReason(''); }
  const feedback = [
    '先指定代表负载与优化对象。目标是降低单次请求的端到端耗时；每次请求的初始预算固定为 100 单位。',
    `基线证据：计算占 ${config.cpu}%，网络等待占 ${100 - config.cpu}%。这里展示的是给定成本模型，尚未执行优化；CPU profile 不能直接解释全部网络等待，需要结合请求耗时与 trace。`,
    `只将${config.target === 'cpu' ? '计算' : '网络等待'}除以 ${config.speedup}；另一段仍需 ${result.unaffected} 单位。节省 ${num(result.saved)} 单位，端到端加速 ${num(result.speedup)} 倍。`,
    `模型复核：${num(result.after.cpu)} ＋ ${num(result.after.network)} ＝ ${num(result.total)}。${result.total <= 60 ? '达到了本次 ≤60 的模型目标。' : '尚未达到本次 ≤60 的模型目标；回到配置，试试调整另一段。'} 真实上线还要检查行为正确，并在同一代表负载下重复测量。`,
  ];
  return <section className="eg91-lab" data-testid="engineering-lab-91">
    <div className="eg91-heading"><span>成本预算实验 / 第 91 题</span><h3>快了两倍，整条请求也快两倍吗？</h3><p>调整负载，预测总耗时，再沿着“基线 → 改动 → 复核”寻找证据。</p></div>
    <div className="eg91-controls"><label>计算占比：{config.cpu}%<input aria-label="计算占比" type="range" min="0" max="100" step="10" value={config.cpu} onChange={e => configure({ cpu: Number(e.target.value) })} /></label><label>优化对象<select aria-label="优化对象" value={config.target} onChange={e => configure({ target: e.target.value as Target })}><option value="cpu">计算路径</option><option value="network">网络等待路径</option></select></label><label>目标部分加速<select aria-label="目标部分加速" value={config.speedup} onChange={e => configure({ speedup: Number(e.target.value) })}><option value="2">2 倍</option><option value="4">4 倍</option><option value="10">10 倍</option></select></label></div>
    <div className="eg91-prediction"><label>先预测：优化后总耗时（单位）<input aria-label="预测总耗时" type="number" min="0" max="100" step="0.1" value={prediction} disabled={step >= 2} onChange={e => setPrediction(e.target.value)} placeholder="0–100" /></label><label>写下理由：哪一段会变，哪一段不变？<textarea aria-label="预测理由" value={reason} disabled={step >= 2} onChange={e => setReason(e.target.value)} placeholder="我认为……因为……" rows={2} /></label></div>
    <div className="eg91-model" data-testid="live-model" data-state={JSON.stringify(state)}><CostBar {...result.before} label="同一负载的基线" /><CostBar {...state.observed} label={state.revealed ? '优化后模型' : '当前请求预算'} /><p className="eg91-legend">紫色：计算；蓝色：网络等待；同一条宽度 = 100 单位</p></div>
    <div className="eg91-actions"><button data-eg-action="back" disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button data-eg-action="step" disabled={step === 3 || (step === 1 && !ready)} onClick={() => setStep(step + 1)}>{['查看基线证据', '执行优化并揭晓', '复核端到端目标', '复核完成'][step]}</button><button data-eg-action="reset" onClick={() => { setConfig(defaults); setStep(0); setPrediction(''); setReason(''); }}>重置实验</button></div>
    {step === 1 && !ready && <p className="eg91-hint">填写预测值和理由后，才能执行优化。</p>}
    <div className="eg91-feedback" aria-live="polite"><strong>第 {step + 1} / 4 步</strong><p>{feedback[step]}</p>{state.revealed && <p>你的预测：{prediction}；模型结果：{num(result.total)}。{predictionMatches(prediction, result.total) ? '数值吻合，请用保留不变的成本解释这个结果。' : `相差 ${num(Math.abs(Number(prediction) - result.total))} 单位。检查是否误把整个 100 都除以加速倍数。`}</p>}</div>
    <p className="eg91-boundary">模型边界：两段串行、互不重叠，改动只影响所选部分，不计额外开销。单位不是毫秒，没有执行本机 benchmark；网络加速是实验假设，不代表现实中一定可行。这里的探索不计入正式测验。</p>
  </section>;
}
export function Help({ mode }: { mode: string }) {
  const [selected, setSelected] = useState<Target>('cpu');
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [show, setShow] = useState(false);
  const [cursor, setCursor] = useState(0);
  const result = costs({ cpu: 70, target: selected, speedup: 2 });
  return <section className="eg91-help" data-testid="engineering-help-91">
    {mode === 'example' && <><h4>换成一次厨房出餐</h4><p>切菜用 10 分钟，烤箱等待用 90 分钟，两步串行完成。切菜快一倍只省 5 分钟，出餐仍需 95 分钟。</p><CostBar cpu={5} network={90} label="切菜减半后的出餐" /><p>这说明应该先看时间花在哪里。类比只覆盖串行成本；真实厨房和服务可能并行，不能直接相加。</p></>}
    {mode === 'diagram' && <><h4>只改变一条成本边</h4><div className="eg91-actions"><button aria-pressed={selected === 'cpu'} onClick={() => setSelected('cpu')}>将计算减半</button><button aria-pressed={selected === 'network'} onClick={() => setSelected('network')}>将网络减半</button></div><svg viewBox="0 0 330 205" role="img" aria-label={`计算 ${result.after.cpu} 加网络 ${result.after.network} 等于总耗时 ${result.total}`}><defs><marker id="eg91-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10" fill="#6b8b7c" /></marker></defs><rect x="12" y="12" width="135" height="54" rx="8" fill="#e8def5" /><rect x="182" y="12" width="135" height="54" rx="8" fill="#d2eeeb" /><text x="80" y="35" textAnchor="middle">计算 70</text><text x="80" y="55" textAnchor="middle">→ {result.after.cpu}</text><text x="250" y="35" textAnchor="middle">网络等待 30</text><text x="250" y="55" textAnchor="middle">→ {result.after.network}</text><path d="M80 70 L80 105 L145 138 M250 70 L250 105 L185 138" fill="none" stroke="#6b8b7c" strokeWidth="2" markerEnd="url(#eg91-arrow)" /><text x="165" y="108" textAnchor="middle">串行相加</text><rect x="75" y="142" width="180" height="48" rx="8" fill="#e2eee6" /><text x="165" y="172" textAnchor="middle">总耗时 = {result.total}</text></svg><p>选择不同优化对象，两个输入节点和汇总结果同步变化。箭头表示成本相加，不表示调用依赖。</p></>}
    {mode === 'steps' && <><h4>沿证据链走一遍</h4><ol>{['定义目标：例如同一请求的端到端延迟降到 60 单位内。', '固定代表负载：记录基线，并区分计算与等待的成本。', '选择一个目标部分：预测改变它能省多少，保留其他条件。', '验证正确性，再比较重复测量结果；负载变化后重新定位。'].map((text, i) => <li key={text} className={i === cursor ? 'eg91-active' : ''}>{i <= cursor ? text : '下一步待展开'}</li>)}</ol><div className="eg91-actions"><button disabled={!cursor} onClick={() => setCursor(cursor - 1)}>上一步</button><button disabled={cursor === 3} onClick={() => setCursor(cursor + 1)}>下一步</button></div></>}
    {mode === 'try' && <><h4>换负载，重新推导</h4><p>新请求：计算 70、网络 30。只将网络加速 2 倍，总耗时是多少？先独立写预测与理由。</p><label>预测总耗时<input aria-label="帮助预测总耗时" type="number" value={answer} disabled={show} onChange={e => setAnswer(e.target.value)} /></label><label>推导理由<textarea aria-label="帮助预测理由" value={reason} disabled={show} onChange={e => setReason(e.target.value)} rows={2} /></label><div className="eg91-actions"><button disabled={show || answer.trim() === '' || !Number.isFinite(Number(answer)) || !reason.trim()} onClick={() => setShow(true)}>验证这次预测</button><button onClick={() => { setShow(false); setAnswer(''); setReason(''); }}>重新推导</button></div>{show && <div className="eg91-feedback" aria-live="polite"><CostBar cpu={70} network={15} label="新负载结果" /><p>{predictionMatches(answer, 85) ? '预测吻合。' : `你预测 ${answer}，实际模型是 85。`}70 保持不变，只有 30 ÷ 2 = 15；因此 70 + 15 = 85。负载换了，优先优化的目标也可能换。此处仅为帮助练习。</p></div>}</>}
  </section>;
}

