import { useEffect, useState } from 'react';
import { Play, Pause, ChevronLeft, SkipForward, RotateCcw } from 'lucide-react';
import { advance, challengeChecks, createTimeline, defaults, isFinished, metrics, names, places, seek, taskReason, type Board, type Config, type Place, type Snapshot, type Strategy, type Timeline } from './model';
import './bounded-lab.css';

const stages = [
  { title: '观察突增', task: '同一批八项任务，等待会发生在哪里？', hint: '提交这一批，再单步推进。对照两侧任务的位置，而不只看最后是否全部完成。' },
  { title: '验证误解', task: '执行数都限制为 2，goroutine 数也一样吗？', hint: '先预测两个峰值，再提交任务。点选 T3，观察它在两个方案中分别在哪里等待。' },
  { title: '缩小队列', task: '把队列容量从 6 改成 2，剩下的任务去哪了？', hint: '参数改变会重置本轮。试试容量 0，再比较队列等待与尚未接纳：等待没有凭空消失。' },
  { title: '修复与复验', task: '全部完成，同时守住三条资源上限。', hint: '选择策略和配置：执行、工作 goroutine、队列等待的峰值都不能超过 2。通过八项任务后，再增加到十六项。' },
];
type Prediction = { active: string; goroutines: string };
const blankPredictions = (): Prediction[] => [{ active: '', goroutines: '' }, { active: '', goroutines: '' }];
const statusText = { pass: '通过', fail: '超限', pending: '待验证' };

function CodeView({ board, selected, submitted }: { board: Board; selected: number; submitted: boolean }) {
  const task = board.tasks.find(t => t.id === selected)!;
  const lines: { text: string; at: Place[] }[] = board.strategy === 'direct' ? [
    { text: 'for _, job := range batch {', at: ['source'] },
    { text: '    go process(job)', at: ['running'] },
    { text: '}', at: [] },
  ] : board.strategy === 'semaphore' ? [
    { text: 'sem := make(chan struct{}, limit)', at: [] },
    { text: 'for _, job := range batch {', at: ['source'] },
    { text: '    go func(job Job) {', at: [] },
    { text: '        sem <- struct{}{} // 先创建，再等许可', at: ['permit'] },
    { text: '        process(job)', at: ['running'] },
    { text: '        <-sem // 归还许可', at: [] },
    { text: '    }(job)', at: [] },
    { text: '}', at: [] },
  ] : [
    { text: 'jobs := make(chan Job, capacity)', at: ['queue'] },
    { text: 'for w := 0; w < min(limit, len(batch)); w++ {', at: [] },
    { text: '    go func() {', at: [] },
    { text: '        for job := range jobs {', at: ['queue'] },
    { text: '            process(job)', at: ['running'] },
    { text: '        }', at: [] },
    { text: '    }()', at: [] },
    { text: '}', at: [] },
    { text: 'for _, job := range batch {', at: [] },
    { text: '    jobs <- job // 单一生产者；满时阻塞', at: ['source'] },
    { text: '}', at: [] },
    { text: 'close(jobs) // 排空后 worker 退出', at: [] },
  ];
  return <details className="bounded-code">
    <summary>追踪 T{selected} · 查看对应 Go 代码</summary>
    <p>{taskReason(task, board.strategy, submitted)}</p>
    <pre aria-label={`${names[board.strategy]}的代码关联`}>{lines.map((line, i) => <code key={i} className={submitted && line.at.includes(task.place) ? 'is-current' : ''} aria-current={submitted && line.at.includes(task.place) ? 'step' : undefined}><span>{i + 1}</span>{line.text}</code>)}</pre>
    <small>教学片段：Job / process 为占位类型与函数，省略统一等待收尾。高亮表示任务关联的操作，不是实际 Go 调试器；完成任务不再有当前执行行。</small>
  </details>;
}

