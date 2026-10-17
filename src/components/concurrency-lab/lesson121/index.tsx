import { useEffect, useState } from 'react';
import { advance, current, defaults, finished, initial, metrics, names, places, reason, rewind, run, type Board, type Config, type Place, type Strategy } from './model';
import './style.css';

function TaskBoard({ board, config, submitted, selected, onSelect }: { board: Board; config: Config; submitted: boolean; selected: number; onSelect: (id: number) => void }) {
  const m = metrics(board, config, submitted);
  return <article className="c121-board" data-strategy={board.strategy}>
    <h4>{names[board.strategy]}</h4>
    <div className="c121-metrics"><span>执行 <b>{m.active}</b> / {config.dependency}</span><span>存活工作 G <b>{m.goroutines}</b></span><span>完成 <b>{m.done}</b> / {config.total}</span></div>
    <p className={m.overloaded ? 'c121-danger' : 'c121-status'}>{m.overloaded ? '超过依赖预算' : submitted ? '当前未超过依赖预算' : '等待提交'}</p>
    {(['source', ...(board.strategy === 'inside' ? ['waiting'] : board.strategy === 'workers' ? ['queue'] : []), 'active', 'done'] as Place[]).map(place => <div className="c121-lane" key={place}><span>{places[place]}{place === 'queue' ? `（容量 ${config.queue}）` : ''}</span><div className="c121-tasks">{board.tasks.filter(t => t.place === place).map(task => <button type="button" key={task.id} aria-label={`${names[board.strategy]} T${task.id}：${places[place]}`} aria-pressed={selected === task.id} data-place={place} onClick={() => onSelect(task.id)}>T{task.id}</button>)}{!board.tasks.some(t => t.place === place) && <small>空</small>}</div></div>)}
    <p className="c121-evidence">执行峰值 {board.peakActive} · G 峰值 {board.peakG} · 队列峰值 {board.peakQueue}</p>
    <p>{reason(board, config, submitted)}</p>
  </article>;
}
export default function Lab() {
  const [state, setState] = useState(() => initial());
  const [prediction, setPrediction] = useState({ active: '', goroutines: '' });
  const [why, setWhy] = useState('');
  const [selected, setSelected] = useState(1);
  const [playing, setPlaying] = useState(false);
  const config = state.config, frame = current(state);
  const submitted = state.cursor > 0;
  const predicted = prediction.active !== '' && prediction.goroutines !== '';
  const first = state.history[1]?.boards.find(b => b.strategy === 'inside');
  const actual = first ? metrics(first, config) : undefined;
  const stopped = finished(state) || (config.workers === 0 && state.cursor >= 2);
  useEffect(() => {
    if (!playing || stopped) return;
    const timer = window.setInterval(() => setState(previous => advance(previous)), 900);
    return () => window.clearInterval(timer);
  }, [playing, stopped]);
  function configure(next: Config) { setPlaying(false); setState(initial(next)); setPrediction({ active: '', goroutines: '' }); setWhy(''); setSelected(1); }
  return <section className="c121" data-testid="concurrency-lab-121">
    <header><p className="c121-eyebrow">121 · 先看资源在哪里产生</p><h3>限制执行，是否也限制了等待者？</h3><p>同一批输入同时送给三个方案。观察任务位置、工作 goroutine 数和依赖调用数，检查“最后都成功”是否足够。</p></header>
    <div className="c121-controls">{([['total', '批任务数量', 0, 12], ['workers', 'worker / 许可额度', 0, 6], ['queue', 'worker 队列容量', 0, 8], ['dependency', '依赖并发预算', 1, 6]] as const).map(([key, label, min, max]) => <label key={key}>{label}<input aria-label={label} type="range" min={min} max={max} value={config[key]} onChange={e => configure({ ...config, [key]: Number(e.target.value) })}/><output>{config[key]}</output></label>)}</div>
    <div className="c121-presets"><button onClick={() => configure({ ...defaults, total: 1 })}>低负载反例：1 项</button><button onClick={() => configure({ ...defaults, queue: 0 })}>零缓冲队列</button><button onClick={() => configure({ ...defaults, workers: 0 })}>零额度会怎样</button><button onClick={() => configure(defaults)}>恢复 8 / 2 / 2 基线</button></div>
    <fieldset className="c121-predict" disabled={submitted}><legend>先预测：中间方案首次接纳后</legend><p>先创建所有 G，再在 G 内拿许可。分别预测执行数与存活 G 数。</p><div className="c121-inline"><label>执行数<select aria-label="预测执行数" value={prediction.active} onChange={e => setPrediction({ ...prediction, active: e.target.value })}><option value="">请选择</option>{Array.from({ length: 13 }, (_, n) => <option key={n}>{n}</option>)}</select></label><label>工作 G 数<select aria-label="预测工作G数" value={prediction.goroutines} onChange={e => setPrediction({ ...prediction, goroutines: e.target.value })}><option value="">请选择</option>{Array.from({ length: 13 }, (_, n) => <option key={n}>{n}</option>)}</select></label></div><label>预测理由（可选）<input value={why} onChange={e => setWhy(e.target.value)} placeholder="许可在哪一步生效？" /></label></fieldset>
    <div className="c121-actions"><button data-concurrency-action="step" disabled={!predicted || stopped} onClick={() => { setPlaying(false); setState(advance(state)); }}>{submitted ? '完成当前批并派发下一批' : '提交预测并单步'}</button><button data-concurrency-action="back" disabled={!submitted} onClick={() => { setPlaying(false); setState(rewind(state)); }}>回退一步</button><button data-concurrency-action="reset" onClick={() => configure(config)}>重置本实验</button><button disabled={!predicted || stopped} onClick={() => setPlaying(!playing)}>{playing && !stopped ? '暂停' : '播放'}</button><button disabled={!predicted || stopped} onClick={() => { setPlaying(false); setState(run(config)); }}>运行到结束</button><span>逻辑步骤 {frame.round}</span></div>
    {!predicted && <p>选择两个预测值后开始；预测仅用于本次观察，不计入掌握记录。</p>}
    {submitted && actual && <p role="status" className="c121-feedback">你的预测：执行 {prediction.active} / G {prediction.goroutines}；首次实际：执行 {actual.active} / G {actual.goroutines}。{Number(prediction.active) === actual.active && Number(prediction.goroutines) === actual.goroutines ? '两项都符合本模型。' : '逐个追踪等待许可的任务：它们已经拥有 G。'}{why && ` 你的理由：${why}`}</p>}
    <div data-testid="live-model" data-state={JSON.stringify({ config, frame })} className="c121-boards">{frame.boards.map(board => <TaskBoard key={board.strategy} board={board} config={config} submitted={submitted} selected={selected} onSelect={setSelected}/>)}</div>
    {config.total > 0 && <aside className="c121-trace"><b>跨方案追踪 T{selected}</b><div>{frame.boards.map(board => <span key={board.strategy}>{names[board.strategy]} → {places[board.tasks.find(t => t.id === selected)!.place]}</span>)}</div><p>点击任一任务牌，同一任务在另外两种方案中的位置会同步标记。</p></aside>}
    <p className="c121-boundary">模型边界：一项任务耗时一轮，所有正在执行的任务同时完成，再派发下一批；轮次不是性能实测。超额仅标记风险，未模拟依赖失败。G 指工作 goroutine，不含调度器和生产者。有限上游列表由单一生产者背压提交，不能据此推断无限请求入口也有界。队列容量为 0 仍可与空闲 worker 直接交接；额度为 0 则无法前进。</p>
  </section>;
}
function Example() {
  const [people, setPeople] = useState(8);
  return <div><h4>餐厅类比：厨师和领号的客人不同</h4><label>同时到店人数 <input type="range" min="1" max="12" value={people} onChange={e => setPeople(Number(e.target.value))}/><output>{people}</output></label><div className="c121-analogy"><div><b>每人自带一名厨师</b><p>{people} 名厨师涌向只有 2 个位置的灶台，最多 {people} 人同时尝试做菜。</p></div><div><b>先雇厨师，再领灶台许可</b><p>{Math.min(2, people)} 人做菜，{Math.max(0, people - 2)} 名已雇厨师在等；厨师总人数仍是 {people}。</p></div><div><b>只雇两名厨师</b><p>{Math.min(2, people)} 人做菜，最多 2 张订单排队，{Math.max(0, people - 4)} 人暂不交单。</p></div></div><p>厨师对应工作 G，灶台对应依赖并发，订单对应队列任务。现实等待者也可能占资源；本例只在有限批任务与可背压入口下成立。</p></div>;
}
function Diagram() {
  const [focus, setFocus] = useState<'g' | 'call' | 'queue'>('g');
  return <div><h4>沿边界找资源的诞生位置</h4><div className="c121-inline">{([['g', '追踪 G 创建'], ['call', '追踪依赖调用'], ['queue', '追踪队列']] as const).map(([key, title]) => <button key={key} aria-pressed={focus === key} onClick={() => setFocus(key)}>{title}</button>)}</div><div className="c121-path"><b>G 内取许可</b><span data-highlight={focus === 'g'}>8 个任务 → 创建 8 个 G</span><span data-highlight={focus === 'call'}>→ 2 份许可 → 最多 2 项调用</span><small>余下 6 个 G 等许可，未进入有界任务队列</small></div><div className="c121-path"><b>固定 worker</b><span data-highlight={focus === 'queue'}>单一生产者 → 最多 2 项入队</span><span data-highlight={focus === 'g'}>→ 预先创建 2 个 worker G</span><span data-highlight={focus === 'call'}>→ 最多 2 项调用</span></div><p role="status">{focus === 'g' ? '两条路径都能把执行限制到 2，但只有第二条路径把工作 G 总数固定到 2。' : focus === 'queue' ? '队列满时生产者停止提交；其余任务留在本来就有限的输入列表。不能为每个阻塞提交再创建一个 G。' : '额度必须与依赖预算匹配。把 worker 改成 6 并不会把依赖容量也变成 6。'}</p></div>;
}
function Steps() {
  const [index, setIndex] = useState(0);
  const chain = [ ['确定不变量', '全部任务最终处理；依赖同时调用不超过 2；工作 G 和等待队列分别设界。'], ['在资源产生前设界', '创建固定 2 个 worker。单一生产者向容量 2 的队列提交，满时暂停。'], ['跟踪一项完成', 'worker 1 完成 T1 后取 T3。复用同一个 G，释放的队列槽才允许新任务入队。'], ['验证边界并收尾', '零缓冲可直接交接；零 worker 无法前进。批次耗尽后关闭队列并等待 worker 退出。生产环境另需取消和过载策略。'] ];
  return <div><h4>按不变量推导实现</h4><ol className="c121-steps">{chain.map(([title], n) => <li key={title} aria-current={index === n ? 'step' : undefined}>{title}</li>)}</ol><p aria-live="polite"><b>第 {index + 1} 步：</b>{chain[index][1]}</p><button disabled={index === 0} onClick={() => setIndex(index - 1)}>上一步</button><button disabled={index === chain.length - 1} onClick={() => setIndex(index + 1)}>下一步</button></div>;
}
function Try() {
  const [strategy, setStrategy] = useState<Strategy>('inside');
  const [workers, setWorkers] = useState(2);
  const [revealed, setRevealed] = useState(false);
  const config = { ...defaults, total: 7, workers, queue: 1 };
  const result = current(run(config)).boards.find(b => b.strategy === strategy)!;
  const passed = result.peakActive <= 2 && result.peakG <= 2 && result.tasks.every(t => t.place === 'done');
  return <div><h4>独立小练习：7 项任务，双重上限</h4><p>目标：处理全部 7 项，执行峰值 ≤ 2，工作 G 峰值 ≤ 2；队列固定 1 格。先配置，再运行核对。</p><label>提交策略<select value={strategy} onChange={e => { setStrategy(e.target.value as Strategy); setRevealed(false); }}>{Object.entries(names).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>worker / 许可额度<select value={workers} onChange={e => { setWorkers(Number(e.target.value)); setRevealed(false); }}>{[0, 1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></label><button onClick={() => setRevealed(true)}>运行并核对约束</button>{revealed && <div className="c121-feedback" role="status"><b>{passed ? '本次配置满足三个约束' : '找到了需要修复的约束'}</b><p>完成 {result.tasks.filter(t => t.place === 'done').length}/7 · 执行峰值 {result.peakActive}/2 · G 峰值 {result.peakG}/2 · 队列峰值 {result.peakQueue}/1</p><p>{workers === 0 && strategy !== 'direct' ? '额度为零不能前进。' : result.peakG > 2 ? '许可生效前 G 已创建，试着把限制移到 G 的创建边界。' : result.peakActive > 2 ? '固定 worker 也必须匹配依赖预算。' : '固定入口和执行边界后，再核对所有任务都完成。'}</p></div>}<p>这是一份独立沙盒；改配置可重试，不修改上面的观察状态或正式掌握记录。</p></div>;
}
export function Help({ mode }: { mode: string }) { return <section className="c121 c121-help" data-testid="concurrency-help-121" data-mode={mode}>{mode === 'example' ? <Example/> : mode === 'diagram' ? <Diagram/> : mode === 'steps' ? <Steps/> : <Try/>}</section>; }

