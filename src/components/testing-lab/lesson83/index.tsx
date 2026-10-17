import {useState} from 'react';
import {replay, nestedFixture, schedules, type FixtureState, type Outcome, type Schedule} from './model';
import './style.css';
const labels: Record<Schedule, string> = {'read-first': 'B 读 → A 写 → A 清理', 'write-read-clear': 'A 写 → B 读 → A 清理', 'write-clear-read': 'A 写 → A 清理 → B 读'};
const outcomes: Record<Outcome, string> = {initial: '仍是初始值（键存在）', written: '看见 A 写入的值', missing: '键被清理（读到零值）'};
const events = {write: 'A 执行 count = 1', clear: 'A 删除 count', read: 'B 读取 count 和 ok'};
function Board({state, title}: {state: FixtureState; title: string}) {
  return <article className="l83-board"><h4>{title}</h4><div className="l83-refs"><span>A → {state.refs.a}</span><span>B → {state.refs.b}</span></div><div className="l83-maps">{Object.entries(state.maps).map(([id, map]) => <div className="l83-map" key={id}><strong>{id}</strong><code>{map.count === undefined ? '{} 空 map' : `count: ${map.count}`}</code></div>)}</div><p className="l83-read">{state.read ? `B 已读取：value=${state.read.value}，ok=${state.read.exists}` : 'B 尚未读取；等待选定的调度步骤。'}</p>{state.read && <p>{state.storage === 'isolated' ? 'B 的引用指向独立 map，A 的写入和删除不传播到这里。' : state.read.outcome === 'initial' ? 'B 在 A 修改前读取；这次结果符合预期，但引用依然共享。' : state.read.outcome === 'written' ? 'A 的写入经共享引用传播到 B：B 的初始数据被污染。' : 'A 清理的是共同对象；缺失键的读取结果是 0、false。'}</p>}</article>;
}
export default function Lab() {
  const [schedule, setSchedule] = useState<Schedule>('write-read-clear');
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const [cursor, setCursor] = useState(0);
  const shared = replay('shared', schedule, cursor);
  const isolated = replay('isolated', schedule, cursor);
  function reset() {setCursor(0); setLocked(false); setPrediction(''); setReason('');}
  return <section className="lesson83" data-testid="testing-lab-83"><h3>你来安排并行子测试的交错</h3><p>目标：沿着引用解释为什么 A 的清理会改变 B 的测试数据。两侧初始 count 都为 0，A 写入 1；只改变 fixture 是否独立。</p><label>选择调度顺序<select value={schedule} disabled={locked} onChange={e => {setSchedule(e.target.value as Schedule); reset();}}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="l83-predict"><label>先预测：共享 map 中 B 会读到什么？<select disabled={locked} value={prediction} onChange={e => setPrediction(e.target.value as Outcome | '')}><option value="">请选择预测</option>{Object.entries(outcomes).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>你的理由<textarea disabled={locked} value={reason} onChange={e => setReason(e.target.value)} placeholder="根据引用指向和读写先后解释" /></label><button disabled={locked || !prediction || !reason.trim()} onClick={() => setLocked(true)}>记录预测与理由</button></div><div className="l83-actions"><button data-testing-action="step" disabled={!locked || cursor === 3} onClick={() => setCursor(value => value + 1)}>{cursor === 3 ? '调度完成' : `单步：${events[schedules[schedule][cursor]]}`}</button><button disabled={cursor === 0} onClick={() => setCursor(value => value - 1)}>回退一步</button><button data-testing-action="reset" onClick={reset}>重置实验</button></div><div data-testid="live-model" data-state={`${schedule}:${cursor}:${shared.read?.outcome ?? 'unread'}`}><ol className="l83-timeline">{schedules[schedule].map((event, index) => <li key={event} className={index < cursor ? 'done' : ''} aria-current={index === cursor ? 'step' : undefined}>{index + 1}. {events[event]} {index < cursor ? '✓' : ''}</li>)}</ol><div className="l83-grid"><Board state={shared} title="共享 fixture" /><Board state={isolated} title="每个子测试独立 fixture" /></div></div><div aria-live="polite" className="l83-feedback">{shared.read ? <><strong>{prediction === shared.read.outcome ? '预测与本次读取一致。' : `本次是：${outcomes[shared.read.outcome]}。`}</strong><p>你的预测：{prediction && outcomes[prediction]}。你的理由：{reason}</p><p>对照证据：同一调度下，共享方案 B 读到 {shared.read.value} / {String(shared.read.exists)}；独立方案 B 读到 {isolated.read?.value} / {String(isolated.read?.exists)}。重置并换一种调度，检查“偶尔通过”是否足以说明隔离。</p></> : '先记录判断，再单步推进；B 的读取快照会保留，不会因后续 A 清理而改写。'}</div><p className="l83-boundary">模型边界：这是手动选择的确定性交错演示，没有运行 Go 调度器或 -race。真实并发读写共享 map 还可能有数据竞争。Go 1.22+ 循环变量独立不代表引用的对象独立；只读且不可变的数据可以共享。</p></section>;
}
function Example() {
  const [separate, setSeparate] = useState(false);
  const [cleared, setCleared] = useState(false);
  return <><h4>两位厨师，两份菜谱，一盘调料？</h4><p>菜谱对应循环变量，调料盘对应可变 map。复制菜谱不会自动复制调料盘。</p><label><input type="checkbox" checked={separate} onChange={e => {setSeparate(e.target.checked); setCleared(false);}} />为两位厨师准备独立调料盘</label><div className="l83-grid" data-testid="live-model" data-state={`${separate}:${cleared}`}><div className="l83-map">A 的盘子：{cleared ? '空' : '盐'}</div><div className="l83-map">B 的盘子：{cleared && !separate ? '空' : '盐'}</div></div><button onClick={() => setCleared(true)} disabled={cleared}>A 收走自己的调料</button><button onClick={() => {setCleared(false); setSeparate(false);}}>重置类比</button><p aria-live="polite">{cleared ? separate ? 'B 仍有盐：操作没有跨过独立对象边界。' : 'B 也没盐了：两个名字指向同一个盘子。' : '切换准备方式，再让 A 清理，比较 B 的资源。'}</p><p>类比边界：这里展示资源归属；不模拟 CPU 内存同步。不可变的菜谱可以共同阅读。</p></>;
}
function Diagram() {
  const [storage, setStorage] = useState<'shared' | 'isolated'>('shared');
  const [selected, setSelected] = useState<'a' | 'b'>('a');
  const [written, setWritten] = useState(false);
  const state = replay(storage, 'write-read-clear', written ? 1 : 0);
  return <><h4>沿引用追踪写入影响</h4><label>对象关系<select value={storage} onChange={e => {setStorage(e.target.value as 'shared' | 'isolated'); setWritten(false);}}><option value="shared">两个变量引用同一 map</option><option value="isolated">两个变量引用各自 map</option></select></label><div className="l83-actions"><button aria-pressed={selected === 'a'} onClick={() => setSelected('a')}>追踪 A 引用</button><button aria-pressed={selected === 'b'} onClick={() => setSelected('b')}>追踪 B 引用</button><button onClick={() => setWritten(true)} disabled={written}>通过 A 写入 1</button><button onClick={() => {setStorage('shared'); setSelected('a'); setWritten(false);}}>重置关系图</button></div><div data-testid="live-model" data-state={`${storage}:${selected}:${written}`}><p className="l83-path">变量 {selected.toUpperCase()} → 对象 {state.refs[selected]} → count = {state.maps[state.refs[selected]].count}</p><Board state={state} title="变量与对象是两层" /></div><p>箭头表示引用。点击 A / B 可追踪到具体对象；切换为独立 map 后，A 的写入只改变 map-A。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const state = replay('shared', 'write-clear-read', step);
  const notes = ['先画出两个变量：它们都指向 shared，初始 count=0。', 'A 写入 1。此时 B 的对象也含 count=1，但 B 尚未读取。', 'A 删除键。共同对象变空，不能把“未读取”理解成“读到0”。', 'B 执行 value, ok := m["count"]，得到 0、false。0 来自缺失键的零值。'];
  return <><h4>拆开“写入—清理—读取”</h4><div data-testid="live-model" data-state={String(step)}><p className="l83-path">步骤 {step + 1} / 4：{notes[step]}</p><Board state={state} title="追踪同一对象的生命周期" /></div><button disabled={step === 0} onClick={() => setStep(value => value - 1)}>上一步</button><button data-testing-action="step" disabled={step === 3} onClick={() => setStep(value => value + 1)}>下一步</button><button onClick={() => setStep(0)}>重置步骤</button><p>修复检查：为 B 创建自己的 map，再用相同顺序重跑；本题的 int 值复制足够，嵌套引用需要进一步复制。</p></>;
}
function Transfer() {
  const [copy, setCopy] = useState<'shallow' | 'deep'>('shallow');
  const [initial, setInitial] = useState(7);
  const [guess, setGuess] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<ReturnType<typeof nestedFixture> | null>(null);
  function clear() {setResult(null); setGuess(''); setReason('');}
  return <><h4>换成结构体里的 slice，隔离还成立吗？</h4><p>新任务：A、B 各复制一份结构体，字段 items 是 slice。A 将 items[0] 改为 99，预测 B 的 items[0]。</p><label>初始元素<select value={initial} onChange={e => {setInitial(Number(e.target.value)); clear();}}><option value={7}>7</option><option value={23}>23</option><option value={42}>42</option></select></label><label>fixture 构造方式<select value={copy} onChange={e => {setCopy(e.target.value as 'shallow' | 'deep'); clear();}}><option value="shallow">仅复制外层结构体</option><option value="deep">另建 slice 并复制元素</option></select></label><label>预测 B 的值<input value={guess} onChange={e => {setGuess(e.target.value); setResult(null);}} inputMode="numeric" /></label><label>解释引用关系<textarea value={reason} onChange={e => {setReason(e.target.value); setResult(null);}} /></label><button disabled={!guess.trim() || !reason.trim() || !Number.isFinite(Number(guess))} onClick={() => setResult(nestedFixture(copy, initial, 99))}>提交后运行新输入</button><button data-testing-action="reset" onClick={() => {setCopy('shallow'); setInitial(7); clear();}}>重置迁移</button><div aria-live="polite" data-testid="live-model" data-state={result ? `${copy}:${initial}:${result.b}` : `pending:${copy}:${initial}`} className="l83-feedback">{result ? <><strong>{Number(guess) === result.b ? '本次预测一致。' : `实际 B=${result.b}，与你预测的 ${guess} 不同。`}</strong><p>A → {result.sameArray ? '共同数组' : '数组 A'} → 99；B → {result.sameArray ? '共同数组' : '数组 B'} → {result.b}。</p><p>{result.sameArray ? '外层结构体虽独立，slice 仍引用相同底层数组；需要复制可变元素存储。' : '本例元素为 int；复制底层元素后，A 的写入不会污染 B。'}</p><p>你的理由：{reason}</p></> : '先预测并解释，再观察引用图和结果。'}</div><p className="l83-boundary">这是帮助区迁移练习，不写入正式成绩；反馈后的重试属于有提示练习。嵌套引用更深时，仍需逐层检查。</p></>;
}
export function Help({mode}: {mode: string}) {
  return <section className="lesson83 l83-help" data-testid="testing-help-83">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}
