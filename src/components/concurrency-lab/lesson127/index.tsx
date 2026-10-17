import { useState } from 'react';
import { consistent, events, initial, labels, run, step, type Model, type Strategy } from './model';
import './style.css';

function Memory({ model: s }: { model: Model }) {
  return <div className="c127-memory" data-testid="live-model" data-state={JSON.stringify(s)}>
    <div className="c127-pointer"><strong>发布入口 → {s.published}</strong><span>写者 → {s.writer ?? '尚未构建'}</span></div>
    <div className="c127-grid">{Object.entries(s.roots).map(([id, root]) => <article key={id}><strong>{id} · 版本 {root.version}</strong><p>嵌套引用 → {root.nested}</p><p>{id === s.published ? '已发布' : '私有构建或旧读者持有'}</p></article>)}{Object.entries(s.nested).map(([id, backend]) => <article key={id}><strong>{id} · 路由对象</strong><p>/api → <b>{backend}</b></p><small>引用它的外层：{Object.entries(s.roots).filter(([, root]) => root.nested === id).map(([key]) => key).join('、')}</small></article>)}</div>
    <div className="c127-grid">{([['旧读者', s.old], ['新读者', s.fresh]] as const).map(([name, reader]) => <article key={name} className={consistent(reader) === false ? 'c127-warning' : ''}><strong>{name}</strong><p>{reader ? `持有 ${reader.root}，已读版本 ${reader.versionSeen}` : name === '旧读者' && s.phase === 6 ? '完成；不再持有旧引用' : '尚未开始'}</p><p>实际读到后端：{reader?.backendSeen ?? '尚未读取'}</p>{consistent(reader) !== null && <b>{consistent(reader) ? '完整版本 ✓' : '混合版本：v1 + green'}</b>}</article>)}</div>
  </div>;
}

