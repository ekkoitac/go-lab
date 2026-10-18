import { useState } from 'react';
import { actions, applyAction, describeChange, initialModel, originalChanged, repairedComparison, type Action, type OrderModel } from './model';
import './style.css';

function Memory({ state }: { state: OrderModel }) {
  const ids = [...new Set([state.original.tags, state.draft.tags])];
  return <div className="t22-memory" data-testid="live-model" data-state={JSON.stringify(state)}>
    <div className="t22-orders">{([['a · 原订单', state.original], ['b · 报价副本', state.draft]] as const).map(([label, order]) => <article key={label}><h4>{label}</h4><div>Qty <strong>{order.qty}</strong> · 独立整数槽</div><div className="t22-link">Tags → <strong>数组 {order.tags}</strong></div><small>描述符：ptr={order.tags}, len=1（省略容量）</small></article>)}</div>
    <svg className="t22-reference-map" viewBox="0 0 440 105" role="img" aria-label={`引用关系：a.Tags 指向 ${state.original.tags}，b.Tags 指向 ${state.draft.tags}`}>
      <text x="100" y="18" textAnchor="middle">a.Tags</text><text x="340" y="18" textAnchor="middle">b.Tags</text>
      <path d={`M100 28 L${ids.length === 1 ? 220 : 100} 72`} /><path d={`M340 28 L${ids.length === 1 ? 220 : 340} 72`} />
      {ids.map((id, i) => { const x = ids.length === 1 ? 220 : i === 0 ? 100 : 340; return <g key={id}><polygon points={`${x - 5},67 ${x + 5},67 ${x},76`} /><text x={x} y="99" textAnchor="middle">数组 {id}</text></g>; })}
    </svg>
    <div className="t22-arrays">{ids.map(id => <article key={id}><h4>底层数组 {id}</h4><div className="t22-cell"><small>[0]</small><strong>{state.arrays[id][0]}</strong></div><p>{[state.original.tags === id && 'a.Tags', state.draft.tags === id && 'b.Tags'].filter(Boolean).join(' 与 ')} → 此数组</p></article>)}</div>
    <p className="t22-caption">{state.original.tags === state.draft.tags ? '两份描述符，共享一份元素存储。' : '描述符分别指向不同的元素存储。'}箭头表示引用，不表示整个结构体共享。</p>
  </div>;
}

export default function Lab() {
  const [history, setHistory] = useState<OrderModel[]>([initialModel()]);
  const [action, setAction] = useState<Action>('element');
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<{ before: OrderModel; after: OrderModel; action: Action; prediction: string; reason: string } | null>(null);
  const [compare, setCompare] = useState(false);
  const state = history[history.length - 1];
  const clear = () => { setPrediction(''); setReason(''); setEvidence(null); setCompare(false); };
  const run = () => {
    const after = applyAction(state, action);
    setEvidence({ before: state, after, action, prediction, reason });
    setHistory([...history, after]); setCompare(false); setPrediction(''); setReason('');
  };
  const comparison = evidence ? repairedComparison(evidence.before, evidence.action) : null;
  return <section className="types-22" data-testid="types-lab-22">
    <header><p className="t22-eyebrow">结构体字段 → 切片描述符 → 底层元素</p><h3>报价副本，究竟改到了谁？</h3><p>已经执行 b := a。选择修改位置，先预测原订单是否变化，再沿引用验证。目标：让副本标签变为 SALE，同时保留原订单 VIP。</p></header>
    <Memory state={state} />
    <label>下一步操作<select value={action} onChange={e => { setAction(e.target.value as Action); clear(); }}>{(Object.keys(actions) as Action[]).map(key => <option key={key} value={key}>{actions[key].title}</option>)}</select></label>
    <pre><code>{actions[action].code}</code></pre>
    <fieldset><legend>执行前留下预测与理由</legend><label>原订单的可见值会改变吗？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="yes">会改变</option><option value="no">保持不变</option></select></label><label>依据哪条字段或引用路径？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="区分修改字段本身与沿引用修改元素" /></label></fieldset>
    <div className="t22-buttons"><button data-types-action="step" disabled={!prediction || !reason.trim()} onClick={run}>执行并验证</button><button disabled={history.length === 1} onClick={() => { setHistory(history.slice(0, -1)); clear(); }}>回退一步</button><button data-types-action="reset" onClick={() => { setHistory([initialModel()]); setAction('element'); clear(); }}>重置实验</button></div>
    {evidence && <div className="t22-feedback" aria-live="polite"><strong>{(evidence.prediction === 'yes') === originalChanged(evidence.before, evidence.after) ? '预测与本次结果一致。' : '预测与本次结果不同。'}</strong><p>你的理由：{evidence.reason}</p><p>{describeChange(evidence.before, evidence.after, evidence.action)}</p><p>下一步：回退到写入前，先复制标签，再修改元素；对比是否满足保留 VIP 的目标。</p><button onClick={() => setCompare(!compare)} aria-expanded={compare}>对照：同一起点先复制标签再操作</button>{compare && comparison && <div className="t22-compare"><article><h4>原操作</h4><Memory state={comparison.unchanged} /></article><article><h4>先复制标签，再执行同一操作</h4><Memory state={comparison.isolated} /></article><p>两边使用执行前的同一快照。若原标签此前已变成 SALE，事后复制不能恢复 VIP；应回退到首次写入前再修复。</p></div>}</div>}
    <p className="t22-boundary">模型边界：只模拟一个 int 与非空 []string 字段，数组编号不是真实地址；不模拟 append 扩容或垃圾回收。复制这些字符串元素足以隔离本例的标签修改，含嵌套指针时需另定业务复制边界。本实验与帮助只记录探索反馈，不计入独立掌握成绩。</p>
  </section>;
}

