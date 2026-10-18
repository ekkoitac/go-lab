import { useState } from 'react';
import { initial, kinds, expression, dynamicType, inspect, repair, code, outcomes, type Config, type Value, type Kind, type Operation, type Outcome } from './model';
import './style.css';
function ValueInput({ label, value, onChange }: { label: string; value: Value; onChange: (v: Value) => void }) {
  return <fieldset><legend>{label}</legend><label>动态值种类<select value={value.kind} onChange={e => onChange({ ...value, kind: e.target.value as Kind })}>{Object.entries(kinds).map(([k, name]) => <option key={k} value={k}>{name}</option>)}</select></label>{!['nil', 'nil-slice'].includes(value.kind) && <div className="t28-inputs"><label>{value.kind === 'map' ? '键 a' : '第一个数 a'}<input type="number" min={-99} max={99} value={value.a} onChange={e => onChange({ ...value, a: Math.max(-99, Math.min(99, Math.trunc(Number(e.target.value)))) })} /></label>{value.kind !== 'int' && <label>{value.kind === 'map' ? '值 b' : '第二个数 b'}<input type="number" min={-99} max={99} value={value.b} onChange={e => onChange({ ...value, b: Math.max(-99, Math.min(99, Math.trunc(Number(e.target.value)))) })} /></label>}</div>}</fieldset>;
}
function Predict({ prediction, reason, setPrediction, setReason, locked, keyMode = false }: { prediction: string; reason: string; setPrediction: (p: Outcome) => void; setReason: (s: string) => void; locked: boolean; keyMode?: boolean }) {
  return <fieldset disabled={locked}><legend>运行前留下判断</legend><label>你预测的结果<select value={prediction} onChange={e => setPrediction(e.target.value as Outcome)}><option value="">选择结果</option>{(keyMode ? ['stored', 'panic'] as const : ['true', 'false', 'panic'] as const).map(o => <option key={o} value={o}>{outcomes[o]}</option>)}</select></label><label>依据是什么？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="说明动态类型、值，以及这次操作需要检查什么" /></label></fieldset>;
}
function View({ config, step }: { config: Config; step: number }) {
  const result = inspect(config);
  return <div className="t28-model" data-testid="live-model" data-state={JSON.stringify({ ...config, step, outcome: step === 3 ? result.outcome : 'pending' })}>
    <ol className="t28-stages">{['准备输入', '静态操作', '动态检查', '执行结果'].map((name, i) => <li key={name} aria-current={step === i ? 'step' : undefined}>{i + 1}. {name}</li>)}</ol>
    <div className="t28-flow"><article><small>接口 x · 静态类型 any</small><strong>{dynamicType(config.left) ?? '无动态类型'}</strong><code>{expression(config.left)}</code>{config.operation === 'equal' && <><small>接口 y · 静态类型 any</small><strong>{dynamicType(config.right) ?? '无动态类型'}</strong><code>{expression(config.right)}</code></>}</article><span className="t28-arrow" aria-hidden="true">→</span><article data-active={step === 2}><small>本次操作的检查门</small><strong>{step >= 2 ? result.route[1] : '等待读取操作规则'}</strong><span>{step >= 1 ? result.route[0] : '先预测，再检查'}</span></article><span className="t28-arrow" aria-hidden="true">→</span><article className="t28-slot" data-active={step === 3}><small>{config.operation === 'key' ? 'map 的逻辑键槽' : '布尔结果槽'}</small><strong>{step === 3 ? outcomes[result.outcome] : '尚未执行'}</strong>{config.operation === 'key' && <code>{step === 3 && result.outcome === 'stored' ? `${expression(config.left)} → true` : '∅ 尚无键'}</code>}</article></div>
    <p aria-live="polite">{step === 0 ? '修改输入会清空本轮预测；图中的箭头表示检查顺序。' : step === 1 ? 'any 可以写这些操作，因此能通过这里的静态检查。下一步读取实际动态类型。' : step === 2 ? `${result.route[1]}。下一步执行当前分支，观察是否能到达结果槽。` : result.explanation}</p>
  </div>;
}
export default function Lab() {
  const [config, setConfig] = useState<Config>(initial);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [baseline, setBaseline] = useState<Config | null>(null);
  const result = inspect(config);
  function change(next: Config, keepBaseline = false) { setConfig(next); setStep(0); setPrediction(''); setReason(''); if (!keepBaseline) setBaseline(null); }
  return <section className="types-28" data-testid="types-lab-28"><header><p className="t28-kicker">去重器 · 动态键检查台</p><h3>装进 any 后，谁能进入键槽？</h3><p>保持数值不变，只改变表示或操作，追踪静态检查与运行时检查的分界。</p></header>
    <label>操作<select value={config.operation} onChange={e => change({ ...config, operation: e.target.value as Operation })}><option value="key">写入 map[any]，再用同一键查找</option><option value="equal">比较两个接口 x == y</option><option value="nil">比较接口 x == nil</option></select></label>
    <div className="t28-pair"><ValueInput label="左值 x" value={config.left} onChange={left => change({ ...config, left })} />{config.operation === 'equal' && <ValueInput label="右值 y" value={config.right} onChange={right => change({ ...config, right })} />}</div><pre>{code(config)}</pre><View config={config} step={step} />
    <Predict prediction={prediction} reason={reason} setPrediction={setPrediction} setReason={setReason} locked={step > 0} keyMode={config.operation === 'key'} />
    <div className="t28-actions"><button disabled={step === 3 || !prediction || !reason.trim()} onClick={() => setStep(step + 1)}>{step === 0 ? '提交预测，检查静态类型' : step === 1 ? '读取动态检查条件' : '执行当前分支'}</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button onClick={() => change(initial)}>重置实验</button></div>
    {step === 3 && <aside className="t28-card" aria-live="polite"><strong>{prediction === result.outcome ? '结果与预测一致' : `你预测 ${outcomes[prediction as Outcome]}，实际为 ${outcomes[result.outcome]}`}</strong><p>你的理由：{reason}</p><p>{result.explanation}</p>{config.left.kind === 'slice' && <button onClick={() => { setBaseline(config); change(repair(config), true); }}>保留这两个数，把切片改成 [2]int 再试</button>}</aside>}
    {baseline && <aside className="t28-card"><strong>同一组数值的修复对照</strong><p>原表示 {expression(baseline.left)}：{outcomes[inspect(baseline).outcome]}。</p><p>新表示 {expression(config.left)}：{step === 3 ? outcomes[result.outcome] : '待本轮预测与执行'}。数组长度固定为 2，元素 int 可比较；这不是任意长度切片的通用转换。</p></aside>}
    <p className="t28-boundary">键槽是逻辑示意，不模拟哈希桶布局。这里只列出 int、string、[2]int、[]int、map 和 nil 接口；含接口字段的复合值还要递归检查动态值。可比较也不等于业务身份合理。探索与回放不计独立掌握成绩。</p>
  </section>;
}
function Example() {
  const [point, setPoint] = useState<Value>({ kind: 'slice', a: 1, b: 2 });
  const [shown, setShown] = useState(false);
  const [prediction, setPrediction] = useState('');
  const config: Config = { ...initial, left: point };
  return <><h4>同一坐标，软袋与定长钥匙</h4><p>只改变坐标表示，观察同一个去重器。比喻仅指类型要求，不能据此猜测 Go 的物理内存布局。</p><div className="t28-inputs">{(['a', 'b'] as const).map(k => <label key={k}>坐标 {k}<input type="range" min="-5" max="5" value={point[k]} onChange={e => { setPoint({ ...point, [k]: Number(e.target.value) }); setShown(false); setPrediction(''); }} /><output>{point[k]}</output></label>)}</div><label>先说明两种表示会怎样，为什么<textarea rows={2} value={prediction} disabled={shown} onChange={e => setPrediction(e.target.value)} /></label><div className="t28-actions"><button disabled={!prediction.trim() || shown} onClick={() => setShown(true)}>对同一坐标执行两次写入</button><button onClick={() => { setShown(false); setPrediction(''); }}>重新预测</button></div><div className="t28-pair" data-testid="live-model" data-state={JSON.stringify({ point, shown })}>{[config, repair(config)].map(c => <article className="t28-card" key={c.left.kind}><strong>{expression(c.left)}</strong><p>↓ map[any]bool 的逻辑键槽</p><code>{shown ? inspect(c).outcome === 'stored' ? `${expression(c.left)} → true` : '∅ 写入触发 panic' : '∅ 等待实验'}</code>{shown && <p>{inspect(c).explanation}</p>}</article>)}</div></>;
}
function Diagram() {
  const [right, setRight] = useState<Value>({ kind: 'slice', a: 1, b: 2 });
  const [selected, setSelected] = useState<'type' | 'value' | null>(null);
  const [ran, setRan] = useState(false);
  const config: Config = { ...initial, operation: 'equal', right };
  return <><h4>给接口比较接上正确的检查路径</h4><p>左边固定为 any([]int&#123;1,2&#125;)。改变右边，先选择比较器的下一站，再让模型沿真实分支运行。</p><ValueInput label="右接口 y" value={right} onChange={v => { setRight(v); setRan(false); setSelected(null); }} /><div className="t28-actions"><button aria-pressed={selected === 'type'} onClick={() => { setSelected('type'); setRan(false); }}>先连接动态类型检查</button><button aria-pressed={selected === 'value'} onClick={() => { setSelected('value'); setRan(false); }}>直接连接内部值比较</button><button disabled={!selected || ran} onClick={() => setRan(true)}>运行所选路径并核对</button><button onClick={() => { setSelected(null); setRan(false); }}>拆除路径</button></div><div className="t28-wiring" data-testid="live-model" data-state={JSON.stringify({ right, selected, ran })}><span>两个 any 值</span><span aria-hidden="true">↓</span><strong>{selected === 'type' ? '动态类型检查' : selected === 'value' ? '内部值比较' : '尚未接线'}</strong><span aria-hidden="true">↓</span><span>{ran ? `${selected === 'type' ? '路径正确' : '缺少前置检查'}：真实结果 ${outcomes[inspect(config).outcome]}` : '等待核对'}</span></div>{ran && <p aria-live="polite">{inspect(config).explanation} {selected === 'value' && '先按类型分流，才能决定是否继续比较内部值。'}</p>}</>;
}
function Steps() {
  const [config, setConfig] = useState<Config>({ ...initial, operation: 'equal', left: { kind: 'nil-slice', a: 0, b: 0 }, right: { kind: 'nil-slice', a: 0, b: 0 } });
  const [step, setStep] = useState(0);
  return <><h4>两个 nil 切片，为什么仍会中断？</h4><p>逐步跟随解释器，再从同一个左值分叉：改为检查接口与 nil。直接写 slice == nil 合法，但装入接口后的 x == nil 检查接口是否为空。</p><pre>{code(config)}</pre><View config={config} step={step} /><div className="t28-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>回到上一检查点</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>执行下一步</button><button onClick={() => { setConfig({ ...config, operation: config.operation === 'equal' ? 'nil' : 'equal' }); setStep(0); }}>保留 nil 切片，切换比较对象</button><button onClick={() => { setConfig({ ...config, operation: 'equal' }); setStep(0); }}>重置推演</button></div></>;
}
function Transfer() {
  const [right, setRight] = useState<Value>({ kind: 'slice', a: 3, b: 4 });
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [ran, setRan] = useState(false);
  const config: Config = { ...initial, operation: 'equal', left: { kind: 'slice', a: 3, b: 4 }, right };
  const r = inspect(config);
  return <><h4>找反例：只要 any 中有切片，== 就必定 panic？</h4><p>左边固定为切片接口，构造一个能推翻这句话的右值。还要解释“两个动态类型相同”是否必要。</p><ValueInput label="构造反例的右值" value={right} onChange={v => { setRight(v); setRan(false); setPrediction(''); setReason(''); }} /><pre>{code(config)}</pre><Predict prediction={prediction} reason={reason} setPrediction={setPrediction} setReason={setReason} locked={ran} /><div className="t28-actions"><button disabled={!prediction || !reason.trim() || ran} onClick={() => setRan(true)}>检验这个反例</button><button onClick={() => { setRan(false); setPrediction(''); setReason(''); }}>重新推理</button></div><div className="t28-card" data-testid="live-model" data-state={JSON.stringify({ config, ran, outcome: ran ? r.outcome : 'pending' })} aria-live="polite">{ran ? <><strong>{r.outcome === 'panic' ? '这个输入还不能推翻原说法' : '找到了反例：本次比较没有 panic'}</strong><p>预测 {outcomes[prediction as Outcome]}；实际 {outcomes[r.outcome]}。</p><p>{r.explanation}</p><p>你的解释：{reason}</p></> : '等待提交预测与理由，再验证反例。'}</div></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="types-28 t28-help" data-testid="types-help-28">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="t28-boundary">这是可操作的辅助理解区；示例、提示与反例练习均不计独立掌握成绩。</p></section>;
}
