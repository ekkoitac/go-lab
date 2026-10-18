import { useState } from 'react';
import { copiedPointerArray, copyOrder, snapshot, type Config, type Passing } from './model';
import './style.css';

const baseline: Config = { initial: [8, 5, 2], index: 0, amount: 1, passing: 'value' };
function Cells({ name, values, active = -1 }: { name: string; values: number[]; active?: number }) {
  return <article className="c11-storage"><strong>{name}</strong><div className="c11-cells">{values.map((v, i) => <div key={i} className={active === i ? 'c11-cell c11-changed' : 'c11-cell'}><small>[{i}]</small><b>{v}</b></div>)}</div></article>;
}
export default function Lab() {
  const [config, setConfig] = useState<Config>(baseline);
  const [phase, setPhase] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [seen, setSeen] = useState(false);
  const state = snapshot(config, phase);
  const configure = (next: Config) => { setConfig(next); setPhase(0); setPrediction(''); setReason(''); setSeen(false); };
  const reset = () => configure({ ...baseline, initial: [...baseline.initial] });
  const advance = () => { if (phase === 1) setSeen(true); setPhase(phase + 1); };
  return <section className="c11" data-testid="collections-lab-11">
    <header><p className="c11-eyebrow">库存模拟器 · 值复制 / 地址传递</p><h3>这次扣减写进哪块存储？</h3><p>先设置库存与形参，再单步进入函数、写入和返回。回退可以观察写入前后。</p></header>
    <div className="c11-controls">{config.initial.map((v, i) => <label key={i}>初始库存 [{i}]<input type="number" min={0} max={99} value={v} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 99) configure({ ...config, initial: config.initial.map((x, j) => j === i ? n : x) }); }} /></label>)}
      <label>形参类型<select aria-label="形参类型" value={config.passing} onChange={e => configure({ ...config, passing: e.target.value as Passing })}><option value="value">b [3]int · 数组值</option><option value="pointer">b *[3]int · 数组指针</option></select></label>
      <label>扣减索引<select aria-label="扣减索引" value={config.index} onChange={e => configure({ ...config, index: Number(e.target.value) })}>{[0, 1, 2].map(i => <option key={i} value={i}>[{i}]</option>)}</select></label>
      <label>扣减数量<input type="number" min={0} max={9} value={config.amount} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 9) configure({ ...config, amount: n }); }} /></label></div>
    <pre className="c11-code">{`func reduce(b ${config.passing === 'pointer' ? '*' : ''}[3]int) {
    b[${config.index}] -= ${config.amount}
}
a := [3]int{${config.initial.join(', ')}}
reduce(${config.passing === 'pointer' ? '&' : ''}a)`}</pre>
    <div className="c11-model" data-testid="live-model" data-state={JSON.stringify(state)}>
      <p className="c11-operation">第 {phase} / 3 步 · {state.operation}</p>
      <Cells name="存储 A · 调用者 a" values={state.original} active={phase >= 2 && config.passing === 'pointer' ? config.index : -1} />
      {state.local && (config.passing === 'value' ? <Cells name="存储 B · 函数形参 b" values={state.local} active={phase >= 2 ? config.index : -1} /> : <p className="c11-arrow">形参 b 保存地址 → 存储 A（没有第二份数组）</p>)}
      {phase === 0 && <p>函数尚未调用，形参 b 尚未创建。</p>}
      {phase === 3 && <p>形参 b 已离开作用域；这里仍可观察调用者 a。</p>}
    </div>
    <fieldset disabled={phase >= 2 || seen}><legend>{seen ? '已揭示的探索记录' : '在写入前记录你的预测'}</legend><label>写入后 a[{config.index}] 会是多少？<input inputMode="numeric" value={prediction} onChange={e => setPrediction(e.target.value)} /></label><label>依据是什么？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="说明 b 的写入最终落到 A 还是 B" /></label></fieldset>
    <div className="c11-actions"><button disabled={phase === 3 || (phase === 1 && (!/^-?\d+$/.test(prediction.trim()) || !reason.trim()))} onClick={advance}>{['单步：进入函数', '验证预测并写入', '单步：函数返回', '执行结束'][phase]}</button><button disabled={phase === 0} onClick={() => setPhase(phase - 1)}>回退一步</button><button onClick={reset}>重置实验</button></div>
    <div className="c11-feedback" aria-live="polite">{phase >= 2 ? <><strong>{Number(prediction) === state.original[config.index] ? '预测吻合。' : '预测需要修正。'}</strong><p>你预测 {prediction}；实际 a[{config.index}] = {state.original[config.index]}。{config.passing === 'value' ? '参数传递复制全部整数元素，写入落到 B，A 保持原值。' : '参数传递复制的是地址，b 通过地址写入 A，调用者看到变化。'}{config.amount === 0 && ' 本次减 0，所以数值不变；可改为减 1 来区分两种路径。'}</p><p>你的依据：{reason}</p></> : <p>{phase === 0 ? '下一步创建形参，关注存储数量与访问路径。' : '下一步才执行扣减。先填写预测和依据，再验证。'}</p>}</div>
    <p className="c11-boundary">模型边界：整数数组、顺序执行；负库存是算术结果，不模拟业务校验。A / B 是逻辑存储标记，不代表真实地址或栈堆分配。[3]int 与 [4]int 是不同类型。元素若为指针、切片或 map，数组复制不会递归复制它们引用的对象。本实验仅作探索，不写入正式掌握记录。</p>
  </section>;
}
function Example() {
  const [original, setOriginal] = useState([8, 5, 2]);
  const [paper, setPaper] = useState<number[] | null>(null);
  const [index, setIndex] = useState(0);
  return <><h4>复印库存表：自己决定复制时机</h4><p>原表与复印件上的数字独立。先改原表再复印，与复印后再改原表，结果可能不同。</p><label>操作第几格<select aria-label="操作第几格" value={index} onChange={e => setIndex(Number(e.target.value))}>{[0,1,2].map(i => <option key={i} value={i}>[{i}]</option>)}</select></label><div className="c11-actions"><button onClick={() => setOriginal(original.map((v, i) => i === index ? v - 1 : v))}>原表减 1</button><button onClick={() => setPaper([...original])}>重新复印当前原表</button><button disabled={!paper} onClick={() => setPaper(paper!.map((v, i) => i === index ? v - 1 : v))}>复印件减 1</button><button onClick={() => { setOriginal([8,5,2]); setPaper(null); }}>恢复两张表</button></div><div data-testid="live-model" data-state={JSON.stringify({ original, paper, index })}><Cells name="原表" values={original} />{paper ? <Cells name="复印件" values={paper} /> : <p>尚未复印。</p>}</div><p>复制记录的是那一刻的值，不会自动同步。类比边界：本例是整数；纸上若写的是同一个仓库地址，复印地址不会复制仓库。</p></>;
}
function Diagram() {
  const [action, setAction] = useState<'none' | 'write' | 'replace'>('none');
  const state = copiedPointerArray(action);
  return <><h4>找边界：数组独立，指向的对象也独立吗？</h4><p>初始 x=8、y=5、z=20；a := [2]*int{'{'}&amp;x, &amp;y{'}'}；b := a。选择一个从初始状态开始的操作。</p><div className="c11-actions"><button aria-pressed={action === 'write'} onClick={() => setAction('write')}>执行 *b[0] = 99</button><button aria-pressed={action === 'replace'} onClick={() => setAction('replace')}>执行 b[0] = &amp;z</button><button onClick={() => setAction('none')}>恢复引用图</button></div><div className="c11-model" data-testid="live-model" data-state={JSON.stringify(state)}><p>数组 a 的两个槽：[0] → X　[1] → Y</p><p>数组 b 的两个槽：[0] → {state.b[0]}　[1] → Y</p><div className="c11-objects">{Object.entries(state.objects).map(([id,v]) => <span key={id}>对象 {id} = {v}</span>)}</div></div><p className="c11-feedback">{action === 'none' ? '数组槽位已经复制，但两个槽位里可以保存同一地址。' : action === 'write' ? '解引用写入 X，a[0] 与 b[0] 都能读到 99。复制数组没有复制 X。' : '只替换 b 的地址槽；a[0] 仍指向 X=8，b[0] 改为指向 Z=20。'}</p></>;
}
function Steps() {
  const [order, setOrder] = useState<'copy-first' | 'edit-first'>('copy-first');
  const [step, setStep] = useState(0);
  const state = copyOrder(order, step);
  const operations = order === 'copy-first' ? ['b := a', 'a[1] = 3'] : ['a[1] = 3', 'b := a'];
  return <><h4>反事实：交换复制与修改的顺序</h4><label>执行顺序<select aria-label="执行顺序" value={order} onChange={e => { setOrder(e.target.value as typeof order); setStep(0); }}><option value="copy-first">先复制，再修改原件</option><option value="edit-first">先修改原件，再复制</option></select></label><ol>{operations.map((op,i) => <li key={op} aria-current={step === i + 1 ? 'step' : undefined}><code>{op}</code>{step > i ? ' · 已执行' : ' · 待执行'}</li>)}</ol><div data-testid="live-model" data-state={JSON.stringify(state)}><Cells name="a" values={state.a} />{state.b && <Cells name="b" values={state.b} />}</div><div className="c11-actions"><button disabled={step === 2} onClick={() => setStep(step + 1)}>执行下一条</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>退回上一条</button><button onClick={() => setStep(0)}>重新推导</button></div><p className="c11-feedback">{step === 2 ? `最终 b[1] = ${state.b![1]}；复制只取得执行 b := a 那一刻的数组元素。切换顺序重新检验。` : 'a 初始为 [4 9]。每步执行一条 Go 语句，观察复制发生的时刻。'}</p></>;
}
function Transfer() {
  const [variant, setVariant] = useState(0);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const initial = variant === 0 ? [10,20,30,40] : [7,14,21,28];
  const passing: Passing = variant === 0 ? 'value' : 'pointer';
  const result = snapshot({ initial, passing, index: 2, amount: 6 }, 3).original[2];
  return <><h4>迁移：四天的排班名额</h4><p>下面函数执行后，调用者 slots[2] 是多少？先独立填写结果与理由。反馈前不展示运行状态；只保留本次练习反馈，不计正式成绩。</p><pre className="c11-code">{`func reserve(s ${passing === 'pointer' ? '*' : ''}[4]int) { s[2] -= 6 }
slots := [4]int{${initial.join(', ')}}
reserve(${passing === 'pointer' ? '&' : ''}slots)`}</pre><fieldset disabled={checked}><legend>独立推导</legend><label>slots[2] 的结果<input inputMode="numeric" value={answer} onChange={e => setAnswer(e.target.value)} /></label><label>推导理由<textarea value={reason} rows={2} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="c11-actions"><button disabled={checked || !/^-?\d+$/.test(answer.trim()) || !reason.trim()} onClick={() => setChecked(true)}>提交并核对</button><button onClick={() => { setVariant(1 - variant); setAnswer(''); setReason(''); setChecked(false); }}>换一个新情境</button></div><div data-testid="live-model" data-state={JSON.stringify({ variant, checked, evidence: checked ? 'revealed-practice' : 'unrevealed-attempt', ...(checked ? { result } : {}) })} aria-live="polite">{checked && <p className="c11-feedback">{Number(answer) === result ? '本次独立提交吻合。' : '本次提交需要修正。'}你填 {answer}，实际 {result}。{passing === 'value' ? '形参数组复制后扣减，原数组第三格仍为 30。' : '形参保存调用者数组地址，扣减作用到原数组：21 − 6 = 15。'}你的理由：{reason}。答案现已揭示，继续操作属于探索。</p>}</div></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="c11 c11-help" data-testid="collections-help-11">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}