function Example() {
  const [state, setState] = useState(initialModel(2, '原始附件'));
  return <><h4>复印档案：正文与附件链接</h4><p>Qty 对应档案正文，Tags 对应附件链接。两份档案各有链接槽，但开始都打开同一个附件。</p><Memory state={state} /><div className="t22-buttons"><button onClick={() => setState(applyAction(state, 'quantity'))}>只改副本正文数量</button><button onClick={() => setState(applyAction(state, 'element'))}>沿副本链接改附件</button><button onClick={() => setState(applyAction(state, 'rebind'))}>换副本附件链接</button><button onClick={() => setState(initialModel(2, '原始附件'))}>重置类比</button></div><p>观察原档案：正文修改独立；附件是否被改，取决于两个链接是否相同。边界：并非所有附件都应复制，只读共享或身份关联可能正是业务需求。</p></>;
}

function Diagram() {
  const [state, setState] = useState(initialModel());
  const [focus, setFocus] = useState<'descriptor' | 'element'>('element');
  return <><h4>沿图定位：写的是槽，还是槽指向的元素？</h4><div className="t22-buttons"><button aria-pressed={focus === 'descriptor'} onClick={() => setFocus('descriptor')}>选中 b.Tags 描述符</button><button aria-pressed={focus === 'element'} onClick={() => setFocus('element')}>选中 b.Tags[0] 元素</button></div><div className="t22-feedback">写入路径：{focus === 'descriptor' ? 'b → Tags 槽 → 改接新数组 NEW' : `b → Tags → 数组 ${state.draft.tags} → [0] 改成 SALE`}</div><Memory state={state} /><div className="t22-buttons"><button onClick={() => setState(applyAction(state, focus === 'descriptor' ? 'rebind' : 'element'))}>执行选中路径的写入</button><button onClick={() => setState(initialModel())}>还原连线</button></div><p>先改描述符再改元素，观察 a 的连线是否跟着移动。字段值已复制，所以 b.Tags 的重新赋值不改 a.Tags。</p></>;
}

function Steps() {
  const [step, setStep] = useState(0);
  const [fixed, setFixed] = useState(false);
  const sequence: Action[] = fixed ? ['clone', 'quantity', 'element'] : ['quantity', 'element'];
  const states = [initialModel()];
  sequence.forEach(action => states.push(applyAction(states[states.length - 1], action)));
  return <><h4>逐步修复：将隔离操作放在首次写入前</h4><label><input type="checkbox" checked={fixed} onChange={e => { setFixed(e.target.checked); setStep(0); }} /> 在修改前复制 Tags</label><ol>{sequence.map((action, i) => <li key={action} aria-current={step === i + 1 ? 'step' : undefined}><code>{actions[action].code}</code>{step === i + 1 ? ' ← 当前' : ''}</li>)}</ol><Memory state={states[step]} /><p aria-live="polite">{step === 0 ? '起点：b := a。先检查两份描述符都指向 A。' : describeChange(states[step - 1], states[step], sequence[step - 1])}</p><div className="t22-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === sequence.length} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>回到起点</button></div></>;
}

function Transfer() {
  const [plan, setPlan] = useState<'before' | 'after' | 'replace'>('after');
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [shown, setShown] = useState(false);
  const sequence: Action[] = plan === 'before' ? ['clone', 'element'] : plan === 'after' ? ['element', 'clone'] : ['rebind', 'element'];
  const result = sequence.reduce(applyAction, initialModel(5, 'NEWUSER'));
  const clear = () => { setPrediction(''); setReason(''); setShown(false); };
  return <><h4>换情境：新客订单能保住 NEWUSER 吗？</h4><p>初始 a.Qty=5，a.Tags=[NEWUSER]，b:=a。目标：b 的首标签改成 SALE，a 保留 NEWUSER。先判断方案，再查看结果；这是迁移练习，不计正式成绩。</p><label>操作顺序<select value={plan} onChange={e => { setPlan(e.target.value as typeof plan); clear(); }}><option value="after">先改元素，再复制标签</option><option value="before">先复制标签，再改元素</option><option value="replace">先给 b 换新切片，再改元素</option></select></label><Memory state={shown ? result : initialModel(5, 'NEWUSER')} /><pre>{sequence.map(action => actions[action].code).join('\n')}</pre><fieldset disabled={shown}><legend>预测执行后的原标签</legend><label>a.Tags[0]<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="NEWUSER">NEWUSER</option><option value="SALE">SALE</option><option value="NEW">NEW</option></select></label><label>说明复制时机或引用路径<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="t22-buttons"><button disabled={!prediction || !reason.trim() || shown} onClick={() => setShown(true)}>验证迁移结果</button><button onClick={clear}>重新预测</button></div>{shown && <div aria-live="polite"><p>{prediction === result.arrays[result.original.tags][0] ? '预测吻合。' : '预测需要修正。'}你的理由：{reason}</p><p>{plan === 'after' ? '首次写入时仍共享 A，原标签已经变成 SALE；之后复制只带走当前值，不能还原原标签。' : '写入 SALE 前，b 已指向另一数组，所以 a 的 NEWUSER 保留。替换整个切片可能丢弃原有其他标签；本例只有一个标签。'}</p></div>}</>;
}

export function Help({ mode }: { mode: string }) {
  return <section className="types-22 t22-help" data-testid="types-help-22"><p className="t22-caption">辅助探索 · 不计独立掌握成绩</p>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}

