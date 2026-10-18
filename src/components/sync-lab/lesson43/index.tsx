import {useState} from 'react';
import {advance, blocked, initial, inspect, rewind, run, strategies, type Actor, type Strategy} from './model';
import './style.css';
const phaseName = {read: '读共享 n', compute: '计算私有值 + 增量', write: '写回共享 n', done: '已完成'};
export default function Lab() {
  const [state, setState] = useState(() => initial());
  const [prediction, setPrediction] = useState('');
  const [savedPrediction, setSavedPrediction] = useState<string | null>(null);
  const view = inspect(state);
  function reset(strategy = state.strategy, value = state.initial, delta = state.delta) { setState(initial(strategy, value, delta)); setSavedPrediction(null); setPrediction(''); }
  return <section className="sync43" data-testid="lesson43-lab">
    <h3>你来调度：把一次自增拆开</h3>
    <p>目标：安排 A、B 的读 → 算 → 写，找出一次增量怎样消失，再比较锁的保护范围。</p>
    <div className="sync43-controls">
      <label>同步边界<select value={state.strategy} onChange={e => reset(e.target.value as Strategy)}>{Object.entries(strategies).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>初值<select value={state.initial} onChange={e => reset(state.strategy, Number(e.target.value))}><option value={0}>0</option><option value={10}>10</option></select></label>
      <label>每份增量<select value={state.delta} onChange={e => reset(state.strategy, state.initial, Number(e.target.value))}><option value={1}>+1</option><option value={2}>+2</option></select></label>
    </div>
    <div className="sync43-predict"><label>先预测你准备安排的最终 n<input inputMode="numeric" type="number" value={prediction} disabled={savedPrediction !== null} onChange={e => setPrediction(e.target.value)}/></label><button disabled={prediction.trim() === '' || savedPrediction !== null} onClick={() => setSavedPrediction(prediction)}>记录预测，开始调度</button>{savedPrediction !== null && <span>已记录：{savedPrediction}。现在选择下一步执行者。</span>}</div>
    <div data-testid="live-model" data-state={JSON.stringify(view)}>
      <div className="sync43-memory"><span>共享内存 n</span><strong>{state.value}</strong><span>锁：{state.owner ? `${state.owner} 持有` : '空闲'}</span><span>保留两份增量的目标：{view.expected}</span></div>
      <div className="sync43-workers">{(['A', 'B'] as Actor[]).map(actor => <article key={actor} className={state.owner === actor ? 'sync43-active' : ''}>
        <h4>任务 {actor}</h4><p>私有副本：<strong>{state.workers[actor].local ?? '尚未读取'}</strong></p><p>下一步：{state.strategy === 'atomic' && state.workers[actor].phase !== 'done' ? 'atomic.Add(n, 增量)' : phaseName[state.workers[actor].phase]}</p>
        {blocked(state, actor) && <p>锁被 {state.owner} 持有；尝试时只能等待。</p>}
        <button disabled={savedPrediction === null || state.workers[actor].phase === 'done'} onClick={() => setState(advance(state, actor))}>执行 {actor} 下一步</button>
      </article>)}</div>
    </div>
    <div className="sync43-actions"><button disabled={!state.previous} onClick={() => setState(rewind(state))}>回退一步</button><button onClick={() => reset()}>重置本实验</button></div>
    <p role="status" className="sync43-feedback">{state.trace.at(-1) ?? '先填预测，再自由安排两个任务。试试先让两人都读取，再分别完成计算和写回。'}</p>
    {view.done && <div className="sync43-result"><strong>{Number(savedPrediction) === state.value ? '本次预测吻合' : `预测 ${savedPrediction}，实际 ${state.value}`}</strong><p>{view.lostUpdate ? `目标 ${view.expected}，实际 ${state.value}：某个写回覆盖了另一份贡献。` : '这条调度保留了两份增量。'}</p><p>{view.raceRisk ? '但原程序的跨任务冲突访问缺少完整同步：本次结果正确也不能证明没有 data race。' : state.strategy === 'access-lock' ? '每次共享读写都使用同一锁，可消除这些访问的数据竞争；分开的临界区仍可能丢失更新。' : '本例所有共享访问采用同一完整更新协议，后来的更新会基于前一次的新值。'}</p></div>}
    <details><summary>展开执行证据（{state.trace.length} 步）</summary><ol>{state.trace.map((entry, i) => <li key={i}>{entry}</li>)}</ol></details>
    <p className="sync43-note">教学模型按你的选择执行确定步骤，并非实际运行含数据竞争的 Go 程序。只锁写入仍缺少对读取的保护；读写分别加锁可以无 data race 却丢失更新。完整锁和原子 Add 的结论限于本例单字段增量，不能推广为多字段事务。</p>
  </section>;
}
function Example() {
  const [whole, setWhole] = useState(false);
  const [step, setStep] = useState(0);
  const order: Actor[] = whole ? ['A','A','A','B','B','B'] : ['A','B','A','B','A','B'];
  const state = run(whole ? 'whole-lock' : 'access-lock', order.slice(0, step), 5, -1);
  return <><h3>换成库存：两次扣减为什么只少一件？</h3><p>库存 5，两张订单各扣 1。读写分别加锁时，每次访问安全，但“先读后写”的决定可能已经过时。</p><label><input type="checkbox" checked={whole} onChange={e => {setWhole(e.target.checked); setStep(0);}}/>改成整段扣减持同一把锁（重新开始）</label><div className="sync43-memory"><strong>库存 {state.value}</strong><span>A 手上草稿 {state.workers.A.local ?? '空'} · B 手上草稿 {state.workers.B.local ?? '空'}</span></div><p role="status">{state.trace.at(-1) ?? '还没有读取库存。'}</p><div className="sync43-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 6} onClick={() => setStep(step + 1)}>下一步扣减</button><button onClick={() => setStep(0)}>重播示例</button></div><p>类比边界：这里只有固定扣减；真实订单还要把“库存是否足够”的检查纳入同一业务边界。</p></>;
}
function Diagram() {
  const [selected, setSelected] = useState<'read' | 'compute' | 'write'>('read');
  const copy = {read: ['tmp := n', '共享 n=10 → A 的 tmp=10', '箭头是复制值：之后 n 改变，tmp 不会自动更新。'], compute: ['tmp = tmp + 2', 'A 私有 tmp：10 → 12；共享 n 仍是 10', '计算只发生在私有副本；B 可以同时持有自己的旧副本。'], write: ['n = tmp', 'A 的 tmp=12 → 共享 n=12', '这是赋值覆盖，不是把 2 追加到当前 n。B 若也写 12，就不会得到 14。']}[selected];
  return <><h3>关联图：值在哪，箭头在搬什么？</h3><div className="sync43-actions">{(['read','compute','write'] as const).map(phase => <button key={phase} aria-pressed={selected === phase} onClick={() => setSelected(phase)}>{phaseName[phase]}</button>)}</div><div className="sync43-flow"><div className={selected !== 'compute' ? 'sync43-active' : ''}>共享内存<br/><strong>n={selected === 'write' ? 12 : 10}</strong></div><span aria-label="读取复制到私有副本，写回则反向覆盖">读 →<br/>← 写</span><div className="sync43-active">A 私有副本<br/><strong>tmp={selected === 'read' ? 10 : 12}</strong>{selected === 'compute' && <p>↻ 本地加 2</p>}</div></div><pre>{copy[0]}</pre><p role="status"><strong>{copy[1]}</strong><br/>{copy[2]}</p><p className="sync43-note">整段锁的括号必须包含读、算、写三步。只把最后一个箭头串行化，不能使先前读到的副本变新。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const hints = [['找旧值来源','日志：A 读 10，B 读 10。标出两份私有副本，它们都来自同一个共享版本。'], ['追踪覆盖','A 算 12 并写回，B 也算 12 并写回。第二次赋值没有合并 A 的贡献，n 保持 12。'], ['检查保护范围','只锁写入：读取仍无完整同步。读写分别锁：每次访问安全，但两次读取仍可在任何写入之前发生。'], ['构造修复并找反例','让同一把锁从读取一直持有到写回；或对此单字段使用原子 Add。再尝试让 B 插到 A 读和写之间：整段锁会让 B 等待。']];
  const evidence = [run('unsafe', ['A','B'], 10, 2), run('unsafe', ['A','B','A','B','A','B'], 10, 2), run('access-lock', ['A','B','A','B','A','B'], 10, 2), run('whole-lock', ['A','B'], 10, 2)][step];
  return <><h3>诊断路线：从覆盖证据走到修复边界</h3><ol className="sync43-steps">{hints.map(([title], i) => <li key={title} aria-current={step === i ? 'step' : undefined}><button onClick={() => setStep(i)}>{title}</button></li>)}</ol><article className="sync43-result"><h4>第 {step + 1} 步：{hints[step][0]}</h4><p>{hints[step][1]}</p></article><div className="sync43-memory" aria-label="当前诊断证据"><strong>共享 n={evidence.value}</strong><span>A 私有值={evidence.workers.A.local ?? '未读'} · B 私有值={evidence.workers.B.local ?? '未读'}</span><span>锁：{evidence.owner ?? '空闲'} · 边界：{strategies[evidence.strategy]}</span></div><p role="status">{evidence.trace.at(-1)}</p><div className="sync43-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>前一步提示</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步提示</button></div><p>这些是已揭示的诊断提示，不计作独立掌握。最后到“自己试试”检查迁移。</p></>;
}
function Try() {
  const [answer, setAnswer] = useState(''); const [reason, setReason] = useState(''); const [submitted, setSubmitted] = useState(false);
  const evidence = run('access-lock', ['A','B','A','B','A','B'], 20, 3);
  return <><h3>新条件：无竞争就能保证不丢更新吗？</h3><p>初值 n=20；A、B 各加 3。所有共享读取和写入都用同一 mutex，但读完立即解锁，算完再加锁写回。顺序是 A 读、B 读、A 算写、B 算写。</p><label>最终 n<input type="number" value={answer} disabled={submitted} onChange={e => setAnswer(e.target.value)}/></label><fieldset disabled={submitted}><legend>选择能解释这个结果的判断</legend>{[['safe','无 data race，但分开的临界区允许丢失更新'],['race','有丢失更新，所以一定有 data race'],['all','使用同一锁，所以整个自增已经不可分割']].map(([value, text]) => <label key={value}><input type="radio" name="sync43-try-reason" checked={reason === value} onChange={() => setReason(value)}/>{text}</label>)}</fieldset><button disabled={!answer.trim() || !reason || submitted} onClick={() => setSubmitted(true)}>提交两项判断</button>{submitted && <div role="status" className="sync43-result"><strong>{Number(answer) === 23 && reason === 'safe' ? '两项判断都正确' : '请对照两个不同的保证'}</strong><p>A、B 都保存 20，计算 23，最后分别写 23，所以实际 n=23，目标是 26。每次共享访问都受同一锁保护，因此本例没有这些访问的数据竞争；复合更新仍然丢了一份增量。</p><div className="sync43-memory"><strong>实际共享 n={evidence.value}</strong><span>A 写回 {evidence.workers.A.local} · B 写回 {evidence.workers.B.local}</span><span>两份贡献目标 {inspect(evidence).expected}</span></div><p>{evidence.trace.at(-1)}</p><p>修复：锁从读取持有到写回，或单字段使用 atomic.Add；不能只凭最终数字判断 data race。</p></div>}<button onClick={() => {setAnswer(''); setReason(''); setSubmitted(false);}}>清空重新作答</button><p className="sync43-note">这是帮助内的迁移练习，不计入独立掌握；揭晓后重做用于巩固。</p></>;
}
export function Help({mode}: {mode: string}) { return <section className="sync43" data-testid="lesson43-help">{mode === 'example' ? <Example/> : mode === 'diagram' ? <Diagram/> : mode === 'steps' ? <Steps/> : <Try/>}</section>; }
