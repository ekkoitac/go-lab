import { useState } from 'react';
import { initialInput, labels, operations, trace, type Input, type Kind, type Operation, type Outcome, type Setup, type Snapshot } from './model';
import './style.css';
const kinds: [Kind, string][] = [['slice', '切片 []int'], ['map', 'map[string]int'], ['pointer', '指针 *int'], ['channel', 'channel chan int']];
const outcomes: [Outcome, string][] = [['success', '操作完成'], ['panic', 'panic'], ['blocked', '阻塞不返回']];
function View({ state }: { state: Snapshot }) {
  return <div className="fl8-model"><div className="fl8-route"><div><small>变量与类型</small><strong>{state.resource}</strong><b>{state.nil ? 'nil' : '非 nil'}</b></div><span aria-hidden="true">→</span><div><small>底层对象 / 内容</small>{state.nil ? <strong>没有对象</strong> : state.cells.length ? <div className="fl8-cells">{state.cells.map((cell, i) => <b key={i}>{cell}</b>)}</div> : <strong>已分配 · 内容为空</strong>}</div></div><code>{state.code}</code><div className="fl8-feedback" aria-live="polite"><strong>{state.stage}：{state.output}</strong><p>{state.cause}</p></div></div>;
}
function Guess({ answer, reason, locked, setAnswer, setReason }: { answer: string; reason: string; locked: boolean; setAnswer: (v: string) => void; setReason: (v: string) => void }) {
  return <fieldset disabled={locked}><legend>先预测，再验证</legend><label>这次操作的结果<select value={answer} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option>{outcomes.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>依据哪个类型规则？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="说明存储、消息或引用是否已经存在。" /></label></fieldset>;
}
export default function Lab() {
  const [input, setInput] = useState<Input>(initialInput);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const states = trace(input);
  const reset = () => { setStep(0); setAnswer(''); setReason(''); setLocked(false); };
  const change = (patch: Partial<Input>) => { setInput({ ...input, ...patch }); reset(); };
  return <section className="fl8" data-testid="foundations-lab-8"><header><p className="fl8-eyebrow">类型 × 操作 × 初始化</p><h3>同样是 nil，下一步能做什么？</h3><p>选一个类型和操作，预测后单步执行。遇到失败，改变准备条件，再验证修复。</p></header><div className="fl8-controls"><label>具体类型<select value={input.kind} onChange={e => { const kind = e.target.value as Kind; change({ kind, operation: operations[kind][0], setup: 'nil' }); }}>{kinds.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>尝试操作<select value={input.operation} onChange={e => change({ operation: e.target.value as Operation })}>{operations[input.kind].map(op => <option key={op} value={op}>{labels[op]}</option>)}</select></label><label>准备条件<select value={input.setup} onChange={e => change({ setup: e.target.value as Setup })}><option value="nil">保持 nil</option><option value="ready">{input.kind === 'pointer' ? 'new(int)' : input.kind === 'channel' ? 'make：容量 1，空缓冲' : 'make：空容器'}</option>{input.kind === 'channel' && <><option value="filled">make：容量 1，已有一条消息</option><option value="closed">make 后 close：空且已关闭</option></>}</select></label><label>写入 / 预置消息的值<input type="number" min={-9} max={99} value={input.value} onChange={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= -9 && value <= 99) change({ value }); }} /></label></div><Guess answer={answer} reason={reason} locked={locked} setAnswer={setAnswer} setReason={setReason} /><div className="fl8-buttons"><button disabled={step === 2 || !answer || !reason.trim()} onClick={() => { setLocked(true); setStep(step + 1); }}>单步执行</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>撤回一步</button><button onClick={reset}>重新预测</button><button onClick={() => { setInput(initialInput); reset(); }}>重置实验</button></div><div data-testid="live-model" data-state={JSON.stringify({ ...input, step, outcome: states[step].outcome, cells: states[step].cells })}><ol className="fl8-stages">{states.map((s, i) => <li aria-current={step === i ? 'step' : undefined} key={s.stage}>{s.stage}</li>)}</ol><View state={states[step]} /></div>{step === 2 && <div className="fl8-feedback"><strong>{answer === states[2].outcome ? '结果符合预测。' : `你预测“${outcomes.find(([v]) => v === answer)?.[1]}”，实际是“${outcomes.find(([v]) => v === states[2].outcome)?.[1]}”。`}</strong><p>运行前的理由：{reason}</p><p>下一轮只改一个准备条件，检验你的解释。撤回只回放状态，不清除已经看过结果的记录。</p>{input.setup === 'nil' && <button onClick={() => change({ setup: 'ready' })}>加入初始化，重新预测并运行</button>}</div>}<p className="fl8-note">模型边界：只模拟一个操作；channel 容量为 1，没有其他 goroutine 配对。阻塞停留在等待状态，不等于 panic 或进程死锁判定。nil channel 不等于 closed；接口的动态类型与 nil 在第 24 课讨论。这里的辅助探索不计正式掌握。</p></section>;
}
function Example() {
  const [ready, setReady] = useState(false);
  const [ran, setRan] = useState(false);
  const [value, setValue] = useState(7);
  return <><h4>两种收纳方式：追加清单与登记账本</h4><p>给两边同一个数字，只改变是否提前初始化。运行后看存储是否出现、写入是否完成。</p><label>存入数字<input type="range" min={0} max={9} value={value} onChange={e => { setValue(Number(e.target.value)); setRan(false); }} />{value}</label><label className="fl8-check"><input type="checkbox" checked={ready} onChange={e => { setReady(e.target.checked); setRan(false); }} />先分配两个空容器</label><div className="fl8-buttons"><button onClick={() => setRan(true)}>同时尝试存入</button><button onClick={() => { setReady(false); setRan(false); setValue(7); }}>重置对照</button></div><div className="fl8-comparison" data-testid="live-model" data-state={JSON.stringify({ ready, ran, value })}>{(['slice', 'map'] as const).map(kind => <article key={kind}><h4>{kind === 'slice' ? '清单：append 返回新切片' : '账本：按键写入 map'}</h4><View state={trace({ kind, operation: kind === 'slice' ? 'append' : 'write', setup: ready ? 'ready' : 'nil', value })[ran ? 2 : 1]} /></article>)}</div><p className="fl8-note">类比只帮助区分操作：append 有返回值，map 写入不自动分配。现实中的“空收纳工具”不能代替 Go 的类型规则。</p></>;
}
function Diagram() {
  const [kind, setKind] = useState<Kind>('map');
  const [ready, setReady] = useState(false);
  const [ran, setRan] = useState(false);
  const input: Input = { kind, operation: kind === 'map' ? 'write' : operations[kind][0], setup: ready ? 'ready' : 'nil', value: 7 };
  const state = trace(input)[ran ? 2 : 1];
  return <><h4>连接图：变量能找到什么对象？</h4><div className="fl8-buttons">{kinds.map(([v, label]) => <button key={v} aria-pressed={kind === v} onClick={() => { setKind(v); setRan(false); }}>{label}</button>)}</div><div className="fl8-buttons"><button aria-pressed={ready} onClick={() => { setReady(!ready); setRan(false); }}>{ready ? '移除分配，回到 nil' : '连接已分配对象'}</button><button onClick={() => setRan(true)}>沿连接执行：{labels[input.operation]}</button></div><div data-testid="live-model" data-state={JSON.stringify({ kind, ready, ran, nil: state.nil })}><View state={state} /></div><p>连线表示变量可访问底层对象。append 的返回值赋回变量后会建立路径；map 写入和指针解引用不会自行建立路径。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [repair, setRepair] = useState(false);
  const nilRead = trace({ ...initialInput, operation: 'read' })[2];
  const write = trace({ ...initialInput, setup: repair ? 'ready' : 'nil' });
  const state = step === 0 ? write[0] : step === 1 ? nilRead : step === 2 ? write[1] : write[2];
  return <><h4>读取成功，能推出写入也成功吗？</h4><p>回放同一条 map 路径：声明 → 读取缺失键 → 可选初始化 → 写入。读取不会给 map 分配存储。</p><label className="fl8-check"><input type="checkbox" checked={repair} onChange={e => { setRepair(e.target.checked); setStep(Math.min(step, 1)); }} />在写入前插入 make</label><div data-testid="live-model" data-state={JSON.stringify({ step, repair, nil: state.nil, cells: state.cells })}><ol className="fl8-stages">{['声明', '读取', '准备写入', '写入'].map((label, i) => <li key={label} aria-current={i === step ? 'step' : undefined}>{label}</li>)}</ol><View state={state} /></div><div className="fl8-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => { setStep(0); setRepair(false); }}>重置推导</button></div></>;
}
function Repair() {
  const [setup, setSetup] = useState<Setup>('nil');
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [ran, setRan] = useState(false);
  const states = trace({ kind: 'channel', operation: 'receive', setup, value: 7 });
  const clear = () => { setRan(false); setAnswer(''); setReason(''); };
  return <><h4>修复接收：让结果成为 7，且 ok=true</h4><p>没有其他发送者。只做 make 够不够？关闭空 channel 又会返回什么？改变准备步骤再运行。</p><label>组装接收前的步骤<select value={setup} onChange={e => { setSetup(e.target.value as Setup); clear(); }}><option value="nil">var ch chan int</option><option value="ready">make(chan int, 1)</option><option value="filled">make(chan int, 1) → 发送 7</option><option value="closed">make(chan int, 1) → close(ch)</option></select></label><Guess answer={answer} reason={reason} locked={ran} setAnswer={setAnswer} setReason={setReason} /><div className="fl8-buttons"><button disabled={ran || !answer || !reason.trim()} onClick={() => setRan(true)}>执行接收</button><button onClick={() => { setSetup('nil'); clear(); }}>重置修复</button></div><div data-testid="live-model" data-state={JSON.stringify({ setup, ran, output: ran ? states[2].output : null })}><View state={states[ran ? 2 : 1]} />{ran && <p className="fl8-feedback">{answer === states[2].outcome ? '完成状态符合预测。' : '完成状态与预测不同，请根据缓冲区和关闭状态修正解释。'} {setup === 'filled' ? '收到 7 且 ok=true，达到目标。' : '尚未达到收到 7 且 ok=true 的目标。'} 你的理由：{reason}</p>}</div><p className="fl8-note">模型没有其他 goroutine。这里对照的是 nil、空缓冲、有消息、已关闭且排空四种状态；关闭并不会生成有效消息。</p></>;
}
export function Help({ mode }: { mode: string }) { return <section className="fl8 fl8-help" data-testid="foundations-help-8">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Repair />}<p className="fl8-note">辅助练习与揭晓后的操作均不计入正式独立掌握成绩。</p></section>; }
