import { useState } from 'react';
import { bounds, code, evaluate, initialInput, trace, type Input, type Source, type Target, type Snapshot } from './model';
import './style.css';
function Controls({ input, change }: { input: Input; change: (patch: Partial<Input>) => void }) {
  return <div className="fl4-controls"><label>常量值<input inputMode="decimal" value={input.literal} onChange={e => change({ literal: e.target.value })} /></label><label>声明类型<select value={input.source} onChange={e => change({ source: e.target.value as Source })}><option value="untyped">const n = …（无类型）</option><option value="int">const n int = …</option><option value="byte">const n byte = …</option></select></label><label>参数目标类型<select value={input.target} onChange={e => change({ target: e.target.value as Target })}><option value="byte">byte · 0…255</option><option value="uint16">uint16 · 0…65535</option><option value="int">int</option></select></label><label className="fl4-check"><input type="checkbox" checked={input.convert} onChange={e => change({ convert: e.target.checked })} />调用处显式转换为 {input.target}</label></div>;
}
function View({ snapshot }: { snapshot: Snapshot }) { return <><div className="fl4-gates"><div><small>声明</small><strong>{snapshot.declaration}</strong></div><span aria-hidden="true">→</span><div><small>类型门</small><strong>{snapshot.typeGate}</strong></div><span aria-hidden="true">→</span><div><small>可表示性门</small><strong>{snapshot.rangeGate}</strong></div></div><div className="fl4-feedback" aria-live="polite"><strong>{snapshot.operation}</strong><p>{snapshot.cause}</p>{snapshot.output !== null && <output>{snapshot.output}</output>}</div></>; }
const boundary = '模型只处理 -65536…65536 的十进制常量（最多 3 位小数）。byte 是 uint8 的别名。int 范围在本实验输入内不受 32/64 位平台差异影响。图中门是教学检查顺序，不代表编译器内部实现；不模拟变量转换。';
export default function Lab() {
  const [input, setInput] = useState<Input>(initialInput);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const snapshots = trace(input);
  const result = evaluate(input);
  const restart = () => { setStep(0); setPrediction(''); setReason(''); setLocked(false); };
  const change = (patch: Partial<Input>) => { setInput({ ...input, ...patch }); restart(); };
  return <section className="fl4" data-testid="foundations-lab-4"><header><p className="fl4-eyebrow">常量声明 → 类型路径 → 数值范围</p><h3>12 明明放得下，为什么传不进去？</h3><p>给数据包长度换类型、换值，找出“类型允许”和“数值放得下”各自负责什么。</p></header><Controls input={input} change={change} /><pre>{code(input)}</pre><fieldset disabled={locked}><legend>先预测，再提交给检查器</legend><label>这次调用能成立吗？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="yes">能，输出长度</option><option value="no">不能，编译失败</option></select></label><label>依据是什么？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="分别考虑声明类型与目标的整数范围" /></label></fieldset><div className="fl4-buttons"><button disabled={step === 4 || !result.validLiteral || (!locked && (!prediction || !reason.trim()))} onClick={() => { setLocked(true); setStep(step + 1); }}>单步检查</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button onClick={restart}>重新预测</button><button onClick={() => { setInput(initialInput); restart(); }}>重置实验</button></div>{!result.validLiteral && <p role="alert">{result.issue}</p>}<div data-testid="live-model" data-state={JSON.stringify({ input, step, locked, snapshot: snapshots[step] })}><div className="fl4-stages" aria-label="检查阶段">{['预测', '声明', '类型', '可表示性', '结果'].map((name, i) => <span key={name} aria-current={step === i ? 'step' : undefined}>{i} · {name}</span>)}</div><View snapshot={snapshots[step]} /></div>{step === 4 && <div className="fl4-feedback"><strong>{(prediction === 'yes') === result.accepted ? '结果与预测一致。' : `预测与结果不同：实际${result.accepted ? '可以调用' : '编译失败'}。`}</strong><p>你的理由：{reason}</p><p>修复后再挑战边界：把 12 改成 300，检查“去掉 int 就总能传 byte”是否成立。也可试 12.5，观察整数目标的要求。</p><div className="fl4-buttons"><button onClick={() => change({ source: 'untyped', convert: false })}>修复候选：去掉声明类型</button><button onClick={() => change({ convert: true })}>修复候选：显式转换</button></div></div>}<p className="fl4-note">{boundary} 本练习不写入正式掌握成绩。</p></section>;
}
function Example() {
  const [value, setValue] = useState(12);
  const [tagged, setTagged] = useState(true);
  const input: Input = { literal: String(value), source: tagged ? 'int' : 'untyped', target: 'byte', convert: false };
  const result = evaluate(input);
  return <><h4>寄件柜：标签和容量是两回事</h4><p>把常量想成一个包裹，类型是标签。柜子既审核标签，也检查体积；小包裹也可能因标签不兼容被拒。</p><label>包裹数值<input type="range" min="0" max="300" value={value} onChange={e => setValue(Number(e.target.value))} /><output>{value}</output></label><label className="fl4-check"><input type="checkbox" checked={tagged} onChange={e => setTagged(e.target.checked)} />贴上 int 类型标签</label><div data-testid="live-model" data-state={JSON.stringify({ value, tagged, accepted: result.accepted })} className="fl4-parcel"><div>📦 {value}<small>{tagged ? '标签：int' : '未绑定类型'}</small></div><span aria-hidden="true">→</span><div>byte 柜<small>整数 0…255</small></div><strong>{result.accepted ? '已收件' : '被拒绝'}</strong></div><p aria-live="polite">{result.issue}</p><p className="fl4-note">操作：先保留 12，仅撕掉标签；再把值拉到 256。类比边界：类型不是可随意撕掉的运行时标签，实际修改的是常量声明；无类型常量也必须可表示。</p></>;
}
function Diagram() {
  const [input, setInput] = useState<Input>({ ...initialInput, source: 'untyped' });
  const [selected, setSelected] = useState<'type' | 'range'>('type');
  const result = evaluate(input);
  return <><h4>路径图：在同一个数值上切断一条通路</h4><p>选中一道门，在代码、规则和路径之间追踪同一条件。修改控制项会重算路径。</p><Controls input={input} change={patch => setInput({ ...input, ...patch })} /><div className="fl4-buttons"><button aria-pressed={selected === 'type'} onClick={() => setSelected('type')}>追踪类型门</button><button aria-pressed={selected === 'range'} onClick={() => setSelected('range')}>追踪可表示性门</button></div><div data-testid="live-model" data-state={JSON.stringify({ input, selected, result })} className="fl4-route"><code>{selected === 'type' ? `const n${input.source === 'untyped' ? '' : ` ${input.source}`} = ${input.literal}` : `packet(${input.convert ? `${input.target}(n)` : 'n'})`}</code><span>↓ {selected === 'type' ? '无类型适配 / 同类型 / 显式转换' : `整数且在 ${bounds[input.target].join('…')} 之间`}</span><strong>{!result.declaration ? '声明失败，路径未开始' : selected === 'type' ? result.typeAllowed ? '类型路径接通' : '类型路径断开' : result.representable ? '这个值可以表示' : '这个值无法表示'}</strong><span>↓ 总调用：{result.accepted ? '成立' : '失败'}</span></div><p>单个条件成立不保证调用成功：两道门以及常量声明都需要通过。可表示性卡片单独检验数值，即使类型路径已断开，也可对照这个条件。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [convert, setConvert] = useState(false);
  const [literal, setLiteral] = useState('12');
  const input = { ...initialInput, convert, literal };
  return <><h4>反事实回放：在调用处添加转换</h4><p>沿原始路径走一遍，再回到类型检查之前插入 byte(n)。观察这个干预能修复什么、不能修复什么。</p><div className="fl4-buttons"><button aria-pressed={literal === '12'} onClick={() => { setLiteral('12'); setStep(0); }}>保持 12</button><button aria-pressed={literal === '300'} onClick={() => { setLiteral('300'); setStep(0); }}>分支：改为 300</button></div><label className="fl4-check"><input type="checkbox" checked={convert} onChange={e => { setConvert(e.target.checked); setStep(Math.min(step, 1)); }} />在调用处插入 byte(n)，回到类型门前</label><pre>{code(input)}</pre><div data-testid="live-model" data-state={JSON.stringify({ step, input, snapshot: trace(input)[step] })}><View snapshot={trace(input)[step]} /></div><div className="fl4-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 4} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => { setStep(0); setLiteral('12'); setConvert(false); }}>重置回放</button></div></>;
}
function Repair() {
  const original: Input = { literal: '300', source: 'int', target: 'uint16', convert: false };
  const [input, setInput] = useState<Input>(original);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const result = evaluate(input);
  const clear = () => { setChecked(false); setPrediction(''); setReason(''); };
  const success = result.accepted && result.value === 300 && input.target === 'uint16';
  return <><h4>迁移修复：长度 300 的新协议</h4><p>协议要求保留长度 300，并传给 uint16 参数。不能靠把数值改小来冒充修复。自行选择声明或转换路径，再验证。</p><Controls input={input} change={patch => { setInput({ ...input, ...patch }); clear(); }} /><pre>{code(input)}</pre><fieldset disabled={checked}><legend>验证前记录判断</legend><label>当前方案能通过编译吗？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="yes">能</option><option value="no">不能</option></select></label><label>修复依据<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="fl4-buttons"><button disabled={!prediction || !reason.trim() || checked || !result.validLiteral} onClick={() => setChecked(true)}>验证修复</button><button onClick={() => { setInput(original); clear(); }}>重置修复</button></div><div data-testid="live-model" data-state={JSON.stringify({ input, checked })}>{checked && <div className="fl4-feedback" aria-live="polite"><strong>{success ? '通过编译，并保留协议要求。' : '方案尚未满足协议要求。'}</strong><p>{result.issue}</p><p>{(prediction === 'yes') === result.accepted ? '编译预测正确。' : '编译结果与预测不同。'} 你的理由：{reason}</p>{!success && <p>检查三个证据：输出是否仍是 300、参数是否为 uint16、常量是否有合法的类型路径。修改一处后重新验证。</p>}</div>}</div><p className="fl4-note">此迁移练习允许使用提示，不计正式独立掌握。</p></>;
}
export function Help({ mode }: { mode: string }) { return <section className="fl4 fl4-help" data-testid="foundations-help-4">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Repair />}</section>; }
