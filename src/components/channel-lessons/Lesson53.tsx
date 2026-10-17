import { useState } from 'react';
import { actionCode53, canAct53, initial53, outcomeLabels53, transition53, type Action53, type Outcome53, type State53 } from './model53';
import './lesson53.css';

const actions: { label: string; action: Action53 }[] = [
  { label: 'A 发送 1', action: { type: 'send', actor: 'A' } },
  { label: 'A Done / 退出', action: { type: 'done', actor: 'A' } },
  { label: 'B 发送 2', action: { type: 'send', actor: 'B' } },
  { label: 'B Done / 退出', action: { type: 'done', actor: 'B' } },
  { label: '协调者 Wait → close', action: { type: 'close', actor: 'coordinator' } },
  { label: '接收者接收一次', action: { type: 'receive' } },
  { label: 'A 自行 close（危险）', action: { type: 'close', actor: 'A' } },
  { label: '接收者 close（危险）', action: { type: 'close', actor: 'receiver' } },
];
type Snapshot = { state: State53; action: string; prediction: string; reason: string };
function OwnershipDiagram({ state }: { state: State53 }) {
  const complete = state.done.A && state.done.B;
  return <svg className="l53-diagram" viewBox="0 0 420 270" role="img" aria-label={'关闭依赖图：A ' + (state.done.A ? '已结束' : '未结束') + '，B ' + (state.done.B ? '已结束' : '未结束') + '，Wait ' + (complete ? '可返回' : '等待') + '，通道' + (state.closed ? '已关闭' : '开放')}>
    <defs><marker id="l53-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
    <g className="l53-edges" markerEnd="url(#l53-arrow)"><path d="M110 65 L110 95 L190 95 L190 117" /><path d="M310 65 L310 95 L230 95 L230 117" /><path d="M210 160 L210 184" /><path d="M210 222 L210 240" /></g>
    <rect x="25" y="15" width="170" height="50" rx="10" className={state.done.A ? 'is-complete' : ''} /><text x="110" y="36">生产者 A</text><text x="110" y="55">{state.done.A ? 'Done ✓ 不再发送' : state.sent.A ? '已发送，尚未 Done' : '还要发送 1'}</text>
    <rect x="225" y="15" width="170" height="50" rx="10" className={state.done.B ? 'is-complete' : ''} /><text x="310" y="36">生产者 B</text><text x="310" y="55">{state.done.B ? 'Done ✓ 不再发送' : state.sent.B ? '已发送，尚未 Done' : '还要发送 2'}</text>
    <text className="l53-annotation" x="210" y="89">两个结束信号都到达</text>
    <rect x="100" y="118" width="220" height="42" rx="10" className={complete ? 'is-complete' : ''} /><text x="210" y="144">wg.Wait()：{complete ? '可返回' : '仍等待'}</text>
    <rect x="100" y="184" width="220" height="38" rx="10" className={state.closed ? 'is-complete' : ''} /><text x="210" y="208">唯一协调者 close：{state.closed ? '已关闭' : '尚未关闭'}</text>
    <text className="l53-annotation" x="210" y="260">接收：先取缓冲，再得到 ok=false</text>
  </svg>;
}
export default function Lesson53() {
  const [history, setHistory] = useState<Snapshot[]>([{ state: initial53(), action: '初始状态', prediction: '', reason: '' }]);
  const [actionIndex, setActionIndex] = useState(0);
  const [prediction, setPrediction] = useState<Outcome53 | ''>('');
  const [reason, setReason] = useState('');
  const current = history[history.length - 1];
  const state = current.state;
  const chosen = actions[actionIndex];
  function run() {
    if (!prediction || !canAct53(state, chosen.action)) return;
    setHistory([...history, { state: transition53(state, chosen.action), action: chosen.label, prediction, reason }]);
    setPrediction(''); setReason('');
  }
  return <section className="channel-lesson lesson53" data-testid="lesson53-lab">
    <div className="cl-heading"><h3>把关闭权交给谁？</h3><p>扮演 A、B、接收者和协调者。先制造一次提前关闭，再回退修复：让两个结果都送达，最后让接收者正常结束。</p></div>
    <div className="cl-metrics"><span>生产者结束 {Number(state.done.A) + Number(state.done.B)} / 2</span><span>通道：{state.closed ? '已关闭' : '开放'}</span><span>接收者：{state.receiverWaiting ? '挂起' : state.ended ? '退出' : '可执行'}</span><span>协调者：{state.coordinatorWaiting ? 'Wait 挂起' : '可执行'}</span><span>结果和：{state.received.reduce((sum, value) => sum + value, 0)}</span></div>
    <div className="l53-layout">
      <div className="cl-board" data-testid="live-model" data-state={JSON.stringify(state)}>
        <div className="l53-producers">{(['A', 'B'] as const).map(actor => <article className="cl-card" key={actor}><strong>生产者 {actor}</strong><p>{state.done[actor] ? '✓ 已退出，不再发送' : state.sent[actor] ? '已发送 → 等待 Done' : '有 1 条待发送结果'}</p></article>)}</div>
        <article className="cl-card"><strong>结果通道 · 容量 2 · {state.closed ? '已关闭' : '开放'}</strong><div className="l53-slots">{[0, 1].map(slot => <span key={slot}>{state.queue[slot] ?? '空槽'}</span>)}</div><p>已收到：{state.received.length ? state.received.join('、') : '无'}{state.ended ? '；range 已退出' : ''}</p></article>
        <OwnershipDiagram state={state} />
      </div>
      <div>
        <fieldset className="cl-controls"><legend>1. 安排下一个角色动作</legend><div className="l53-actions">{actions.map((item, index) => <button key={item.label} type="button" aria-pressed={actionIndex === index} disabled={!canAct53(state, item.action)} onClick={() => { setActionIndex(index); setPrediction(''); }}>{item.label}</button>)}</div></fieldset>
        <div className="cl-code"><span>将执行的代码</span><pre><code>{actionCode53(chosen.action)}</code></pre></div>
        <fieldset className="cl-prediction"><legend>2. 先预测，再执行</legend><label>这个动作会产生什么结果？<select aria-label="第53题预测结果" value={prediction} onChange={event => setPrediction(event.target.value as Outcome53 | '')}><option value="">请选择预测</option>{Object.entries(outcomeLabels53).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>依据（可选）<input value={reason} onChange={event => setReason(event.target.value)} placeholder="还有谁可能发送？缓冲是否为空？" /></label><button type="button" disabled={!prediction || !canAct53(state, chosen.action)} onClick={run}>执行并验证</button></fieldset>
        <div className="cl-feedback" aria-live="polite"><strong>{state.panic ? '程序 panic，后续动作停止' : current.prediction ? current.prediction === state.outcome ? '预测与结果一致' : '结果与预测不同' : '准备实验'}</strong>{current.prediction && <p>你的预测：{outcomeLabels53[current.prediction as Outcome53]}；实际：{outcomeLabels53[state.outcome!]}</p>}<p>{state.message}</p>{current.reason && <p>当时的依据：{current.reason}</p>}{state.ended && !state.panic && <p>本轮已完整收尾。探索记录不计入独立掌握证据。</p>}</div>
      </div>
    </div>
    <div className="cl-controls"><button type="button" disabled={history.length < 2} onClick={() => { setHistory(history.slice(0, -1)); setPrediction(''); }}>回退一步，改走另一条路径</button><button type="button" onClick={() => { setHistory([{ state: initial53(), action: '初始状态', prediction: '', reason: '' }]); setPrediction(''); setReason(''); setActionIndex(0); }}>重置实验</button></div>
    <details className="cl-history"><summary>操作证据（{history.length - 1} 步）</summary><ol>{history.slice(1).map((item, index) => <li key={index}>{item.action} → {outcomeLabels53[item.state.outcome!]}：{item.state.message}</li>)}</ol></details>
    <p className="cl-note">模型边界：每位生产者仅发送一个值，容量足够容纳两条结果。接收等待会挂起角色；后续发送或关闭会唤醒它。Wait 挂起后，最后一个 Done 自动推进协调者执行 close；这里合并展示唤醒后的执行，不模拟调度延迟。close 是协议事件，并非释放通道内存的必需步骤。Go 不强制规定关闭者身份；这里用唯一协调者建立可证明的关闭责任。</p>
  </section>;
}
const safeActions: Action53[] = [{ type: 'send', actor: 'A' }, { type: 'done', actor: 'A' }, { type: 'send', actor: 'B' }, { type: 'done', actor: 'B' }, { type: 'close', actor: 'coordinator' }, { type: 'receive' }, { type: 'receive' }, { type: 'receive' }];
function HelpSteps53() {
  const [step, setStep] = useState(0);
  const state = safeActions.slice(0, step).reduce(transition53, initial53());
  return <><h4>沿着结束证据，走完安全路径</h4><p>第 {step} / 8 步：{state.message}</p><pre className="cl-code">{step ? actionCode53(safeActions[step - 1]) : 'wg.Add(2); ch := make(chan int, 2)'}</pre><div className="cl-metrics"><span>Done：{Number(state.done.A) + Number(state.done.B)} / 2</span><span>缓冲：[{state.queue.join(', ')}]</span><span>收到：[{state.received.join(', ')}]</span></div><div className="cl-controls"><button type="button" disabled={!step} onClick={() => setStep(step - 1)}>上一步</button><button type="button" disabled={step === 8} onClick={() => setStep(step + 1)}>下一步</button><button type="button" onClick={() => setStep(0)}>从头看</button></div><p>这是有提示的安全路径示范，不记录掌握结果。</p></>;
}
function HelpTry53() {
  const [choice, setChoice] = useState<'wait' | 'close' | ''>('');
  const [tested, setTested] = useState(false);
  let state = transition53(transition53(initial53(), { type: 'send', actor: 'A' }), { type: 'done', actor: 'A' });
  state = transition53(state, { type: 'receive' });
  if (choice === 'close') state = transition53(state, { type: 'close', actor: 'receiver' });
  else if (choice === 'wait') state = transition53(state, { type: 'close', actor: 'coordinator' });
  if (tested) state = transition53(state, { type: 'send', actor: 'B' });
  return <><h4>反例挑战：已经收到 A，就能 close 吗？</h4><p>A 已发送并退出；B 还没发送。为接收者选一个策略，再让 B 发送验证。</p><div className="cl-controls"><button type="button" aria-pressed={choice === 'close'} onClick={() => { setChoice('close'); setTested(false); }}>接收者立即 close</button><button type="button" aria-pressed={choice === 'wait'} onClick={() => { setChoice('wait'); setTested(false); }}>交给协调者等待全部结束</button><button type="button" disabled={!choice || tested} onClick={() => setTested(true)}>让 B 发送 2，检验策略</button></div><p className="cl-feedback" aria-live="polite">{tested ? state.message : choice ? '策略已选。现在预测：B 能否成功发送？点击检验。' : '先选择一个策略。'}</p>{tested && <p>{state.panic ? '修复：选择等待全部结束，再测试同一个 B。提前 close 本身可以成功，错误会在下一次发送暴露。' : 'B 已成功发送；仍需 B Done，协调者才能 close。一个人的结束不能证明所有人的结束。'}</p>}</>;
}
function HelpDiagram53() {
  const [done, setDone] = useState({ A: false, B: false });
  const state = { ...initial53(), done };
  return <><h4>关闭依赖图：两个 Done 是汇合条件</h4><div className="cl-controls">{(['A', 'B'] as const).map(actor => <label key={actor}><input type="checkbox" checked={done[actor]} onChange={event => setDone({ ...done, [actor]: event.target.checked })} />{actor} 已完成发送并 Done</label>)}</div><OwnershipDiagram state={state} /><pre className="cl-code">{done.A && done.B ? 'wg.Wait() // 返回\nclose(ch) // 此时可以执行一次' : 'wg.Wait() // 阻塞\n// close(ch) 尚未执行'}</pre><p aria-live="polite">{done.A && done.B ? '两条路径在 Wait 汇合，已经能证明不会再有发送。' : '任一结束信号缺失，Wait 就不能返回。箭头表示依赖，不表示 A、B 之间有先后顺序。'}</p></>;
}
export function Help53({ mode }: { mode: string }) {
  return <section className="channel-lesson lesson53 cl-help" data-testid="lesson53-help">
    {mode === 'diagram' ? <HelpDiagram53 /> : mode === 'steps' ? <HelpSteps53 /> : mode === 'try' ? <HelpTry53 /> : <><h4>两辆货车与一位仓库管理员</h4><p>A 车卸完，不代表 B 车已经到齐。管理员拿到两张“运输结束”回执，才宣布不再收货；仓库已收的货仍可出库。</p><div className="l53-producers"><article className="cl-card"><strong>局部证据</strong><p>A：我的 1 已发送。只能证明 A 不再发送，不能代表 B。</p><code>A: wg.Done()</code></article><article className="cl-card"><strong>完整证据</strong><p>协调者：A 和 B 都结束了。统一关闭一次，接收者再读完缓冲。</p><code>coordinator: wg.Wait(); close(ch)</code></article></div><p className="cl-note">类比边界：close 不清空缓冲；Go 也不会限制某种角色才能 close。重复 close、close(nil) 都会 panic。接收者若能证明全部发送结束且承担唯一关闭责任，也可执行 close；此题的普通接收者没有该证据。</p></>}
  </section>;
}

