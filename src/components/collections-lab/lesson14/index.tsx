import { useState } from 'react';
import { initial, originalChanged, shared, transition, values, type Action, type State } from './model';
import './style.css';
function Memory({ state }: { state: State }) {
  const ids = [...new Set([state.a.array, state.b.array])];
  return <div className="c14-memory" data-testid="live-model" data-state={JSON.stringify({ arrays: state.arrays, a: state.a, b: state.b, shared: shared(state) })}>
    <div className="c14-descriptors">{(['a', 'b'] as const).map(name => <article key={name}><strong>{name} = [{values(state, name).join(', ')}]</strong><p>{name} → {state[name].array}[0] · len={state[name].length} · cap={state[name].capacity}</p></article>)}</div>
    {ids.map(id => <div key={id}><h4>底层数组 {id}</h4><div className="c14-cells">{state.arrays[id].map((value, index) => <div className="c14-cell" key={index}><small>{id}[{index}]</small><strong>{value}</strong>{(['a', 'b'] as const).map(name => <span key={name}>{state[name].array === id && index < state[name].length ? `${name}[${index}]` : state[name].array === id && index < state[name].capacity ? `${name} 预留位` : '—'}</span>)}</div>)}</div></div>)}
    <p>同一数组编号、同一格才是共享；预留位存在，但不可直接用超出 len 的索引访问。</p>
  </div>;
}
export default function Lab() {
  const [capacity, setCapacity] = useState(4), [history, setHistory] = useState<State[]>([initial()]);
  const state = history[history.length - 1];
  const [kind, setKind] = useState<'append' | 'write'>('append'), [index, setIndex] = useState(0), [value, setValue] = useState(30);
  const [prediction, setPrediction] = useState(''), [reason, setReason] = useState(''), [feedback, setFeedback] = useState('');
  const clear = () => { setPrediction(''); setReason(''); setFeedback(''); };
  const perform = (action: Action) => { setHistory([...history, transition(state, action)]); setIndex(0); clear(); };
  const run = () => {
    const next = transition(state, kind === 'append' ? { kind, value } : { kind, value, index });
    const actual = kind === 'append' ? next.b.array === state.b.array : originalChanged(state, next);
    setFeedback(`${(prediction === 'yes') === actual ? '预测吻合' : '预测需要修正'}：${kind === 'append' ? `b ${actual ? '复用' : '离开'}操作前的数组 ${state.b.array}` : `a 的可见数值${actual ? '改变' : '不变'}`}。a：[${values(state, 'a').join(', ')}] → [${values(next, 'a').join(', ')}]。你的理由：${reason}。可回退后改变容量或先复制，比较同一次操作。`);
    setHistory([...history, next]); setPrediction(''); setReason('');
  };
  const reset = (cap = capacity) => { setHistory([initial(cap)]); setIndex(0); setKind('append'); setValue(30); clear(); };
  return <section className="c14" data-testid="collections-lab-14"><h3>append 之后，谁还坐在同一张桌子？</h3><p>先改变容量，再追加或写入。每次操作都追踪描述符和实际数组；三索引限制与复制可在任一步插入。</p>
    <fieldset><legend>1 · 建立基线</legend><label>切片容量：{capacity}<input aria-label="切片容量" type="range" min={2} max={6} step={1} value={capacity} onChange={e => { const cap = Number(e.target.value); setCapacity(cap); reset(cap); }} /></label><p>调整容量会重新开始：a 的长度固定为 2，初值 [10, 20]；b := a。</p></fieldset>
    <Memory state={state} /><p className="c14-feedback" aria-live="polite">{state.last}</p>
    <fieldset><legend>2 · 选择下一次操作</legend><div className="c14-controls"><label>操作<select aria-label="操作" value={kind} onChange={e => { setKind(e.target.value as typeof kind); clear(); }}><option value="append">b = append(b, 值)</option><option value="write">b[索引] = 值</option></select></label>{kind === 'write' && <label>写入索引<select aria-label="写入索引" value={index} onChange={e => { setIndex(Number(e.target.value)); clear(); }}>{Array.from({ length: state.b.length }, (_, i) => <option key={i}>{i}</option>)}</select></label>}<label>整数值<input type="number" min={-999} max={999} step={1} value={value} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && Math.abs(n) <= 999) { setValue(n); clear(); } }} /></label></div>
    <div className="c14-buttons"><button onClick={() => perform({ kind: 'limit' })}>限制 b 容量到长度</button><button onClick={() => perform({ kind: 'copy' })}>分配新数组并 copy</button></div><code>{kind === 'append' ? `b = append(b, ${value})` : `b[${index}] = ${value}`}</code></fieldset>
    <fieldset><legend>3 · 先预测，再运行</legend><label>{kind === 'append' ? '本次 append 会复用 b 当前的数组吗？' : '本次写入会改变 a 的可见数值吗？'}<select aria-label="我的预测" value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="yes">会</option><option value="no">不会</option></select></label><label>我的依据<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="比较新长度和容量，或说明写入对应哪一个数组格。" /></label></fieldset>
    <div className="c14-buttons"><button disabled={!prediction || !reason.trim() || (kind === 'append' && state.b.length >= 12)} onClick={run}>执行并核对预测</button><button disabled={history.length === 1} onClick={() => { setHistory(history.slice(0, -1)); setIndex(0); clear(); }}>回退一步</button><button onClick={() => reset()}>重置实验</button></div>{state.b.length >= 12 && <p>演示最多追加到 12 项，可继续写入或回退。</p>}<div aria-live="polite">{feedback && <p className="c14-feedback">{feedback}</p>}</div>
    <p className="c14-boundary">模型边界：仅演示整数切片、从第 0 格开始的窗口。扩容示意选择 cap=新长度，不代表 Go 的真实增长策略；语言不保证固定翻倍。三索引限制容量不复制已有元素，显式复制也不能恢复已修改的历史值。</p>
  </section>;
}
function Example() {
  const [seats, setSeats] = useState(3), [state, setState] = useState(() => initial(3)), [appended, setAppended] = useState(false);
  const meal = (n: number) => n === 10 ? '米饭' : n === 20 ? '汤' : n === 30 ? '甜点' : '面条';
  return <><h4>订单桌：加座位与搬桌是两件事</h4><label>原桌座位数<select aria-label="原桌座位数" value={seats} onChange={e => { const n = Number(e.target.value); setSeats(n); setState(initial(n)); setAppended(false); }}><option value={2}>2 个，已满</option><option value={3}>3 个，有空位</option></select></label><div className="c14-buttons"><button disabled={appended} onClick={() => { setState(transition(state, { kind: 'append', value: 30 })); setAppended(true); }}>给 b 追加一份甜点</button><button onClick={() => setState(transition(state, { kind: 'write', index: 0, value: 99 }))}>把 b 第一份餐换为面条</button><button onClick={() => { setState(initial(seats)); setAppended(false); }}>重新摆桌</button></div><div className="c14-descriptors" data-testid="live-model" data-state={JSON.stringify({ seats, appended, a: values(state, 'a'), b: values(state, 'b'), shared: shared(state) })}><article>a 菜单：{values(state, 'a').map(meal).join('、')}<br />始终看桌 A 的前两格</article><article>b 菜单：{values(state, 'b').map(meal).join('、')}<br />指向桌 {state.b.array}</article></div><p>{appended ? shared(state) ? '空位足够，甜点放在 A；a 菜单没有变长，但旧菜仍是同一份。' : '座位不足，b 搬到新桌，复制当时的菜；以后换菜不影响 A，但搬家前已经换过的菜不会还原。' : 'b 最初也指向 A，可以先换菜再追加，观察搬桌是否能撤销先前修改。'}</p><p>类比边界：桌子的新尺寸由实现决定。此图只表达是否搬家，不预测实际分配容量。</p></>;
}
function Diagram() {
  const [cap, setCap] = useState(4), [limited, setLimited] = useState(false), [after, setAfter] = useState(false);
  let state = initial(cap); if (limited) state = transition(state, { kind: 'limit' }); if (after) state = transition(state, { kind: 'append', value: 30 });
  return <><h4>分支图：沿着容量条件追踪数组归属</h4><label>起始 cap<select aria-label="起始 cap" value={cap} onChange={e => { setCap(Number(e.target.value)); setAfter(false); }}><option value={2}>2</option><option value={4}>4</option></select></label><label className="c14-check"><input type="checkbox" checked={limited} onChange={e => { setLimited(e.target.checked); setAfter(false); }} />追加前执行 b = b[:2:2]</label><div className="c14-flow"><span>新长度 3</span><span>比较 b.cap = {limited ? 2 : cap}</span><strong>{3 > (limited ? 2 : cap) ? '超过容量 → 新数组 → 复制原元素' : '容量足够 → 复用当前数组'}</strong><span>返回新描述符给 b；a 描述符不变</span></div><div className="c14-buttons"><button aria-pressed={!after} onClick={() => setAfter(false)}>追踪追加之前</button><button aria-pressed={after} onClick={() => setAfter(true)}>追踪追加之后</button></div><Memory state={state} /><p>{after ? state.last : '注意：勾选容量限制后，追加之前 a 和 b 仍指向 A。'}</p></>;
}
const steps: Action[] = [{ kind: 'limit' }, { kind: 'write', index: 0, value: 99 }, { kind: 'append', value: 30 }, { kind: 'write', index: 0, value: 7 }];
function Steps() {
  const [step, setStep] = useState(0); const state = steps.slice(0, step).reduce(transition, initial());
  const lines = ['b := a', 'b = b[:2:2]', 'b[0] = 99', 'b = append(b, 30)', 'b[0] = 7'];
  return <><h4>拆开边界：限制容量究竟何时隔离？</h4><ol>{lines.map((line, i) => <li key={line} aria-current={step === i ? 'step' : undefined} className={step === i ? 'c14-current' : ''}><code>{line}</code></li>)}</ol><Memory state={state} /><p className="c14-feedback">{state.last}</p>{step >= 3 && <p>a[0] 仍为 99：分配新数组隔离后续写入，但无法撤销追加之前的污染。</p>}<div className="c14-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === steps.length} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>重新推导</button></div></>;
}
function Transfer() {
  const [strategy, setStrategy] = useState('limit'), [answer, setAnswer] = useState(''), [reason, setReason] = useState(''), [checked, setChecked] = useState(false);
  let state = initial(5, [4, 8, 12]); if (strategy !== 'none') state = transition(state, { kind: strategy === 'copy' ? 'copy' : 'limit' });
  state = transition(state, { kind: 'write', index: 1, value: 60 }); state = transition(state, { kind: 'append', value: 16 }); state = transition(state, { kind: 'write', index: 1, value: 70 });
  return <><h4>换情境：校准记录在追加之前已经被改过</h4><p>raw 初值 [4, 8, 12]，len=3 cap=5；work := raw。选择预处理，然后依次执行下列代码，预测最后 raw[1]。本练习不计入正式掌握记录。</p><label>预处理<select aria-label="预处理" value={strategy} onChange={e => { setStrategy(e.target.value); setChecked(false); setAnswer(''); setReason(''); }}><option value="limit">work = work[:3:3]</option><option value="copy">新分配并复制 work</option><option value="none">不处理</option></select></label><pre><code>{'work[1] = 60\nwork = append(work, 16)\nwork[1] = 70'}</code></pre><fieldset disabled={checked}><legend>独立预测后揭晓</legend><label>最后 raw[1] 是多少？<input type="number" value={answer} onChange={e => setAnswer(e.target.value)} /></label><label>两次写入分别访问哪里？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="c14-buttons"><button disabled={checked || !answer.trim() || !Number.isFinite(Number(answer)) || !reason.trim()} onClick={() => setChecked(true)}>验证迁移预测</button><button onClick={() => { setChecked(false); setAnswer(''); setReason(''); }}>重新作答</button></div><div data-testid="live-model" data-state={JSON.stringify({ strategy, checked, result: checked ? values(state, 'a') : null })} aria-live="polite">{checked && <p className="c14-feedback">{Number(answer) === values(state, 'a')[1] ? '预测吻合' : '预测需要修正'}：raw[1] = {values(state, 'a')[1]}。{strategy === 'copy' ? '两次写入均访问独立副本，raw 保持 8。' : strategy === 'limit' ? '第一次写入仍访问 A，所以留下 60；append 后第二次写入新数组，不会把 A 恢复成 8。' : '容量足够，追加复用 A，两次写入均影响 raw，最终为 70。'}你的理由：{reason}</p>}</div></>;
}
export function Help({ mode }: { mode: string }) { return <section className="c14 c14-help" data-testid="collections-help-14">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>; }
