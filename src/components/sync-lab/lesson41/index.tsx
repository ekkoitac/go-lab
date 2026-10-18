import {useState} from 'react';
import {canStep, effects, initialState, step, type Actor, type Effect, type Policy, type State} from './model';
import './style.css';
const mainNames: Record<State['main'], string> = {new: '准备启动', ready: '可继续', waiting: '阻塞等回执', acknowledged: '已收到回执', exited: '已返回'};
const workerNames: Record<State['worker'], string> = {absent: '尚未创建', ready: '可运行', writing: '正在写入', saved: '写完，待通知', done: '已通知完成', stopped: '随进程终止'};
export default function Lab() {
  const [history, setHistory] = useState<State[]>([initialState()]);
  const [actor, setActor] = useState<Actor>('main');
  const [prediction, setPrediction] = useState<Effect | ''>('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const s = history[history.length - 1];
  function reset(policy = s.policy, work = s.work) {
    setHistory([initialState(policy, work)]); setActor('main'); setPrediction(''); setReason(''); setFeedback('');
  }
  function run() {
    if (!prediction || !canStep(s, actor)) return;
    const next = step(s, actor);
    setHistory([...history, next]);
    setFeedback(`${prediction === next.effect ? '预测吻合' : '预测需要修正'}：你预测“${effects[prediction]}”，实际是“${effects[next.effect!]}”。${reason ? `你的理由：${reason}。` : ''}${next.message}`);
    setPrediction('');
  }
  return <section className="sync41" data-testid="lesson41-lab">
    <h3>把后台工作真正等完</h3>
    <p>扮演调度器：启动后让 main 抢先返回，或先推进后台；再接上完成通道，检验哪种结构能抵抗不同调度。</p>
    <div className="sync41-controls">
      <label>main 的退出协议<select value={s.policy} onChange={e => reset(e.target.value as Policy)}><option value="return">启动后直接返回</option><option value="receipt">收到 done 再返回</option></select></label>
      <label>后台写入工作片段<select value={s.work} onChange={e => reset(s.policy, Number(e.target.value))}>{[1,2,3,4].map(n => <option key={n} value={n}>{n} 段</option>)}</select></label>
    </div>
    <small>更改条件会重建实验。片段表示可暂停的工作阶段，不代表秒数或真实调度时间。</small>
    <div className="sync41-board" data-testid="live-model" data-state={JSON.stringify(s)}>
      <article><h4>main 执行线</h4><strong>{mainNames[s.main]}</strong><code>go save()</code><code>{s.policy === 'receipt' ? '← 等待：<-done' : '不等待'}</code><code>return</code></article>
      <article><h4>后台执行线</h4><strong>{workerNames[s.worker]}</strong><div className="sync41-segments">{Array.from({length: s.work}, (_, i) => <span key={i} className={i < s.work - s.remaining ? 'sync41-complete' : ''}>{i < s.work - s.remaining ? '✓' : '○'} {i + 1}</span>)}</div><code>write → close(done)</code></article>
      <article><h4>可观察证据</h4><p>写入：{s.saved ? '完成' : '未完成'}</p><p>done：{s.receipt ? '已关闭' : '未关闭'}</p><p>进程：{s.main === 'exited' ? '结束' : '运行中'}</p></article>
    </div>
    <div className="sync41-controls">
      <label>下一步运行谁<select value={actor} onChange={e => {setActor(e.target.value as Actor); setPrediction('');}}><option value="main">main</option><option value="worker">后台任务</option></select></label>
      <label>先预测这一步的结果<select value={prediction} onChange={e => setPrediction(e.target.value as Effect)}><option value="">请选择预测</option>{Object.entries(effects).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="sync41-reason">我的理由（选填）<input value={reason} onChange={e => setReason(e.target.value)} placeholder="哪一个事件允许它继续？" /></label>
    </div>
    <div className="sync41-actions"><button disabled={!prediction || !canStep(s, actor)} onClick={run}>执行一步并核对</button><button disabled={history.length < 2} onClick={() => {setHistory(history.slice(0,-1)); setFeedback('已回退，可以改变调度构造另一条路径。'); setPrediction('');}}>回退一步</button><button onClick={() => reset()}>重置实验</button></div>
    {!canStep(s, actor) && <p>{s.main === 'exited' ? '进程已结束。回退到返回之前，可以构造另一条执行路径。' : actor === 'main' ? 'main 正阻塞等待。请切换到后台任务推进写入和回执。' : '后台当前没有可执行步骤：先启动任务，或切换回 main。'}</p>}
    <p className="sync41-feedback" aria-live="polite">{feedback || s.message}</p>
    <ol className="sync41-history" aria-label="已执行的因果轨迹">{history.slice(1).map((entry, i) => <li key={i}>{effects[entry.effect!]} · 剩余 {entry.remaining} 段 · done {entry.receipt ? '关闭' : '未关闭'}</li>)}</ol>
    <p className="sync41-boundary">模型边界：这里只模拟单个后台任务、成功写入和关闭 done。调度由你选择，不代表 Go 的固定执行顺序；close(done) 表示约定工作完成，不保证 goroutine 的全部退出清理已结束。取消、失败、磁盘持久化需另外设计协议。观察与帮助均不写入掌握记录。</p>
  </section>;
}
function Example() {
  const [wait, setWait] = useState(false);
  return <><h4>快递回执：派出与送达是两件事</h4><label><input type="checkbox" checked={wait} onChange={e => setWait(e.target.checked)} /> 办公室要求收到送达回执才关门</label><div className="sync41-compare"><article><h4>固定情境</h4><p>快递员已出发，但还没有送达。办公室此时准备关门。</p></article><article><h4>{wait ? '有回执协议' : '只有派出记录'}</h4><p>{wait ? '办公室等待 → 快递员送达 → 发回回执 → 办公室关门。' : '办公室立即关门；“已出发”不能证明文件送达。'}</p></article></div><p>对应 Go：派出是 go，送达是工作完成，回执是 done；等待十分钟也不能替代回执。</p><small>类比边界：真实快递员不会因办公室关门消失；Go 程序在 main 返回时会终止其他 goroutine。</small></>;
}
function Diagram() {
  const [linked, setLinked] = useState(false);
  return <><h4>给返回操作接上依赖边</h4><button onClick={() => setLinked(!linked)}>{linked ? '拆掉完成依赖' : '接上完成依赖'}</button><div className="sync41-flow" role="img" aria-label={linked ? '启动后分成两条执行线；后台写入后关闭done，main接收done后才能返回' : '启动后main返回与后台写入没有完成依赖'}><div className="sync41-node">main：go save()</div><div>↓ 创建并发执行线（不等待）</div><div className="sync41-compare"><div className="sync41-node">后台：写入 → close(done)</div><div className="sync41-node">main：{linked ? '<-done → return' : 'return'}</div></div><strong>{linked ? 'close(done) ──完成事件──→ <-done 返回' : '后台完成与 main 返回之间：没有等待边'}</strong></div><p>{linked ? '关键关系是：关闭前的写入先于对应接收完成。箭头表示同步依赖，不表示两个任务不能交错。' : '启动边只表达任务被创建；它不能建立“写完之后 main 才能返回”的顺序。'}</p></>;
}
function Steps() {
  const [stepIndex, setStepIndex] = useState(0);
  const actors: Actor[] = ['main', 'main', 'worker', 'worker', 'worker', 'main', 'main'];
  const snapshots = [initialState('receipt', 2)];
  for (const actor of actors) snapshots.push(step(snapshots[snapshots.length - 1], actor));
  const current = snapshots[stepIndex];
  const instructions = [
    '修复目标：把 close(done) 放在写入之后，让 main 接收 done 后才返回。先观察两条执行线尚未启动。',
    'main 执行 go：后台可运行，但工作进度还是 0。启动边没有替后台执行写入。',
    '让 main 抢先到达 <-done：它阻塞，进程仍活着。这正是完成协议抵抗慢调度的地方。',
    '后台推进第 1 段；main 仍等待，因为 done 尚未关闭。',
    '后台推进第 2 段：写入完成，但通知还没发生。完成工作与发出通知是两个动作。',
    '后台关闭 done：等待条件已满足，但要等 main 再得到运行才完成接收。',
    'main 接收返回：此时有了完成证据；接下来才允许返回。',
    'main 返回，进程结束。写入和完成回执均已发生；这次退出不会截断待完成的写入。',
  ];
  return <><h4>从失败现场逐步修复</h4><p>现场：go save() 后 main 直接返回，订单丢失。下面固定“main 抢先”的困难调度，检查完成协议。</p>
    <div className="sync41-board" data-state={JSON.stringify(current)} aria-label="修复过程的生命周期">
      <article><h4>main</h4><strong>{mainNames[current.main]}</strong><code>go → &lt;-done → return</code></article>
      <article><h4>后台写入</h4><strong>{workerNames[current.worker]}</strong><div className="sync41-segments">{[1,2].map(n => <span key={n} className={n <= 2 - current.remaining ? 'sync41-complete' : ''}>{n <= 2 - current.remaining ? '✓' : '○'} 片段 {n}</span>)}</div></article>
      <article><h4>完成依赖</h4><p>done：{current.receipt ? '已关闭' : '未关闭'}</p><p>写入 → 关闭 → 接收 → 返回</p></article>
    </div>
    <p className="sync41-feedback" aria-live="polite">第 {stepIndex + 1} / {snapshots.length} 步：{instructions[stepIndex]}</p>
    <div className="sync41-actions"><button disabled={stepIndex === 0} onClick={() => setStepIndex(stepIndex - 1)}>回看上一步</button><button disabled={stepIndex === snapshots.length - 1} onClick={() => setStepIndex(stepIndex + 1)}>推进修复过程</button><button onClick={() => setStepIndex(0)}>重看修复</button></div>
    <small>这里展示一条引导路径；在动手观察里可以自己选择其他合法调度。取消请求不等于完成，需要另外设计退出确认。</small>
  </>;
}
function Try() {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return <><h4>换成文件校验：哪份回执才算数？</h4><p>上传已完成，后台校验还需 3 个工作片段。旧代码在启动校验后就关闭 done。main 收到 done 后显示“校验完成”。要让显示在任意合法调度下都成立，你会怎样修复？</p><label>提交前先选择协议<select value={answer} onChange={e => {setAnswer(e.target.value); setSubmitted(false);}}><option value="">选择修复</option><option value="sleep">收到旧 done 后再 Sleep 1 秒</option><option value="after">把 close(done) 移到校验完成之后，main 仍等 done</option><option value="launch">再加一个“校验已启动”的回执</option></select></label><button disabled={!answer} onClick={() => setSubmitted(true)}>提交修复并查看证据</button>{submitted && <p className="sync41-feedback" aria-live="polite">{answer === 'after' ? '修复成立：校验片段 1 → 2 → 3 → close(done) → main 接收返回 → 显示完成。通知位置与业务完成条件一致。' : answer === 'sleep' ? '反例：Sleep 结束时校验仍可能只做完第 1 段。时间经过不能证明工作完成；把通知移到真实校验之后再试。' : '反例：两个启动回执都可以在第 1 个校验片段之前到达。增加启动证据仍然缺少完成事件；检查 close(done) 的位置。'}</p>}<div className="sync41-segments" aria-label="提交后显示的因果证据">{submitted && (answer === 'after' ? ['校验 1', '校验 2', '校验 3', '关闭 done', 'main 接收', '显示完成'] : answer === 'sleep' ? ['启动校验', '旧 done 关闭', 'Sleep 结束', '仅完成片段 1', '错误显示完成'] : ['启动校验', '两个启动回执', '尚未校验', '错误显示完成']).map((event, i) => <span key={event}>{i + 1}. {event}{i < (answer === 'after' ? 5 : answer === 'sleep' ? 4 : 3) ? ' →' : ''}</span>)}</div><small>这是帮助内的迁移练习；提交和揭晓不记为独立掌握。</small></>;
}
export function Help({mode}: {mode: string}) {
  return <section className="sync41 sync41-help" data-testid="lesson41-help">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}</section>;
}

