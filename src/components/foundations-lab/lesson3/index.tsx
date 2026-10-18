import { useState } from 'react';
import { inspect, narrow, snapshot, validInput, type Policy } from './model';
import './style.css';
const policies: [Policy, string][] = [['direct', '直接转换'], ['before', '转换前检查'], ['after', '转换后检查'], ['constant', '编译期常量']];
function Bits({ bits, muted = false }: { bits: string; muted?: boolean }) {
  return <div className={`fl3-bits ${muted ? 'fl3-discard' : ''}`} aria-label={`二进制 ${bits}`}>{bits.split('').map((bit, i) => <span key={i}>{bit}</span>)}</div>;
}
export default function Lab() {
  const [input, setInput] = useState(300);
  const [policy, setPolicy] = useState<Policy>('direct');
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState(0);
  const [committed, setCommitted] = useState(false);
  const [compare, setCompare] = useState(false);
  const invalidate = () => { setStep(0); setCommitted(false); setPrediction(''); setReason(''); setCompare(false); };
  const changeInput = (n: number) => { if (validInput(n)) { setInput(n); invalidate(); } };
  const reset = () => { setInput(300); setPolicy('direct'); invalidate(); };
  const config = { input, policy };
  const result = inspect(config);
  const state = snapshot(config, step);
  const code = policy === 'constant' ? `const n = ${input}\nb := uint8(n)` : `n := int16(${input})\n${policy === 'before' ? 'if n < 0 || n > 255 { return "reject" }\n' : ''}b := uint8(n)${policy === 'after' ? '\nif b < 0 || b > 255 { return "reject" }' : ''}`;
  return <section className="fl3-lab" data-testid="foundations-lab-3">
    <header><p className="fl3-kicker">构造边界 · 预测 · 追踪位宽</p><h3>300 件货，为什么只发出 44？</h3><p>修改数量，把同一输入送过不同的校验位置，找出信息在哪一步丢失。</p></header>
    <div className="fl3-controls"><label>原始数量（int16）<input type="number" min={-32768} max={32767} value={input} onChange={e => changeInput(Number(e.target.value))} /></label><label>转换方案<select value={policy} onChange={e => { setPolicy(e.target.value as Policy); invalidate(); }}>{policies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
    <div className="fl3-buttons" aria-label="边界样例">{[-1, 0, 255, 256, 300].map(n => <button key={n} aria-pressed={input === n} onClick={() => changeInput(n)}>{n}</button>)}</div>
    <pre className="fl3-code">{code}</pre>
    <fieldset disabled={committed}><legend>先记录最终预测</legend><label>最终发送的数字，或“拒绝”/“编译错误”<input value={prediction} onChange={e => setPrediction(e.target.value)} placeholder="写下你预测的结果" /></label><label>理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="哪些位会留下？检查使用的是原值还是转换后的值？" /></label></fieldset>
    <div className="fl3-buttons"><button disabled={step === 3 || !prediction.trim() || !reason.trim()} onClick={() => { setCommitted(true); setStep(step + 1); }}>{step === 0 ? '锁定预测，执行检查' : '执行下一步'}</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button onClick={reset}>重置实验</button></div>
    <div className="fl3-panel" data-testid="live-model" data-state={`${input}:${policy}:${step}:${compare}`} aria-live="polite"><strong>第 {step + 1}/4 帧 · {state.title}</strong><p>{state.note}</p>
      <div className="fl3-grid"><article><h4>输入 · 16 位</h4><p>{input} {input < 0 && '（补码）'}</p><span>高 8 位 {step >= 2 && result.encoded !== null ? '→ 丢弃' : ''}</span><Bits bits={result.sourceBits.slice(0, 8)} muted={step >= 2 && result.encoded !== null} /><span>低 8 位</span><Bits bits={result.sourceBits.slice(8)} /></article><article><h4>输出 · uint8</h4>{step < 2 ? <p>等待执行转换</p> : result.encoded === null ? <p>没有生成字节</p> : <><Bits bits={result.lowBits} /><p>解释为无符号数：<strong>{state.encoded}</strong></p></>}<p>最终结果：{state.output ?? '尚未结束'}</p></article></div>
      {step === 3 && <div className="fl3-feedback"><strong>{prediction.trim() === result.output ? '预测吻合。' : `预测 ${prediction}，实际 ${result.output}。`}</strong><p>你的理由：{reason}</p><p>{result.lost ? '保持这个输入，比较校验前后的位置：结果是否还能代表原始数量？' : '这个样例没有丢失数值；继续试 256 或 -1，才能检验边界。'}</p><button onClick={() => setCompare(!compare)} aria-expanded={compare}>{compare ? '收起' : '展开'}同一输入的四方案对照</button></div>}
      {compare && step === 3 && <div className="fl3-comparison">{policies.map(([id, title]) => <article key={id}><strong>{title}</strong><p>{inspect({ input, policy: id }).output}</p><small>{id === 'before' ? '使用原值检查 0..255' : id === 'after' ? '字节必在 0..255，无法发现丢位' : id === 'constant' ? '编译阶段要求常量可表示' : '运行时截断，不返回 error'}</small></article>)}</div>}
    </div><p className="fl3-scope">模型范围：只模拟 -32768..32767 的整数转 uint8；变量源类型为 int16，常量方案无运行时源类型。原题 uint16(300) 转换结果相同。这里不模拟浮点转换、机器字长或溢出检测 API。探索与提示不计入正式掌握。</p>
  </section>;
}
function Example() {
  const [turns, setTurns] = useState(1);
  const [position, setPosition] = useState(44);
  const total = turns * 256 + position;
  return <><h4>类比：只能显示一圈位置的计数盘</h4><p>每圈有 256 个刻度（0..255）。增加完整圈数，观察“累计件数”与“盘面位置”是否一起改变。</p><div className="fl3-controls"><label>完整圈数<input type="range" min={0} max={4} value={turns} onChange={e => setTurns(Number(e.target.value))} /></label><label>圈内位置<input type="number" min={0} max={255} value={position} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 255) setPosition(n); }} /></label></div><div className="fl3-grid" data-testid="live-model" data-state={`${turns}:${position}`}><article><h4>累计计数</h4><strong>{turns} × 256 + {position} = {total}</strong></article><article><h4>盘面只保留位置</h4><div className="fl3-dial">{narrow(total)}</div></article></div><p>改变圈数后，输入每次增加 256，盘面位置保持 {position}。高位记录的完整圈数被丢弃，无法靠盘面还原。</p><button onClick={() => { setTurns(1); setPosition(44); }}>重置计数盘</button><p className="fl3-scope">类比仅表达非负数取模；不是十进制截后两位，也没有模拟负数补码。</p></>;
}
function Diagram() {
  const [value, setValue] = useState(300);
  const source = value.toString(2).padStart(16, '0');
  return <><h4>位权联动：亲手翻转一位</h4><p>点击位格，构造 0..65535 的位串。这里把高字节单独做无符号位权图；输入数值与低字节同步变化。</p><div className="fl3-bit-editor" data-testid="live-model" data-state={value}>{[15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0].map((power, i) => <button key={power} aria-label={`翻转第 ${power} 位，权重 ${2 ** power}，当前 ${source[i]}`} aria-pressed={source[i] === '1'} className={power >= 8 ? 'fl3-high' : ''} onClick={() => setValue(value ^ (1 << power))}><small>2^{power}</small><strong>{source[i]}</strong></button>)}</div><div className="fl3-panel"><p>位串的无符号值：{value}</p><p>uint8 保留低字节：{value % 256}</p><p>高字节贡献：{Math.floor(value / 256) * 256} → 转换时丢弃</p></div><button onClick={() => setValue(300)}>恢复 300 的位串</button><p className="fl3-scope">此图将 16 位按 uint16 解释，与主实验的 int16 负数解释不同；保留低 8 位的规则相同。翻转高位不会改变低字节，翻转低位会改变输出。</p></>;
}
function Steps() {
  const [position, setPosition] = useState<Policy>('after');
  const [phase, setPhase] = useState(0);
  const r = snapshot({ input: 300, policy: position }, phase);
  return <><h4>诊断修复：把检查移到能看见原值的位置</h4><p>目标：越界数量必须拒绝发送。原实现先转成字节再检查。移动检查位置，然后逐步追踪使用的值。</p><label>放置范围检查<select value={position} onChange={e => { setPosition(e.target.value as Policy); setPhase(0); }}><option value="after">转换后检查 b</option><option value="before">转换前检查 n</option></select></label><div className="fl3-route"><span>n = 300</span><span>{position === 'before' ? '检查 n' : 'uint8(n)'}</span><span>{position === 'before' ? 'uint8(n)' : '检查 b'}</span><span>发送</span></div><div className="fl3-panel" data-testid="live-model" data-state={`${position}:${phase}`} aria-live="polite"><strong>{r.title}</strong><p>{r.note}</p>{phase === 3 && <p>{r.output === '拒绝' ? '修复达成：原始 300 被拒绝，没有错误字节发出。' : '问题仍在：发送 44；检查的是已经丢失高位的字节。下一步把检查移到转换前。'}</p>}</div><div className="fl3-buttons"><button disabled={phase === 0} onClick={() => setPhase(phase - 1)}>上一步</button><button disabled={phase === 3} onClick={() => setPhase(phase + 1)}>下一步</button><button onClick={() => { setPosition('after'); setPhase(0); }}>重置诊断</button></div></>;
}
function Transfer() {
  const [candidate, setCandidate] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const n = Number(candidate);
  const valid = candidate.trim() !== '' && Number.isInteger(n) && n >= 256 && n <= 32767;
  return <><h4>目标反推：为“字节相同就是数量相同”找反例</h4><p>库存 A = 17。构造另一个 256..32767 的整数库存 B，让两者直接转换为 uint8 后相同。先写输入与推导，再核对。</p><fieldset disabled={checked}><legend>构造碰撞输入</legend><label>库存 B<input type="number" min={256} max={32767} value={candidate} onChange={e => setCandidate(e.target.value)} /></label><label>为什么它会和 17 得到相同字节？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="fl3-buttons"><button disabled={!valid || !reason.trim() || checked} onClick={() => setChecked(true)}>核对反例</button><button onClick={() => { setCandidate(''); setReason(''); setChecked(false); }}>重新构造</button></div><div data-testid="live-model" data-state={`${candidate}:${checked}`} aria-live="polite">{checked && valid && <div className="fl3-feedback"><strong>{narrow(n) === 17 ? '反例成立：不同输入碰撞到同一字节。' : '尚未达到目标：低 8 位不同。'}</strong><p>A：17 → 17；B：{n} → {narrow(n)}。</p><p>你的理由：{reason}</p><p>差值 {n - 17} {((n - 17) % 256) === 0 ? '是' : '不是'} 256 的整数倍。要保留原始数量的有效性，必须在转换前校验；本例 B 应被拒绝。</p></div>}</div><p className="fl3-scope">这是辅助迁移练习，不写入正式掌握记录。</p></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="fl3-lab fl3-help" data-testid="foundations-help-3">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}