function BoardView({ board, config, snapshot, selected, onSelect }: { board: Board; config: Config; snapshot: Snapshot; selected: number; onSelect: (id: number) => void }) {
  const m = metrics(board), selectedTask = board.tasks.find(t => t.id === selected)!;
  const lanes: Place[] = board.strategy === 'workers' ? ['source', 'queue', 'running', 'done'] : board.strategy === 'semaphore' ? ['source', 'permit', 'running', 'done'] : ['source', 'running', 'done'];
  const counts = [['正在执行', m.active], ['执行峰值', board.peak.active], ['工作 G 存活', m.goroutines], ['工作 G 峰值', board.peak.goroutines], ['等待合计', m.source + m.queued + m.permit], ['完成任务', `${m.done}/${config.total}`]];
  const workerCount = Math.min(config.limit, config.total);
  return <article className="bounded-board" data-testid={`board-${board.strategy}`}>
    <header><span className="bounded-strategy-label">{board.strategy === 'direct' ? '不限制执行' : board.strategy === 'semaphore' ? '限制受保护执行' : '限制 worker 与缓冲'}</span><h4>{names[board.strategy]}</h4><span className="bounded-clock">t = {snapshot.time}{board.finishedAt !== undefined ? ` · 已在 t=${board.finishedAt} 完成` : snapshot.submitted ? ' · 运行中' : ' · 待提交'}</span></header>
    <dl className="bounded-metrics">{counts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd data-testid={`metric-${label}`}>{value}</dd></div>)}</dl>
    <div className={`bounded-budget ${m.active > 2 ? 'over-budget' : ''}`}>{m.active > 2 ? `超过预算 ${m.active - 2} 项：正在执行 ${m.active} / 预算 2` : `依赖并发预算 2 · 当前执行 ${m.active}`}</div>
    {board.strategy !== 'direct' && <div className="bounded-resources" aria-label={board.strategy === 'workers' ? 'worker 状态' : '许可状态'}>
      {Array.from({ length: board.strategy === 'workers' ? workerCount : config.limit }, (_, i) => {
        const task = board.strategy === 'workers' ? board.tasks.find(t => t.place === 'running' && t.worker === i + 1) : board.tasks.filter(t => t.place === 'running')[i];
        return <span key={i} className={task ? 'busy' : ''}>{board.strategy === 'workers' ? `W${i + 1}` : `许可 ${i + 1}`}<b>{task ? `T${task.id}` : board.strategy === 'workers' ? snapshot.submitted ? '已退出' : '待创建' : '空闲'}</b></span>;
      })}
    </div>}
    <div className="bounded-lanes">{lanes.map(place => {
      const tasks = board.tasks.filter(t => t.place === place);
      return <section className={`bounded-lane lane-${place}`} key={place} data-testid={`lane-${place}`}>
        <div className="bounded-lane-title"><strong>{places[place]}</strong><span>{tasks.length}{place === 'queue' ? ` / ${config.capacity}` : ' 项'}</span></div>
        {place === 'source' && <small>原始批任务列表 · 不计入队列容量</small>}
        {place === 'queue' && config.capacity === 0 && <small>无缓冲槽位 · 与空闲 worker 直接交接</small>}
        <div className="bounded-tokens">{tasks.map(t => <button key={t.id} aria-label={`查看 T${t.id}：${places[place]}`} aria-pressed={t.id === selected} className={t.id === selected ? 'selected' : ''} onClick={() => onSelect(t.id)}><b>T{t.id}</b><small>{place === 'running' ? board.strategy === 'workers' ? `W${t.worker}` : `G${t.id}` : place === 'permit' ? `G${t.id} 等待` : place === 'done' ? '完成' : place === 'queue' ? '队列' : '批列表'}</small></button>)}{!tasks.length && <span className="bounded-empty">{snapshot.submitted ? '无任务' : '尚未开始'}</span>}</div>
      </section>;
    })}</div>
    <p className="bounded-producer">协调者 × 1（不计入工作 G）：{!snapshot.submitted ? '尚未提交' : board.strategy === 'workers' && m.source > 0 ? `提交被阻塞，仍有 ${m.source} 项未接纳` : board.finishedAt !== undefined ? '已完成收尾' : '已提交全部任务，等待收尾'}。</p>
    <div className="bounded-inspector" data-testid="task-inspector"><strong>T{selected} · {places[selectedTask.place]}</strong><p>{taskReason(selectedTask, board.strategy, snapshot.submitted)}</p></div>
    <CodeView board={board} selected={selected} submitted={snapshot.submitted}/>
    <details className="bounded-events"><summary>T{selected} 的事件证据</summary><ol>{board.events.filter(e => e.task === selected).map((e, i) => <li key={i}><b>t={e.time}</b> {e.text}</li>)}</ol>{!board.events.some(e => e.task === selected) && <p>尚无提交或执行事件；任务仍在原始列表中。</p>}</details>
  </article>;
}

