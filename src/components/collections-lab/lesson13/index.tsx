import { useState } from 'react';
import { address, initial, originalChanged, transition, values, type Action, type State } from './model';
import './style.css';

function Memory({ state, selected = 0 }: { state: State; selected?: number }) {
  const linked = selected < state.sale.length ? address(state, 'sale', selected) : null;
  return <div className="c13-memory" data-testid="live-model" data-state={JSON.stringify({ arrays: state.arrays, prices: state.prices, sale: state.sale, selected, linked })}>
    <div className="c13-descriptors">{(['prices', 'sale'] as const).map(name => <article key={name}><strong>{name} = [{values(state, name).join(', ')}]</strong><p>指向 {state[name].array} + {state[name].offset} 格 · len={state[name].length} · cap={state[name].capacity}</p></article>)}</div>
    {(['A', 'B'] as const).filter(a => a === 'A' || state.sale.array === 'B').map(a => <div key={a}><h4>底层数组 {a}</h4><div className="c13-cells">{state.arrays[a].map((n, i) => <div key={i} className={`c13-cell ${linked?.array === a && linked.slot === i ? 'c13-linked' : ''}`}><small>{a}[{i}]</small><strong>{n}</strong><span>{a === 'A' ? `prices[${i}]` : '独立副本'}</span><span>{state.sale.array === a && i >= state.sale.offset && i < state.sale.offset + state.sale.length ? `sale[${i - state.sale.offset}]` : '窗口外'}</span></div>)}</div></div>)}
    <p className="c13-link">{linked ? `sale[${selected}] → ${linked.array}[${state.sale.offset} + ${selected}] → ${linked.array}[${linked.slot}]` : 'sale 是空窗口：没有可索引元素。'} · 地址以数组编号与格偏移表示，不是真实字节地址。</p>
  </div>;
}
export default function Lab() {
  const [history, setHistory] = useState<State[]>([initial()]);
  const state = history[history.length - 1];
  const [low, setLow] = useState(1), [high, setHigh] = useState(4);
  const [target, setTarget] = useState<'prices' | 'sale'>('sale'), [index, setIndex] = useState(0), [value, setValue] = useState(99);
  const [prediction, setPrediction] = useState(''), [reason, setReason] = useState(''), [feedback, setFeedback] = useState('');
  const clear = () => { setPrediction(''); setReason(''); setFeedback(''); };
  const perform = (action: Action) => { const next = transition(state, action); setHistory([...history, next]); setIndex(0); clear(); };
  const canWrite = state[target].length > 0 && index < state[target].length;
  const write = () => {
    const next = transition(state, { kind: 'write', target, index, value });
    const changed = originalChanged(state, next);
    setFeedback(`${(prediction === 'change') === changed ? '预测吻合' : '预测需要修正'}：prices ${changed ? '发生数值变化' : '数值不变'}。操作前 [${values(state, 'prices').join(', ')}] → 操作后 [${values(next, 'prices').join(', ')}]。你的理由：${reason}。下一步可回退，改用独立 copy 后重做相同写入。`);
    setHistory([...history, next]); setPrediction(''); setReason('');
  };
  return <section className="c13" data-testid="collections-lab-13"><h3>两个窗口，到底改了哪一格？</h3><p>移动促销窗口，追踪 sale 的索引如何映射到底层数组，再预测写入是否污染原价。</p>
    <fieldset><legend>1 · 构造引用关系</legend><div className="c13-controls"><label>窗口起点 low<select aria-label="窗口起点 low" value={low} onChange={e => { const n = Number(e.target.value); setLow(n); if (high < n) setHigh(n); clear(); }}>{[0, 1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></label><label>窗口终点 high（不含）<select aria-label="窗口终点 high（不含）" value={high} onChange={e => { setHigh(Number(e.target.value)); clear(); }}>{[0, 1, 2, 3, 4].filter(n => n >= low).map(n => <option key={n}>{n}</option>)}</select></label></div><div className="c13-buttons"><button onClick={() => perform({ kind: 'window', low, high })}>应用 prices[{low}:{high}]</button><button onClick={() => perform({ kind: 'assign' })}>直接赋值 sale = prices</button><button onClick={() => perform({ kind: 'copy' })}>分配新数组并 copy</button></div><p>区间只在点击“应用”后生效；调整窗口或重新赋值不会恢复已经改过的价格。</p></fieldset>
    <Memory state={state} selected={target === 'sale' ? index : 0} />
    <p className="c13-feedback" aria-live="polite">{state.last}</p>
    <fieldset><legend>2 · 准备一次元素写入</legend><div className="c13-controls"><label>写入窗口<select aria-label="写入窗口" value={target} onChange={e => { setTarget(e.target.value as typeof target); setIndex(0); clear(); }}><option value="sale">sale</option><option value="prices">prices</option></select></label><label>窗口内索引<select aria-label="窗口内索引" disabled={!state[target].length} value={index} onChange={e => { setIndex(Number(e.target.value)); clear(); }}>{Array.from({ length: state[target].length }, (_, i) => <option key={i}>{i}</option>)}</select></label><label>写入整数<input type="number" value={value} min={-999} max={999} step={1} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= -999 && n <= 999) { setValue(n); clear(); } }} /></label></div><code>{target}[{index}] = {value}</code>{!canWrite && <p>空切片不能索引；请先建立非空窗口，或选择 prices。</p>}</fieldset>
    <fieldset><legend>3 · 先预测，再验证</legend><label>这次写入后 prices 的数值会变化吗？<select aria-label="这次写入后 prices 的数值会变化吗？" value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="change">会变化</option><option value="same">不变</option></select></label><label>我的映射理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="写入访问哪个数组的哪一格？是否写入了不同的值？" /></label></fieldset>
    <div className="c13-buttons"><button disabled={!canWrite || !prediction || !reason.trim()} onClick={write}>执行写入并核对</button><button disabled={history.length === 1} onClick={() => { setHistory(history.slice(0, -1)); setIndex(0); clear(); }}>回退一步</button><button onClick={() => { setHistory([initial()]); setLow(1); setHigh(4); setTarget('sale'); setIndex(0); setValue(99); clear(); }}>重置实验</button></div>
    <div aria-live="polite">{feedback && <p className="c13-feedback">{feedback}</p>}</div><p className="c13-boundary">模型边界：只演示 []int、双下标切片与 copy，不演示 append 扩容。copy 必须写入新分配的存储才能隔离；若元素是指针、map 或切片，复制元素仍可能共享其引用的对象，并非深复制。</p>
  </section>;
}
function Example() {
  const [copied, setCopied] = useState(false), [changed, setChanged] = useState(false);
  return <><h4>同一货架的观察窗，还是另一排货架？</h4><p>原价窗口覆盖红、蓝、绿三个盒子，促销窗口覆盖蓝、绿。改变促销窗口的来源，再把它看到的第一个盒子换成金色。</p><div className="c13-buttons"><button aria-pressed={!copied} onClick={() => { setCopied(false); setChanged(false); }}>共用货架</button><button aria-pressed={copied} onClick={() => { setCopied(true); setChanged(false); }}>复制到新货架</button><button onClick={() => setChanged(!changed)}>{changed ? '撤回更换' : '更换促销第一盒'}</button></div><div className="c13-descriptors" data-testid="live-model" data-state={JSON.stringify({ copied, changed, original: changed && !copied ? ['红', '金', '绿'] : ['红', '蓝', '绿'], sale: changed ? ['金', '绿'] : ['蓝', '绿'] })}><article>原价窗口：红 / {changed && !copied ? '金' : '蓝'} / 绿</article><article>促销窗口：{changed ? '金' : '蓝'} / 绿<br />指向{copied ? '新货架 B' : '同一货架 A 的第 2 格'}</article></div><p>{copied ? '更换 B 的盒子，不会更换 A 的盒子。' : '窗口不是盒子的副本；两处看到的是同一格。'}类比边界：切片长度是各自的描述信息，窗口变短不会让货架元素消失。</p></>;
}
function Diagram() {
  const [offset, setOffset] = useState(1), [selected, setSelected] = useState(0), [copy, setCopy] = useState(false);
  let state = transition(initial(), { kind: 'window', low: offset, high: 4 });
  if (copy) state = transition(state, { kind: 'copy' });
  return <><h4>关联探索：从局部索引找到物理格</h4><label>截取起点<select aria-label="截取起点" value={offset} onChange={e => { setOffset(Number(e.target.value)); setSelected(0); }}>{[0, 1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></label><label>存储关系<select aria-label="存储关系" value={copy ? 'copy' : 'shared'} onChange={e => setCopy(e.target.value === 'copy')}><option value="shared">共享 A</option><option value="copy">复制到 B</option></select></label><div className="c13-buttons">{values(state, 'sale').map((_, i) => <button key={i} aria-pressed={selected === i} onClick={() => setSelected(i)}>追踪 sale[{i}]</button>)}</div><Memory state={state} selected={selected} /><p>移动起点会改变同一个 sale 索引对应的格；copy 后局部索引从新数组 B 的第 0 格映射。</p></>;
}
const stepActions: Action[] = [{ kind: 'write', target: 'sale', index: 0, value: 99 }, { kind: 'copy' }, { kind: 'write', target: 'sale', index: 0, value: 50 }];
function Steps() {
  const [step, setStep] = useState(0);
  const state = stepActions.slice(0, step).reduce(transition, initial());
  const code = ['sale := prices[1:]', 'sale[0] = 99', 'isolated := make([]int, len(sale)); copy(isolated, sale); sale = isolated', 'sale[0] = 50'];
  return <><h4>分步修复：复制能隔离未来，不能撤销过去</h4><ol>{code.map((line, i) => <li key={line} aria-current={i === step ? 'step' : undefined} className={i === step ? 'c13-current' : ''}><code>{line}</code></li>)}</ol><Memory state={state} /><p className="c13-feedback">第 {step + 1} 步：{state.last}</p>{step >= 2 && <p>注意 A[1] 仍是 99：copy 不会自动恢复被污染的 200。需要回退到写入前，再先复制后写。</p>}<div className="c13-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>重新推导</button></div></>;
}
function Transfer() {
  const [copy, setCopy] = useState(false), [answer, setAnswer] = useState(''), [reason, setReason] = useState(''), [checked, setChecked] = useState(false);
  let before = transition(initial([8, 16, 24, 32]), { kind: 'window', low: 2, high: 4 });
  if (copy) before = transition(before, { kind: 'copy' });
  const result = transition(before, { kind: 'write', target: 'sale', index: 1, value: 7 });
  return <><h4>换情境：传感器校准片段</h4><p>raw := []int{'{8, 16, 24, 32}'}，segment := raw[2:4]，接着执行 segment[1] = 7。预测 raw[3] 的最终数值。本练习不计入正式掌握记录。</p><label>写入之前的处理<select aria-label="写入之前的处理" value={copy ? 'copy' : 'shared'} onChange={e => { setCopy(e.target.value === 'copy'); setChecked(false); setAnswer(''); setReason(''); }}><option value="shared">直接使用 segment</option><option value="copy">先分配新切片并复制 segment</option></select></label><fieldset disabled={checked}><legend>独立提交，再查看模型</legend><label>预测 raw[3]<input type="number" value={answer} onChange={e => setAnswer(e.target.value)} /></label><label>你如何换算索引？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="c13-buttons"><button disabled={!answer.trim() || !Number.isFinite(Number(answer)) || !reason.trim() || checked} onClick={() => setChecked(true)}>验证迁移预测</button><button onClick={() => { setChecked(false); setAnswer(''); setReason(''); }}>重新作答</button></div><div data-testid="live-model" data-state={JSON.stringify({ copy, checked, result: checked ? result.arrays : null })} aria-live="polite">{checked && <p className="c13-feedback">{Number(answer) === result.arrays.A[3] ? '预测吻合' : '预测需要修正'}：raw[3] = {result.arrays.A[3]}。{copy ? 'segment[1] 写入新数组 B[1]；原数组 A[3] 保持 32。' : 'segment[1] 对应 A[2 + 1]，因此改的是 raw[3]。'}你的理由：{reason}</p>}</div></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="c13 c13-help" data-testid="collections-help-13">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}