export default function Lab() {
  const [history, setHistory] = useState<Model[]>([initial()]);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const s = history[history.length - 1];
  function reset(strategy = s.strategy) { setHistory([initial(strategy)]); setPrediction(''); setReason(''); }
  return <section className="c127" data-testid="concurrency-lab-127">
    <h3>路由发布台：新指针会保护旧读者吗？</h3>
    <p>目标：让旧请求保持 blue、新请求使用 green。逐步追踪外层对象与嵌套引用，找出只复制外层为什么仍会污染旧版。</p>
    <label>更新策略<select value={s.strategy} onChange={event => reset(event.target.value as Strategy)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className="c127-predict"><label>先预测：旧读者最终读到哪个后端？<select value={prediction} disabled={s.phase > 0} onChange={event => setPrediction(event.target.value)}><option value="">请选择预测</option><option value="blue">blue（原版本）</option><option value="green">green（被更新）</option></select></label><label>依据（可选）<input value={reason} disabled={s.phase > 0} onChange={event => setReason(event.target.value)} placeholder="追踪哪个引用仍然共享" /></label></div>
    <div className="c127-actions"><button data-concurrency-action="step" disabled={!prediction || s.phase === 6} onClick={() => setHistory([...history, step(s)])}>单步：{events[s.phase] ?? '已完成'}</button><button data-concurrency-action="back" disabled={history.length === 1} onClick={() => setHistory(history.slice(0, -1))}>回退</button><button data-concurrency-action="reset" onClick={() => reset()}>重置</button></div>
    {!prediction && <p>填写“先预测：旧读者最终读到哪个后端？”后开始单步执行。</p>}
    <p aria-live="polite">进度 {s.phase}/6 · {s.log.at(-1) ?? '入口指向版本 1，读者尚未加载。'}</p>
    <Memory model={s} />
    {s.phase >= 3 && <div className="c127-feedback" role="status"><strong>{prediction === (s.strategy === 'deep' ? 'blue' : 'green') ? '预测符合本次交错。' : '预测需要修正。'}</strong><p>{s.strategy === 'deep' ? '写者只修改 N2；旧读者通过 R1 仍访问 N1。发布 R2 后旧版无需立刻消失。' : '旧读者保存的外层引用仍通向 N1。写者修改 N1 时，旧请求已读到 v1，随后却读到 green；原子替换入口无法撤回这次污染。'}</p>{s.strategy !== 'deep' && <button onClick={() => reset('deep')}>修复：复制嵌套对象，重新预测并验证</button>}</div>}
    <details><summary>模型边界与工具选择</summary><p>这是确定交错的引用模型，不是运行 Go 的性能测试。原地修改在真实 Go 中若与无同步读取重叠，还会产生数据竞争。完整构建并验证后，通过 atomic.Value / atomic.Pointer 发布，且发布后整个可达对象图不再修改。</p><p>同一 Mutex 覆盖完整读写也可保持一致；单所有者消息循环把读取与更新排序。锁可能等待，消息可能排队，快照需复制与暂存旧版；此处未实测任何吞吐或延迟。最后一步移除不再引用的旧对象，仅表示可回收，不表示 Go GC 立即执行。</p></details>
  </section>;
}

function Example() {
  const [strategy, setStrategy] = useState<Strategy>('shallow');
  const result = run(strategy);
  return <><h4>例子：两张菜单共享了同一张价格表</h4><p>外层 R1 / R2 是菜单封面，N1 / N2 是真正的路由内容。更换封面不等于复制内页。</p><label>对照方案<select value={strategy} onChange={e => setStrategy(e.target.value as Strategy)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><div className="c127-grid"><article><strong>旧请求的完整结果</strong><p>版本 {result.old!.versionSeen} → {result.old!.backendSeen}</p><b>{consistent(result.old) ? '内页保留，旧版稳定' : '封面是旧的，内页被改了'}</b></article><article><strong>新请求的完整结果</strong><p>版本 {result.fresh!.versionSeen} → {result.fresh!.backendSeen}</p></article></div><p>读多写少且能整体替换时适合快照；菜单比喻只对应对象引用，并不说明复制成本大小。</p></>;
}
function Diagram() {
  const [deep, setDeep] = useState(false);
  return <><h4>引用关系：沿箭头找共享对象</h4><label className="c127-check"><input type="checkbox" checked={deep} onChange={e => setDeep(e.target.checked)} />为新版分配独立嵌套对象</label><div className="c127-flow"><article>旧读者 → R1 → N1（blue）</article><article>写者 → R2 → {deep ? 'N2（green）' : 'N1（被改为 green）'}</article><article>发布入口 → R2 → {deep ? 'N2' : 'N1'}</article></div><p role="status">{deep ? '两条路径在不同对象结束：写者不触及旧读者持有的对象。' : '两条路径在 N1 汇合：即使外层指针不同，嵌套对象仍共享。'}</p></>;
}
const order = ['完整复制包含嵌套引用的对象图', '在私有副本上更新并验证', '原子发布入口引用', '旧读者完成后释放其引用'];
function Steps() {
  const [completed, setCompleted] = useState(0);
  const [message, setMessage] = useState('从第一个动作开始组装安全发布协议。');
  return <><h4>分步搭建：给发布协议安排顺序</h4><p>读者已经持有旧快照。选择下一项合法操作。</p><div className="c127-actions">{[2, 0, 3, 1].map(index => <button key={index} disabled={index < completed || completed === 4} onClick={() => { if (index === completed) { setCompleted(completed + 1); setMessage(`已完成：${order[index]}`); } else setMessage(`当前还不能“${order[index]}”。先完成：${order[completed]}。`); }}>{order[index]}</button>)}</div><ol>{order.slice(0, completed).map(item => <li key={item}>{item}</li>)}</ol><p role="status">{message}</p><button onClick={() => { setCompleted(0); setMessage('重新组装发布协议。'); }}>重新排列</button></>;
}
function Try() {
  const [strategy, setStrategy] = useState<Strategy>('shallow');
  const [checked, setChecked] = useState(false);
  return <><h4>辅助练习：修好“复制 map 就安全”</h4><p>新 map 中的 Route 指针仍然指向旧 Route。目标：旧请求 v1 / blue，新请求 v2 / green。</p><label>修复动作<select value={strategy} onChange={e => { setStrategy(e.target.value as Strategy); setChecked(false); }}><option value="shallow">仅复制 map，复用 Route 指针</option><option value="inplace">省掉复制，更新旧 map</option><option value="deep">复制被修改的 Route，发布后不再修改</option></select></label><button onClick={() => setChecked(true)}>执行交错并核对不变量</button>{checked && <div className="c127-feedback" role="status"><strong>{consistent(run(strategy).old) ? '修复成立' : '还需要修复'}</strong><p>旧请求：v1 / {run(strategy).old!.backendSeen}；新请求：v2 / green。</p><p>{strategy === 'deep' ? '修改发生在新对象上，旧读者路径保持不变。' : '依据：写者和旧读者都到达 N1。请隔离将被修改的嵌套对象后再次验证。'}</p></div>}<p>本区是带提示的辅助练习，仅保存在当前界面，不计入独立掌握。</p></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="c127" data-testid="concurrency-help-127">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}</section>;
}
