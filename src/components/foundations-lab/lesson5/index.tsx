import { useState } from 'react';
import { compare, evaluate, format, initialInput, repairs, trace, type Input, type Policy } from './model';
import './style.css';
const policies: [Policy, string][] = [['exact', '直接 =='], ['absolute', '绝对容差'], ['combined', '绝对 + 相对容差']];
function ErrorMeter({ difference, threshold }: { difference: number; threshold: number }) {
  const max = Math.max(difference, threshold, Number.MIN_VALUE);
  return <div className="fl5-meter"><p>局部误差尺 · 每次按当前差值与容差缩放，不是原数值轴</p><div><span>实际差值</span><i style={{ width: `${difference / max * 100}%` }} /><code>{difference.toExponential(4)}</code></div><div><span>容差阈值</span><i className="fl5-threshold" style={{ width: `${threshold / max * 100}%` }} /><code>{threshold.toExponential(4)}</code></div><p>{difference === 0 ? '差值为零，精确相等。' : threshold === 0 ? '当前规则不留误差空间。' : difference < threshold ? '差值落在严格容差范围内。' : '差值达到或超出容差边界。'}</p></div>;
}
function Result({ input }: { input: Input }) {
  const r = evaluate(input);
  return <><div className="fl5-values"><div>sum<strong>{format(r.sum)}</strong></div><div>target<strong>{format(r.target)}</strong></div></div><ErrorMeter difference={r.difference} threshold={r.threshold} /><p>当前规则：<strong>{String(r.equal)}</strong></p></>;
}
export default function Lab() {
  const [input, setInput] = useState<Input>(initialInput);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const [comparison, setComparison] = useState(false);
  const reset = () => { setStep(0); setLocked(false); setPrediction(''); setReason(''); setComparison(false); };
  const change = (patch: Partial<Input>) => { setInput({ ...input, ...patch }); reset(); };
  const snapshot = trace(input)[step];
  const result = evaluate(input);
  return <section className="fl5" data-testid="foundations-lab-5"><header><p className="fl5-eyebrow">输入 → 二进制舍入 → 差值 → 业务判定</p><h3>给传感器画一把有误差预算的尺子</h3><p>改一项输入，先预测，再看存储值、加法结果和比较策略怎样联动。</p></header>
    <div className="fl5-controls">{(['a', 'b', 'target'] as const).map(key => <label key={key}>{key}<input type="number" step="0.01" min={-1000} max={1000} value={input[key]} onChange={e => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n) && Math.abs(n) <= 1000) change({ [key]: n }); }} /></label>)}<label>统一尺度<select value={input.scale} onChange={e => change({ scale: Number(e.target.value) })}><option value={1e-9}>× 1e-9</option><option value={1}>× 1</option><option value={1e9}>× 1e9</option></select></label><label>比较策略<select value={input.policy} onChange={e => change({ policy: e.target.value as Policy })}>{policies.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>绝对容差<select value={input.absolute} onChange={e => change({ absolute: Number(e.target.value) })}>{[0, 1e-18, 1e-12, 1e-9, 1e-6].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label>相对容差<select value={input.relative} onChange={e => change({ relative: Number(e.target.value) })}>{[0, 1e-12, 1e-9, 1e-6].map(n => <option key={n} value={n}>{n}</option>)}</select></label></div>
    <p className="fl5-note">绝对容差与读数同单位；相对容差没有单位。组合阈值 = max(绝对容差, 相对容差 × max(|sum|, |target|))。精确相等先通过，其余要求差值严格小于阈值。</p>
    <fieldset disabled={locked}><legend>运行前：当前策略会判断相等吗？</legend><label>预测<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="true">true</option><option value="false">false</option></select></label><label>判断理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="表示误差、数值尺度和容差如何影响结论？" /></label></fieldset>
    <div className="fl5-buttons"><button disabled={step === 3 || (!locked && (!prediction || !reason.trim()))} onClick={() => { setLocked(true); setStep(step + 1); }}>单步执行</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button onClick={reset}>重新预测</button><button onClick={() => { setInput(initialInput); reset(); }}>重置实验</button></div>
    <div className="fl5-model" data-testid="live-model" data-state={JSON.stringify({ ...input, step, locked, comparison })}><ol className="fl5-stages">{['准备', '存入变量', '相加', '比较'].map((name, i) => <li key={name} aria-current={step === i ? 'step' : undefined}>{name}</li>)}</ol><div aria-live="polite"><strong>{snapshot.stage}</strong><p>{snapshot.cause}</p></div>{step >= 1 && <div className="fl5-values"><div>a<strong>{format(result.a)}</strong></div><div>b<strong>{format(result.b)}</strong></div></div>}{step === 2 && <p>sum = <code>{format(result.sum)}</code>；target = <code>{format(result.target)}</code></p>}{step === 3 && <><Result input={input} /><div className="fl5-feedback"><strong>{prediction === String(result.equal) ? '结果与预测一致。' : `你预测 ${prediction}，实际 ${result.equal}。`}</strong><p>运行前理由：{reason}</p><p>下一次只改变尺度或一个容差，检验你的解释是否仍然成立。并非所有浮点加法都有非零差值。</p></div><button onClick={() => setComparison(!comparison)}>{comparison ? '收起策略对照' : '同一输入对照三种策略'}</button>{comparison && <div className="fl5-comparison">{policies.map(([policy, name]) => { const r = evaluate({ ...input, policy }); return <article key={policy}><h4>{name}</h4><p>阈值 {r.threshold.toExponential(4)}</p><strong>{String(r.equal)}</strong></article>; })}</div>}</>}</div>
    <p className="fl5-note">模型边界：仅模拟有限 float64 输入（每项 −1000 至 1000）；使用浏览器 binary64 演示该精度的存储与运算，不执行 Go 编译器。Go 无类型常量表达式 0.1+0.2==0.3 为 true，不能拿它代替变量实验。NaN 不等于任何值；特殊值需另设规则。容差必须来自领域误差预算，金额可按最小货币单位建模。本练习不计正式成绩。</p>
  </section>;
}
function Example() {
  const [ticks, setTicks] = useState(10);
  const [parts, setParts] = useState(3);
  const each = Math.round(1 / parts * ticks) / ticks;
  const total = each * parts;
  return <><h4>拼接刻度尺：先舍入再相加</h4><p>把长度 1 分为若干段。每段只能贴到最近的十进制刻度，观察拼回后的长度。</p><label>每单位刻度数<select value={ticks} onChange={e => setTicks(Number(e.target.value))}>{[10, 100, 1000].map(n => <option key={n}>{n}</option>)}</select></label><label>分成几段<input type="range" min={2} max={7} value={parts} onChange={e => setParts(Number(e.target.value))} />{parts} 段</label><div className="fl5-ruler" data-testid="live-model" data-state={JSON.stringify({ ticks, parts, total })}>{Array.from({ length: parts }, (_, i) => <span key={i}>第 {i + 1} 段<br />{each}</span>)}</div><p>每段理想值 1/{parts} → 刻度读数 {each}；拼回 {total.toFixed(6)}，与 1 差 {Math.abs(total - 1).toExponential(3)}。</p><button onClick={() => { setTicks(10); setParts(3); }}>重置尺子</button><p className="fl5-note">这是十进制定距尺类比：只解释舍入发生在何处。真实 float64 是二进制，间距随数值量级变化，不能用这里的误差量推算 0.1+0.2。</p></>;
}
function Diagram() {
  const [scale, setScale] = useState(1);
  const [focus, setFocus] = useState<'difference' | 'absolute' | 'relative'>('difference');
  const [policy, setPolicy] = useState<Policy>('combined');
  const r = compare(1.000000001 * scale, scale, 1e-9, 1e-8, policy);
  return <><h4>误差路径图：沿一个量追到判定</h4><label>读数量级<select value={scale} onChange={e => setScale(Number(e.target.value))}>{[1e-9, 1, 1e9].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label>接入比较规则<select value={policy} onChange={e => setPolicy(e.target.value as Policy)}>{policies.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><div className="fl5-buttons">{([['difference', '差值路径'], ['absolute', '绝对预算'], ['relative', '相对预算']] as const).map(([key, name]) => <button key={key} aria-pressed={focus === key} onClick={() => setFocus(key)}>{name}</button>)}</div><div className="fl5-route" data-testid="live-model" data-state={JSON.stringify({ scale, focus, policy })}><span>{focus === 'difference' ? `两读数相减 → |a−b| = ${r.difference.toExponential(4)}` : focus === 'absolute' ? '固定同单位预算 → 1e-9' : `当前幅度 ${r.magnitude.toExponential(4)} × 1e-8 → ${(r.magnitude * 1e-8).toExponential(4)}`}</span><span>↓ {policy === 'exact' ? '== 不使用预算' : policy === 'absolute' ? '只使用绝对预算' : '取绝对与相对预算中较大者'}</span><strong>阈值 {r.threshold.toExponential(4)} → {String(r.equal)}</strong><ErrorMeter difference={r.difference} threshold={r.threshold} /></div><p>固定读数比例后改变尺度：相对预算随幅度增长，绝对预算保持不变。点击路径将公式中的量映射到尺子。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [constant, setConstant] = useState(false);
  const runtime = trace(initialInput)[step];
  const constants = ['准备无类型常量表达式 0.1 + 0.2 == 0.3', '常量算术使用高精度规则；未先存入 float64 变量', '此表达式相加得到常量 0.3', '常量比较为 true；若先分别转为 float64 再相加，需按浮点精度求值'];
  return <><h4>两条求值路径：在哪里引入 float64？</h4><label className="fl5-check"><input type="checkbox" checked={constant} onChange={e => { setConstant(e.target.checked); setStep(0); }} />改为无类型常量表达式</label><div className="fl5-route" data-testid="live-model" data-state={JSON.stringify({ constant, step })}><code>{constant ? '0.1 + 0.2 == 0.3' : 'a,b := 0.1,0.2; a+b == 0.3'}</code><strong>步骤 {step + 1}/4</strong><p>{constant ? constants[step] : `${runtime.stage}：${runtime.cause}`}</p>{!constant && step === 1 && <code>a={format(0.1)}; b={format(0.2)}</code>}{!constant && step >= 2 && <code>sum={format(0.1 + 0.2)}</code>}{step === 3 && <strong>结果 {constant ? 'true' : 'false'}</strong>}</div><div className="fl5-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => { setStep(0); setConstant(false); }}>重置推导</button></div><p className="fl5-note">常量路径专门解释这个固定 Go 表达式，展示的是语义推导；没有用 JavaScript 运算冒充 Go 常量计算。</p></>;
}
function Repair() {
  const [policy, setPolicy] = useState<Policy>('absolute');
  const [scenario, setScenario] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const item = repairs[scenario];
  const r = compare(item.left, item.right, 1e-9, 1e-8, policy);
  const clear = () => { setPrediction(''); setReason(''); setChecked(false); };
  return <><h4>修复比较器：三个边界都要守住</h4><p>此任务已给定预算：绝对 1e-9、相对 1e-8。大读数允许差 1，零附近允许差 1e-12，但 0.31 与 0.3 必须判不同。不要通过随意放大容差来“修复”。</p><label>验证样本<select value={scenario} onChange={e => { setScenario(Number(e.target.value)); clear(); }}>{repairs.map((item, i) => <option value={i} key={item.name}>{item.name}</option>)}</select></label><p>left = {item.left}；right = {item.right}</p><label>选择实现<select value={policy} onChange={e => { setPolicy(e.target.value as Policy); clear(); }}>{policies.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><fieldset disabled={checked}><legend>先预测当前实现</legend><label>返回值<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option>true</option><option>false</option></select></label><label>理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="fl5-buttons"><button disabled={checked || !prediction || !reason.trim()} onClick={() => setChecked(true)}>验证修复</button><button onClick={() => { setPolicy('absolute'); setScenario(0); clear(); }}>重置修复</button></div><div data-testid="live-model" data-state={JSON.stringify({ scenario, policy, checked })} aria-live="polite">{checked && <div className="fl5-feedback"><strong>{prediction === String(r.equal) ? '预测一致。' : `实际返回 ${r.equal}。`}{r.equal === item.expected ? '符合此样本的业务预算。' : '尚未符合此样本的业务预算。'}</strong><p>你的理由：{reason}</p><p>{item.explanation}</p><ErrorMeter difference={r.difference} threshold={r.threshold} /><p>下一步切换另一个样本验证，单个通过不足以证明所有尺度都适用。</p></div>}</div><p className="fl5-note">有提示的迁移练习，不记独立掌握。这里的预算只属于此任务。</p></>;
}
export function Help({ mode }: { mode: string }) { return <section className="fl5 fl5-help" data-testid="foundations-help-5">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Repair />}</section>; }