function ExecutionTimeline({ timeline, selected, onSelect, onSeek }: { timeline: Timeline; selected: number; onSelect: (id: number) => void; onSeek: (index: number) => void }) {
  const current = timeline.frames[timeline.cursor];
  const horizon = Math.max(2, Math.ceil(timeline.config.total / timeline.config.limit) * 2);
  return <section className="bounded-history" aria-label="任务执行时间线">
    <h4>同一时钟，追踪同一项任务</h4><p>实心条表示执行，前面的虚线表示执行前等待。点任务行可联动查看两侧；未接纳与排队的区别见上方泳道。</p>
    <div className="bounded-time-grids">{current.boards.map(board => <div key={board.strategy} data-testid={`timeline-${board.strategy}`}><strong>{names[board.strategy]}</strong><div className="bounded-axis"><span>0</span><span>模拟时间 → {horizon}</span></div>{board.tasks.map(task => <button key={task.id} className={`bounded-time-row ${selected === task.id ? 'selected' : ''}`} aria-label={`时间线选择 T${task.id}`} aria-pressed={selected === task.id} onClick={() => onSelect(task.id)}>
      <span>T{task.id}</span><span className="bounded-time-track"><i className="bounded-wait-bar" style={{ width: `${(task.startedAt ?? current.time) / horizon * 100}%` }}/>{task.startedAt !== undefined && <i className="bounded-run-bar" style={{ left: `${task.startedAt / horizon * 100}%`, width: `${((task.completedAt ?? current.time) - task.startedAt) / horizon * 100}%` }}/>}<i className="bounded-time-cursor" style={{ left: `${current.time / horizon * 100}%` }}/></span><small>{task.startedAt === undefined ? places[task.place] : `${task.startedAt} → ${task.completedAt ?? '执行中'}`}</small>
    </button>)}</div>)}</div>
    <label className="bounded-scrubber">回看已发生的状态 · {timeline.cursor + 1} / {timeline.frames.length}<input aria-label="实验历史" type="range" min={0} max={timeline.frames.length - 1} value={timeline.cursor} onChange={e => onSeek(+e.target.value)}/></label>
  </section>;
}

