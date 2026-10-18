import { useState } from 'react';
import { initialInput, program, resultLabel, trace, type Input, type Policy, type Scenario, type Snapshot } from './model';
import './style.css';
const policies: [Policy, string][] = [['sequential', '连续两条赋值'], ['multiple', '多重赋值'], ['temporary', '显式临时变量']];
function View({ input, state }: { input: Input; state: Snapshot }) {
  const indexed = input.scenario === 'index';
  return <><div className="fl9-cells">{(indexed ? [['i', state.i, 'i'], ['a[0]', state.a, 'a'], ['a[1]', state.b, 'b']] : [['x', state.a, 'a'], ['y', state.b, 'b']]).map(([label, value, key]) => <div key={key} className={state.changed === key ? 'fl9-changed' : ''}><small>{label}</small><strong>{value}</strong>{state.changed === key && <small>本步写入</small>}</div>)}</div><div className={`fl9-saved ${state.changed === 'saved' ? 'fl9-changed' : ''}`}><strong>{input.policy === 'temporary' && !indexed ? '临时变量 oldX / oldY' : '求值快照'}</strong><p>{state.saved.length ? state.saved.join(' · ') : '尚未保存'}</p>{state.targets.length > 0 && <p>写入目标：{state.targets.join(' → ')}</p>}</div><div className="fl9-feedback" aria-live="polite"><strong>{state.operation}</strong><p>{state.cause}</p></div></>;
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return <label>{label}<input type="number" min={-20} max={20} value={value} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= -20 && n <= 20) onChange(n); }} /></label>;
}
export default function Lab() {
  const [input, setInput] = useState<Input>(initialInput);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const [compare, setCompare] = useState(false);
  const states = trace(input);
  const end = step === states.length - 1;
  const restart = () => { setStep(0); setPrediction(''); setReason(''); setLocked(false); setCompare(false); };
  const change = (patch: Partial<Input>) => { setInput({ ...input, ...patch }); restart(); };
  return <section className="fl9" data-testid="foundations-lab-9"><header><p className="fl9-eyebrow">读取旧值 → 保存快照 → 依次写入</p><h3>两格库存，旧值在哪里丢失？</h3><p>先预测结果，再把读取与写入拆开观察。多重赋值仍从左到右写入，关键在于写入前已经完成求值。</p></header><div className="fl9-controls"><label>实验场景<select value={input.scenario} onChange={e => change({ scenario: e.target.value as Scenario })}><option value="swap">交换两个值</option><option value="sum">交换并求旧值之和</option><option value="index">索引提前定位</option></select></label>{input.scenario !== 'index' && <label>实现方式<select value={input.policy} onChange={e => change({ policy: e.target.value as Policy })}>{policies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}<NumberField label={input.scenario === 'index' ? '初始 a[0]' : '初始 x'} value={input.a} onChange={a => change({ a })} /><NumberField label={input.scenario === 'index' ? '初始 a[1]' : '初始 y'} value={input.b} onChange={b => change({ b })} />{input.scenario === 'index' && <label>初始索引 i<select value={input.i} onChange={e => change({ i: Number(e.target.value) })}><option value={0}>0</option><option value={1}>1</option></select></label>}</div><pre>{program(input)}</pre><fieldset disabled={locked}><legend>运行前：预测最终状态</legend><label>预测结果<input value={prediction} onChange={e => setPrediction(e.target.value)} placeholder={input.scenario === 'index' ? '例如 i=1, a=[7, 9]' : '例如 x=9, y=2'} /></label><label>推理理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="第二次写入从哪里读取值？索引何时确定？" /></label></fieldset><div className="fl9-buttons"><button disabled={end || (!locked && (!prediction.trim() || !reason.trim()))} onClick={() => { setLocked(true); setStep(step + 1); }}>单步执行</button><button disabled={!step} onClick={() => setStep(step - 1)}>回退一步</button><button onClick={restart}>重新预测</button><button onClick={() => { setInput(initialInput); restart(); }}>重置实验</button></div><div data-testid="live-model" data-state={JSON.stringify({ ...input, step, state: states[step], locked })}><p className="fl9-stage">第 {step} / {states.length - 1} 步 · {step === 0 ? '执行前' : states[step].operation}</p><View input={input} state={states[step]} /></div>{end && <div className="fl9-feedback"><strong>实际结果：{resultLabel(input, states[step])}</strong><p>你的预测：{prediction}</p><p>你的理由：{reason}</p><p>对照记录，检查是否把“求值”和“写入”交错了。回退可以查看覆盖发生的那一步。</p>{input.scenario !== 'index' && <><button onClick={() => setCompare(!compare)}>{compare ? '收起对照' : '对照三种写法'}</button>{compare && <div className="fl9-comparison">{policies.map(([policy, name]) => { const variant = { ...input, policy }; const frames = trace(variant); return <article key={policy}><h4>{name}</h4><pre>{program(variant)}</pre><strong>{resultLabel(variant, frames[frames.length - 1])}</strong></article>; })}</div>}</>}</div>}<p className="fl9-note">模型边界：小整数、两个存储位置，无副作用与并发；单步展示语义阶段，不代表并发原子性保证。索引例固定执行多重赋值。此实验不写入正式掌握成绩。</p></section>;
}
function Example() {
  const [a, setA] = useState(2);
  const [b, setB] = useState(9);
  const [photo, setPhoto] = useState(true);
  const [step, setStep] = useState(0);
  const input: Input = { ...initialInput, a, b, policy: photo ? 'multiple' : 'sequential' };
  const states = trace(input);
  return <><h4>搬货实验：先拍照，还是直接搬？</h4><p>两个货位互换库存数。改变两格的数值；检查“拍照”能否保留即将被覆盖的旧值。</p><div className="fl9-controls"><NumberField label="货位 x 的库存" value={a} onChange={n => { setA(n); setStep(0); }} /><NumberField label="货位 y 的库存" value={b} onChange={n => { setB(n); setStep(0); }} /><label>搬运规则<select value={String(photo)} onChange={e => { setPhoto(e.target.value === 'true'); setStep(0); }}><option value="true">先拍下两格，再照着照片写</option><option value="false">直接 x←y，再 y←x</option></select></label></div><div data-testid="live-model" data-state={JSON.stringify({ a, b, photo, step })}><View input={input} state={states[step]} /></div><div className="fl9-buttons"><button disabled={step === states.length - 1} onClick={() => setStep(step + 1)}>执行下一步搬运</button><button disabled={!step} onClick={() => setStep(step - 1)}>回看</button><button onClick={() => { setA(2); setB(9); setPhoto(true); setStep(0); }}>重置搬运</button></div><p>映射：货位是变量，照片是已求出的右侧值。类比边界：这里只搬运数值，照片不是 Go 自动创建的对象；写入依次发生。</p></>;
}
function Diagram() {
  const [oldI, setOldI] = useState(0);
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const input: Input = { ...initialInput, scenario: 'index', i: oldI };
  const states = trace(input);
  return <><h4>连线任务：a[i] 的箭头指向哪里？</h4><p>先选择你认为第二次写入会到达的格子，再推进索引赋值。观察箭头会不会跟着新 i 移动。</p><label>旧 i<select value={oldI} onChange={e => { setOldI(Number(e.target.value)); setStep(0); setTarget(null); }}><option value={0}>0</option><option value={1}>1</option></select></label><div className="fl9-buttons">{[0, 1].map(i => <button key={i} disabled={step > 0} aria-pressed={target === i} onClick={() => setTarget(i)}>预测写入 a[{i}]</button>)}</div><div className="fl9-route" data-testid="live-model" data-state={JSON.stringify({ oldI, step, target })}><span>左侧表达式 a[i]</span><span>↓ 求值时 i = {oldI}</span><strong>{step > 0 ? `保存目标 → a[${oldI}]` : '目标尚未定位'}</strong><span>当前 i = {states[step].i}</span></div><View input={input} state={states[step]} /><div className="fl9-buttons"><button disabled={target === null || step === 3} onClick={() => setStep(step + 1)}>推进一阶段</button><button disabled={!step} onClick={() => setStep(step - 1)}>回退</button><button onClick={() => { setStep(0); setTarget(null); }}>重新连线</button></div>{step === 3 && <p aria-live="polite">预测 a[{target}]；实际写入 a[{oldI}]。{target === oldI ? '连线符合提前定位规则。' : '请回退到求值阶段：目标已经保存，不会再用新 i 定位。'}</p>}</>;
}
function Steps() {
  const [order, setOrder] = useState(['write-x', 'evaluate', 'write-y']);
  const [position, setPosition] = useState(0);
  const [notice, setNotice] = useState('');
  const input: Input = { ...initialInput, a: 4, b: 6, scenario: 'sum', policy: 'multiple' };
  const states = trace(input);
  const expected = ['evaluate', 'write-x', 'write-y'];
  const labels: Record<string, string> = { evaluate: '求值：保存 (旧 y, 旧 x+旧 y)', 'write-x': '写第一个目标 x', 'write-y': '写第二个目标 y' };
  return <><h4>教给执行器：安排三个阶段</h4><pre>{program(input)}</pre><p>用上移按钮修复顺序，然后逐条执行。执行器只接受符合 Go 语义的下一步；拒绝时保留当前状态。</p><ol className="fl9-order">{order.map((key, i) => <li key={key}><span>{labels[key]}</span><button disabled={i === 0 || position > 0} onClick={() => { const next = [...order]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; setOrder(next); setNotice(''); }}>上移</button></li>)}</ol><div data-testid="live-model" data-state={JSON.stringify({ order, position })}><View input={input} state={states[position]} /></div><div className="fl9-buttons"><button disabled={position === 3} onClick={() => { if (order[position] !== expected[position]) setNotice(`此时应先${labels[expected[position]]}；尚未执行错误步骤。`); else { setPosition(position + 1); setNotice(position === 2 ? '完成：y=10，使用的是旧 x=4 与旧 y=6。' : '阶段合法，观察新状态再继续。'); } }}>让执行器执行下一条</button><button onClick={() => { setPosition(0); setNotice(''); }}>回到起点并重排</button></div><p aria-live="polite">{notice}</p></>;
}
function Repair() {
  const [policy, setPolicy] = useState<Policy>('sequential');
  const [same, setSame] = useState(true);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [ran, setRan] = useState(false);
  const input: Input = { ...initialInput, a: 4, b: same ? 4 : 7, policy };
  const states = trace(input);
  const final = states[states.length - 1];
  const clear = () => { setRan(false); setPrediction(''); setReason(''); };
  return <><h4>找反例并修复：这个交换真的正确吗？</h4><p>原实现只在 x=y=4 时试过。先寻找能暴露问题的输入，再修改方案，比较同一输入的结果。</p><div className="fl9-controls"><label>检验输入<select value={String(same)} onChange={e => { setSame(e.target.value === 'true'); clear(); }}><option value="true">x=4, y=4</option><option value="false">x=4, y=7</option></select></label><label>待检验方案<select value={policy} onChange={e => { setPolicy(e.target.value as Policy); clear(); }}>{policies.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label></div><pre>{program(input)}</pre><fieldset disabled={ran}><legend>先给出预期与证据</legend><label>预测最终 x、y<input value={prediction} onChange={e => setPrediction(e.target.value)} /></label><label>为什么这组输入能／不能暴露覆盖？<textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} /></label></fieldset><div className="fl9-buttons"><button disabled={ran || !prediction.trim() || !reason.trim()} onClick={() => setRan(true)}>运行并检验交换</button><button onClick={() => { setPolicy('sequential'); setSame(true); clear(); }}>重置诊断</button></div><div data-testid="live-model" data-state={JSON.stringify({ policy, same, ran })}>{ran && <div className="fl9-feedback" aria-live="polite"><strong>实际：{resultLabel(input, final)}</strong><p>你的预测：{prediction}；理由：{reason}</p><p>交换目标：x={input.b}, y={input.a}。{final.a === input.b && final.b === input.a ? same ? '这一组通过，但相等值掩盖覆盖。换成不同值继续检验。' : '不同值也完成交换。检查修复中旧 x 保存在哪里。' : `目标 y=${input.a}，实际 y=${final.b}。第一条赋值覆盖旧 x；改用多重赋值或临时变量再运行。`}</p></div>}</div></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="fl9 fl9-help" data-testid="foundations-help-9">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Repair />}<p className="fl9-note">辅助探索与看过提示后的验证不计入正式独立掌握。</p></section>;
}
