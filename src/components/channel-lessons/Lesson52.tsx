import { useState } from 'react';
import { can52, create52, step52, type Action52, type Outcome52 } from './model52';
import './lesson52.css';
const outcomes: Record<Outcome52, string> = { buffered: '发送完成，消息进入缓冲', blocked: '发送等待，消息留在生产者', handoff: '直接交给等待中的接收者', received: '取出队首，开始处理', waiting: '接收者等待消息', finished: '当前消息处理完成' };
const actions: Record<Action52, string> = { send: '生产者发送下一条', receive: '消费者接收一条', finish: '消费者完成当前处理' };
export default function Lesson52() {
  const [history, setHistory] = useState([create52()]);
  const [action, setAction] = useState<Action52>('send');
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const s = history.at(-1)!;
  function reset(capacity = s.capacity) { setHistory([create52(capacity)]); setPrediction(''); setReason(''); setFeedback(''); }
  function execute() {
    if (!prediction || !can52(s, action)) return;
    const next = step52(s, action);
    setHistory([...history, next]);
    setFeedback(`你的预测：${outcomes[prediction as Outcome52]}。${reason ? `理由：${reason}。` : ''}${prediction === next.outcome ? '预测与观察一致。' : `实际：${outcomes[next.outcome!]}。请根据消息位置修改解释。`} ${next.explanation}`);
    setPrediction(''); setReason('');
  }
  return <section className="channel-lesson lesson52" data-testid="lesson52-lab">
    <div className="cl-heading"><h3>把等待传回生产者</h3><p>扮演调度者：先连续发送到队列满，再让消费者取走一条。追踪等待中的消息是否丢失。</p></div>
    <div className="cl-controls"><label>缓冲容量（改变后重开） <select aria-label="缓冲容量" value={s.capacity} onChange={e => reset(Number(e.target.value))}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} 格</option>)}</select></label><button onClick={() => { setHistory(history.slice(0, -1)); setFeedback('已回退一步，可更换操作探索另一条路径。'); setPrediction(''); }} disabled={history.length < 2}>回退一步</button><button onClick={() => reset()}>重置实验</button></div>
    <div className="cl-metrics"><span>len = {s.queue.length}</span><span>cap = {s.capacity}</span><span>发送已完成 {s.sent}</span><span>业务已完成 {s.completed.length}</span></div>
    <div className="cl-board l52-board" data-testid="live-model" data-state={JSON.stringify(s)}>
      <article className="cl-card"><h4>生产者</h4><strong>{s.pending !== null ? `发送 ${s.pending} 正在等待` : `可发送消息 ${s.next}`}</strong><p>{s.pending !== null ? `消息 ${s.pending} 仍属于未完成的发送；此角色不能越过这一行继续发送。` : '每次发送一条，按编号顺序提交。'}</p></article>
      <article className="cl-card"><h4>通道缓冲 · FIFO</h4><p>队首 → 队尾</p><div className="l52-slots" aria-label={`队列 ${s.queue.join('、') || '空'}`}>{Array.from({ length: s.capacity }, (_, i) => <div className={s.queue[i] === undefined ? 'l52-slot' : 'l52-slot occupied'} key={i}><small>槽 {i + 1}</small><strong>{s.queue[i] === undefined ? '空' : `消息 ${s.queue[i]}`}</strong>{i === 0 && s.queue[i] !== undefined && <small>下次接收</small>}</div>)}</div></article>
      <article className="cl-card"><h4>消费者</h4><strong>{s.receiverWaiting ? '等待接收' : s.processing !== null ? `正在处理消息 ${s.processing}` : '可开始一次接收'}</strong><p>已处理：{s.completed.join(' → ') || '无'}</p><p>取出消息与完成业务是两个动作。</p></article>
    </div>
    <div className="cl-code l52-code" aria-label="操作对应代码"><code>ch := make(chan int, {s.capacity})</code><code className={s.lastAction === 'send' || s.pending !== null ? 'active' : ''}>生产者：ch &lt;- {s.pending ?? (s.lastAction === 'send' ? s.next - 1 : s.next)} {s.pending !== null ? '// 等待空槽' : ''}</code><code className={s.lastAction === 'receive' || s.receiverWaiting ? 'active' : ''}>消费者：v := &lt;-ch {s.processing !== null ? `// v = ${s.processing}` : ''}</code><code className={s.lastAction === 'finish' ? 'active' : ''}>消费者：process(v) // 处理结束后才接收下一条</code></div>
    <div className="cl-prediction"><h4>选择角色动作 → 预测 → 验证</h4><label>下一步 <select aria-label="下一步动作" value={action} onChange={e => { setAction(e.target.value as Action52); setPrediction(''); }}>{Object.entries(actions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>预测结果 <select aria-label="预测结果" value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">先选择预测</option>{(action === 'send' ? ['buffered', 'blocked', 'handoff'] : action === 'receive' ? ['received', 'waiting'] : ['finished', 'buffered']).map(key => <option key={key} value={key}>{outcomes[key as Outcome52]}</option>)}</select></label><label>我的理由（选填）<input aria-label="预测理由" value={reason} onChange={e => setReason(e.target.value)} placeholder="根据空槽或角色状态解释" /></label><button onClick={execute} disabled={!prediction || !can52(s, action)}>执行并验证</button>{!can52(s, action) && <p>{action === 'send' ? '生产者正在阻塞，请先安排接收。' : action === 'finish' ? '当前没有待处理消息。' : s.receiverWaiting ? '接收已经在等待，请安排发送。' : '消费者还在处理上一条，请先完成处理。'}</p>}</div>
    <p className="cl-feedback" aria-live="polite">{feedback || s.explanation}</p>
    <details className="cl-history"><summary>操作证据（{history.length - 1} 步）</summary><ol>{history.slice(1).map((entry, i) => <li key={i}>{entry.explanation}</li>)}</ol></details>
    <p className="cl-note">模型边界：一个生产者、一个串行消费者、开放的缓冲通道。一次接收把释放空槽与等待发送的完成合并显示；不模拟真实调度耗时。容量改变会新建通道。len 是瞬时观察，不能保证实际并发程序下一次发送不阻塞。本实验仅作辅助探索，不计入独立掌握。</p>
  </section>;
}
export function Help52({ mode }: { mode: string }) {
  const [capacity, setCapacity] = useState(2);
  const [stage, setStage] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const challengeStart = () => ({...create52(3),queue:[11,12,13],pending:14,next:15,sent:3});
  const [challenge,setChallenge] = useState<ReturnType<typeof create52>>(challengeStart);
  if (mode === 'example') return <div className="cl-help lesson52" data-testid="lesson52-help"><h4>取餐架变大，服务员会变快吗？</h4><p>厨房每秒尝试送出 3 份，服务员每秒最多送走 1 份。假定每秒先提交、再取餐。</p><label>架子容量 <select value={capacity} onChange={e => setCapacity(Number(e.target.value))}><option value={2}>2 格</option><option value={4}>4 格</option></select></label><div className="l52-example"><div>第一秒开始：空架</div><div>厨房突发 3 份 → {Math.min(3, capacity)} 份入架，{Math.max(0, 3 - capacity)} 份等待</div><div>服务员取出 1 份 → 架上 {Math.min(2, capacity)} 份{capacity === 2 ? '（等待的一份补入空槽）' : ''}</div><div>服务员本秒最多送走：<strong>仍是 1 份</strong></div></div><p>容量增大吸收了更大的短时突发；持续供给大于处理能力时，积压仍会增长并最终阻塞上游。</p></div>;
  if (mode === 'diagram') return <div className="cl-help lesson52" data-testid="lesson52-help"><h4>追踪一个空槽的因果链</h4><div className="cl-controls"><button onClick={() => setStage(0)} aria-pressed={stage === 0}>接收前</button><button onClick={() => setStage(1)} aria-pressed={stage === 1}>接收后</button></div><div className="l52-flow" role="img" aria-label={stage === 0 ? '消息3在生产者等待，缓冲里是1和2，消费者未接收' : '消费者取出1，等待的3进入队尾，缓冲变成2和3'}><div className="cl-card">生产者<br /><strong>{stage === 0 ? '3：等待' : '3：发送完成'}</strong></div><span aria-hidden="true">→</span><div className="cl-card">缓冲 / cap 2<br /><strong>{stage === 0 ? '[ 1 ][ 2 ]' : '[ 2 ][ 3 ]'}</strong></div><span aria-hidden="true">→</span><div className="cl-card">消费者<br /><strong>{stage === 0 ? '尚未取出' : '处理 1'}</strong></div></div><p>{stage === 0 ? '发送 3 没有空槽，等待发生在生产者，不会覆盖 1。' : '取出队首 1 → 释放一个空槽 → 发送 3 得以完成。两次观察的 len 都是 2，却发生了一次接收和一次发送。'}</p></div>;
  if (mode === 'steps') {
    const steps = ['容量为 2，先发送 1 与 2：两次发送都完成，缓冲为 [1, 2]。', '再发送 3：没有空槽，3 停留在未完成的发送中。队列仍为 [1, 2]。', '消费者接收 1：保留 FIFO 次序；空槽让发送 3 完成，队列变为 [2, 3]。', '消费者处理 1 后再接收 2。增大容量可多排队，但不会让 process(v) 本身更快。'];
    return <div className="cl-help lesson52" data-testid="lesson52-help"><h4>从阻塞反推解除条件</h4><ol className="cl-steps">{steps.slice(0, stage + 1).map((step, i) => <li key={step}><strong>证据 {i + 1}：</strong>{step}</li>)}</ol><button onClick={() => setStage(Math.max(0, stage - 1))} disabled={stage === 0}>上一步</button><button onClick={() => setStage(Math.min(3, stage + 1))} disabled={stage === 3}>展开下一条因果</button><p>重点核对：释放空槽发生在接收时；业务处理结束可以晚于此时。</p></div>;
  }
  return <div className="cl-help lesson52" data-testid="lesson52-help"><h4>小挑战：一次接收后哪里变了？</h4><p>cap = 3，缓冲为 [11, 12, 13]，同一生产者正在等待发送 14。消费者接收一次后，选出模型中的稳定状态。</p><label>你的判断 <select value={answer} onChange={e => { setAnswer(e.target.value); setChecked(false); setChallenge(challengeStart()); }}><option value="">先预测</option><option value="fifo">消费者拿到 11，缓冲 [12, 13, 14]，发送 14 完成</option><option value="replace">消费者拿到 14，缓冲 [11, 12, 13]</option><option value="lost">消费者拿到 11，缓冲 [12, 13]，14 丢失</option></select></label><div className="cl-board" aria-label="小挑战消息位置"><div className="cl-card">生产者<strong>{challenge.pending === null ? '发送 14 已完成' : '等待发送 14'}</strong></div><div className="cl-card">缓冲<strong>[{challenge.queue.join(', ')}]</strong></div><div className="cl-card">消费者<strong>{challenge.processing === null ? '尚未接收' : `正在处理 ${challenge.processing}`}</strong></div></div><button disabled={!answer || checked} onClick={() => {setChallenge(step52(challenge,'receive'));setChecked(true);}}>执行一次接收并核对</button><button className="ghost" onClick={() => {setChallenge(challengeStart());setChecked(false);setAnswer('');}}>重置挑战</button><p aria-live="polite">{checked ? answer === 'fifo' ? '一致：先取队首，再由等待中的发送补入空槽。len 仍是 3 不代表没发生接收。' : '沿消息位置重新追踪：接收必须取出队首 11；普通发送 14 会等待，既不抢到队首，也不会静默丢弃。' : '先保留判断，再查看解释。这是带反馈的练习，不记录为独立掌握。'}</p></div>;
}