export default function BoundedLab() {
  const [stage, setStage] = useState(0), [strategy, setStrategy] = useState<Strategy>('semaphore');
  const [timeline, setTimeline] = useState(() => createTimeline());
  const [playing, setPlaying] = useState(false), [selected, setSelected] = useState(1);
  const [predictions, setPredictions] = useState(blankPredictions), [eightEvidence, setEightEvidence] = useState<string | null>(null);
  const current = timeline.frames[timeline.cursor], config = timeline.config;
  const finished = isFinished(current), checks = challengeChecks(timeline);
  const passed = checks.every(c => c.status === 'pass');
  const fingerprint = `${strategy}:${config.limit}:${config.capacity}`;

  useEffect(() => {
    if (!playing) return;
    if (finished) { setPlaying(false); return; }
    const timer = setTimeout(() => setTimeline(t => advance(t)), 900);
    return () => clearTimeout(timer);
  }, [playing, finished, timeline.cursor]);

  function rebuild(nextConfig: Config, nextStage = stage, nextStrategy = strategy) {
    setPlaying(false); setSelected(1); setPredictions(blankPredictions());
    setTimeline(createTimeline(nextConfig, nextStage === 3 ? [nextStrategy] : [nextStage === 0 ? 'direct' : 'semaphore', 'workers']));
  }
  function changeStage(next: number) {
    if (next === stage) return;
    setStage(next); setStrategy('semaphore'); setEightEvidence(null); rebuild(defaults, next, 'semaphore');
  }
  function configure(patch: Partial<Config>) { setEightEvidence(null); rebuild({ ...config, ...patch }); }
  function navigate(index: number) { setPlaying(false); setTimeline(t => seek(t, index)); }
  function next() { setPlaying(false); setTimeline(t => advance(t)); }
  function runToEnd() {
    setPlaying(false);
    setTimeline(t => { let result = t; while (!isFinished(result.frames[result.cursor])) result = advance(result); return result; });
  }
  function stress() { setEightEvidence(fingerprint); rebuild({ ...config, total: 16 }); }

  return <section className="experiment-panel bounded-lab" data-testid="bounded-lab">
    <header className="bounded-heading"><div><span className="eyebrow">CONCURRENCY LAB · 121</span><h3>执行有界，等待在哪里？</h3><p>让同一批任务走过不同策略，亲手找出被限制的资源。</p></div><span className="bounded-budget-tag">依赖预算 <b>2</b></span></header>
    <nav className="bounded-stages" aria-label="并发实验阶段">{stages.map((item, i) => <button key={item.title} aria-current={stage === i ? 'step' : undefined} className={stage === i ? 'selected' : ''} onClick={() => changeStage(i)}><span>0{i + 1}</span>{item.title}</button>)}</nav>
    <div className="bounded-task"><span>实验 {stage + 1} / 4</span><h4>{stages[stage].task}</h4><p>{stages[stage].hint}</p></div>
    <div className="bounded-config">
      {stage === 3 ? <label>执行策略<select aria-label="执行策略" value={strategy} onChange={e => { const value = e.target.value as Strategy; setStrategy(value); setEightEvidence(null); rebuild({ ...config, total: 8 }, stage, value); }}>{Object.entries(names).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label> : <label>任务数 <b>{config.total}</b><input aria-label="任务数" type="range" min={1} max={16} value={config.total} onChange={e => configure({ total: +e.target.value })}/></label>}
      <label>执行额度 / worker 数 <b>{config.limit}</b><input aria-label="执行额度与 worker 数" type="range" min={1} max={4} value={config.limit} onChange={e => configure({ limit: +e.target.value, ...(stage === 3 ? { total: 8 } : {}) })}/></label>
      <label>等待队列容量 <b>{config.capacity}</b><input aria-label="等待队列容量" type="range" min={0} max={16} value={config.capacity} onChange={e => configure({ capacity: +e.target.value, ...(stage === 3 ? { total: 8 } : {}) })}/></label>
    </div>
    <p className="bounded-config-note">修改参数会暂停并重置本轮。额度作用于许可 / worker；队列容量只作用于固定 worker 方案。任务每项耗时 2 个模拟单位。</p>
    {stage === 1 && <fieldset className="bounded-predictions"><legend>先预测，也可以直接观察</legend><div>{current.boards.map((board, i) => <section key={board.strategy}><strong>{names[board.strategy]}</strong>{(['active', 'goroutines'] as const).map(key => <label key={key}>{key === 'active' ? '执行峰值' : '工作 goroutine 峰值'}<input aria-label={`${names[board.strategy]}预测${key === 'active' ? '执行峰值' : '工作 goroutine 峰值'}`} type="number" min={0} max={16} placeholder="?" disabled={current.submitted} value={predictions[i][key]} onChange={e => setPredictions(old => old.map((v, j) => j === i ? { ...v, [key]: e.target.value } : v))}/></label>)}</section>)}</div>{finished && <p role="status">{current.boards.map((board, i) => `${names[board.strategy]}：执行峰值 ${board.peak.active}，工作 G 峰值 ${board.peak.goroutines}；${predictions[i].active === '' || predictions[i].goroutines === '' ? '未完整预测，可重置再试' : +predictions[i].active === board.peak.active && +predictions[i].goroutines === board.peak.goroutines ? '预测吻合' : '预测有差异，请追踪等待中的任务'}`).join('。')}</p>}</fieldset>}
    <div className="bounded-controls">
      <button onClick={next} disabled={current.submitted}>提交这一批</button>
      <button className="secondary" onClick={() => setPlaying(!playing)} disabled={!current.submitted || finished}>{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? '暂停' : '播放'}</button>
      <button className="ghost" onClick={next} disabled={!current.submitted || finished}><SkipForward size={15}/>下一时间步</button>
      <button className="ghost" onClick={() => navigate(timeline.cursor - 1)} disabled={!timeline.cursor}><ChevronLeft size={15}/>回退一步</button>
      <button className="ghost" onClick={() => rebuild(config)}><RotateCcw size={15}/>重置本轮</button>
      <button className="ghost" onClick={runToEnd} disabled={finished}>运行到结束</button>
    </div>
    <p className="bounded-live-status" role="status">{!current.submitted ? `待提交 ${config.total} 项任务` : `当前 t=${current.time} · ${finished ? '本轮全部完成，可回看历史' : stage === 3 ? '每步推进 1 个模拟时间单位' : '两侧使用同一逻辑时钟；每步推进 1 个时间单位'}`}</p>
    <div className={`bounded-boards ${stage === 3 ? 'single' : ''}`} data-testid="live-model" data-state={JSON.stringify(current)}>{current.boards.map(board => <BoardView key={board.strategy} board={board} snapshot={current} config={config} selected={selected} onSelect={setSelected}/>)}</div>
    {stage === 3 && <section className="bounded-challenge" data-testid="challenge-results"><h4>{config.total} 项任务 · 资源约束检查</h4><p>仅记录本实验的运行证据，不计入独立测验成绩。</p><ul>{checks.map(check => <li key={check.label} className={`check-${check.status}`}><span>{check.label}</span><strong>{statusText[check.status]} · {check.value}</strong>{check.firstViolation !== undefined && <button className="ghost" onClick={() => navigate(check.firstViolation!)}>定位首次超限：{check.label}</button>}</li>)}</ul>{finished && <p role="status">{passed ? '全部约束通过' : '仍有资源超限，请修改策略或容量后重跑'} · 完成耗时 {current.boards[0].finishedAt} 个模拟单位 / {current.boards[0].finishedAt! / 2} 轮执行。</p>}<button disabled={!(config.total === 8 && passed)} onClick={stress}>保持配置，增加到 16 项复验</button>{config.total === 16 && eightEvidence === fingerprint && <p>同一配置已通过 8 项任务。{finished && passed ? '16 项复验也通过：任务增加，资源峰值仍在上限内。' : '继续运行，验证增加任务后的资源峰值。'}</p>}</section>}
    <ExecutionTimeline timeline={timeline} selected={selected} onSelect={setSelected} onSeek={navigate}/>
    <aside className="bounded-boundary"><strong>读图边界</strong><p>这是确定性教学调度，不代表 Go 的实际调度顺序或性能。工作 G = 工作 goroutine，不含单独显示的协调者。空闲 worker 在关闭的队列排空后退出；同时完成的任务先统一完成，再领取下一批。</p><p>有界队列只限制缓冲：原始批任务列表仍占资源，生产入口仍需独立容量与过载策略。本实验是队列拓展模型，参数不会改写右侧编辑器中的 Go 示例。</p></aside>
  </section>;
}
