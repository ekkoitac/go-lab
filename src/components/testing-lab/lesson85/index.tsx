import { useState } from 'react';
import { canStep, completed, createRaceState, nextActor, raceEvidence, runSchedule, stepRace, type Protection } from './model';
import './style.css';

const labels: Record<Protection, string> = { none: '无同步', split: '读和写分别加锁', whole: '锁住整个读→加→写' };
function Workbench({ transfer = false }: { transfer?: boolean }) {
  const [protection, setProtection] = useState<Protection>('none');
  const [initial, setInitial] = useState(transfer ? 7 : 0);
  const [executed, setExecuted] = useState(true);
  const [detector, setDetector] = useState(true);
  const [state, setState] = useState(() => createRaceState('none', transfer ? 7 : 0));
  const [prediction, setPrediction] = useState('');
  const [racePrediction, setRacePrediction] = useState('');
  const [reason, setReason] = useState('');
  const [started, setStarted] = useState(false);
  function configure(p = protection, n = initial, path = executed) { setProtection(p); setInitial(n); setExecuted(path); setState(createRaceState(p, n, path)); setPrediction(''); setRacePrediction(''); setReason(''); setStarted(false); }
  const done = started && completed(state);
  const evidence = raceEvidence(state);
  const ready = !!prediction && !!racePrediction && !!reason.trim();
  return <div className="t85-workbench">
    <p>{transfer ? '迁移练习：从 7 开始，或改一个新初值。此练习独立于主实验，不写入正式成绩。' : '扮演调度器：让 A、B 各加 1。分别检查数值是否正确、访问是否同步，以及检测覆盖了什么。'}</p>
    <p className="t85-note">这是内存访问教学模型，不是真实运行 Go 或 -race。一次加法简化为“读到局部变量 → 加 1 后写回”。检测结果仅模拟本模型的同步关系。</p>
    <div className="t85-controls"><label>共享初值<input type="number" min={0} max={20} value={initial} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 20) configure(protection, n); }} /></label>
      <label>同步方案<select value={protection} onChange={e => configure(e.target.value as Protection)}>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      <label>执行路径<select value={executed ? 'hit' : 'skip'} onChange={e => configure(protection, initial, e.target.value === 'hit')}><option value="hit">进入两个 goroutine 的共享更新</option><option value="skip">测试绕过共享更新分支</option></select></label>
      <label><input type="checkbox" checked={detector} onChange={e => { setDetector(e.target.checked); configure(); }} />模拟开启 -race</label>
    </div>
    <fieldset disabled={started}><legend>运行前，预测你准备安排的调度</legend><label>最终计数<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option>{[initial, initial + 1, initial + 2].map(n => <option key={n} value={String(n)}>{n}</option>)}</select></label><label>这条路径会产生数据竞争证据吗？<select value={racePrediction} onChange={e => setRacePrediction(e.target.value)}><option value="">请选择</option><option value="yes">会：跨 goroutine 冲突访问缺少同步</option><option value="no">不会：受锁保护或未执行冲突访问</option></select></label><label>调度与理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="例如先让谁读、谁写？锁覆盖了哪一段？" /></label></fieldset>
    <div className="t85-actions"><button data-testing-action="step" disabled={!ready || done} onClick={() => { setStarted(true); if (executed) setState(s => stepRace(s, nextActor(s))); }}>{executed ? '按交错策略单步' : '运行绕过分支'}</button>{(['A', 'B'] as const).map(actor => <button key={actor} disabled={!ready || !canStep(state, actor)} onClick={() => { setStarted(true); setState(s => stepRace(s, actor)); }}>执行 {actor} 下一步</button>)}<button data-testing-action="reset" onClick={() => configure()}>重置本轮</button></div>
    <div className="t85-model" data-testid="live-model" data-state={`${protection}:${initial}:${executed}:${detector}:${started}:${state.phases.A}:${state.phases.B}:${state.value}`}>
      <div className="t85-memory"><strong>共享计数 n = {state.value}</strong><span>完整业务更新期望：{initial + 2}</span><span>锁持有者：{state.owner ?? '无'}</span></div>
      <div className="t85-lanes">{(['A', 'B'] as const).map(actor => <article key={actor}><h4>goroutine {actor}</h4><p>局部值：{state.local[actor] ?? '尚未读取'}</p><strong>{!executed ? '分支未执行' : state.phases[actor] === 2 ? '写回完成' : state.owner && state.owner !== actor ? `等待 ${state.owner} 释放锁` : state.phases[actor] === 0 ? '下一步：读 n' : '下一步：写 局部值 + 1'}</strong></article>)}</div>
      <ol className="t85-timeline">{state.log.map((line, i) => <li key={i}>{line}</li>)}</ol>
      <div aria-live="polite"><p><strong>访问同步证据：</strong>{!started ? '待执行' : evidence ? '已出现无同步的跨 goroutine 冲突访问' : '当前已执行访问中尚无数据竞争证据'}</p><p><strong>检测通道：</strong>{!started ? '待执行' : !detector ? '未开启检测；普通数值测试不会报告 data race' : evidence ? '模型将报告 data race，与最终计数是否正确分开判断' : !executed ? '分支未执行；没有访问可供检测，不能断言分支安全' : '模型当前无 data race 报告'}</p></div>
    </div>
    {done && <div className="t85-feedback" aria-live="polite"><strong>{Number(prediction) === state.value && (racePrediction === 'yes') === evidence ? '两项预测与本轮证据吻合。' : '预测与证据有差异，沿时间线检查每次读取的旧值。'}</strong><p>你的理由：{reason}</p><p>最终计数 {state.value}。{!executed ? '共享更新没有运行，不能用于验证加 2 的业务契约。' : state.value === initial + 2 ? '本轮数值正确；这本身不证明访问安全。' : '两个 goroutine 使用相同旧值写回，覆盖了一次更新。'}</p><p>{protection === 'split' ? '每次访问都使用同一把锁，因此本模型无 data race；但读和写之间解锁，允许两人读到相同旧值，仍会丢更新。' : protection === 'whole' ? '锁从读取一直持有到写回，另一人只能在释放后读取新值；完整业务更新受到保护。' : '即使调度为 A 读写完再 B 读写，墙钟先后也没有建立 goroutine 之间的同步，最终为正确值仍有数据竞争。'}</p><button onClick={() => configure('whole')}>修复：把锁扩大到完整更新，再预测重验</button><p>检测范围只包括已运行路径；模型通过也不能证明真实程序不存在其他并发缺陷。</p></div>}
  </div>;
}
export default function Lab() { return <section className="testing-85" data-testid="testing-lab-85"><h3>计数正确，为什么还可能有 race？</h3><Workbench /></section>; }
function Example() {
  const [serialized, setSerialized] = useState(false);
  const s = runSchedule('none', serialized ? ['A', 'A', 'B', 'B'] : ['A', 'B', 'A', 'B'], 6);
  return <><h4>类比：两个人各往共同账本加 1</h4><p>账本从 6 开始。每个人先抄旧余额，再写回“旧余额 + 1”。</p><div className="t85-actions"><button aria-pressed={!serialized} onClick={() => setSerialized(false)}>两人先抄，再写</button><button aria-pressed={serialized} onClick={() => setSerialized(true)}>甲写完，乙再抄</button></div><div className="t85-model" data-testid="live-model" data-state={String(serialized)}><div className="t85-memory">账本余额：{s.value} / 应得 8</div><ol>{s.log.map((line, i) => <li key={i}>{line}</li>)}</ol><p>两种调度均没有同步保护：数值结果不同，访问安全性结论相同。</p></div><p>类比边界：Go 检测器根据内存访问和同步关系判断，不是根据人工账本最终余额判断。</p></>;
}
function Diagram() {
  const [p, setP] = useState<Protection>('split');
  const s = runSchedule(p, p === 'whole' ? ['A', 'B', 'A', 'B', 'B'] : ['A', 'B', 'A', 'B']);
  return <><h4>锁范围图：把读和写放进同一个保护区</h4><div className="t85-actions">{(['none', 'split', 'whole'] as const).map(mode => <button key={mode} aria-pressed={p === mode} onClick={() => setP(mode)}>{labels[mode]}</button>)}</div><div className="t85-model" data-testid="live-model" data-state={p}><div className="t85-lockmap">{p === 'whole' ? <><span>🔒 A：读 0 → 写 1 → 解锁</span><span>↓ 解锁与后续加锁建立同步</span><span>🔒 B：读 1 → 写 2 → 解锁</span></> : <><span>{p === 'split' ? '🔒 读 → 解锁' : '读'}：A = 0，B = 0</span><span>↓ 两份旧值仍是 0</span><span>{p === 'split' ? '🔒 写 → 解锁' : '写'}：A 写 1，B 写 1</span></>}</div><p>最终 {s.value}；数据竞争证据：{raceEvidence(s) ? '有' : '无'}；业务加 2：{s.value === 2 ? '满足' : '不满足'}。</p></div><p>每段使用同一把互斥锁。拆锁能保护单次访问，但不能把整个业务操作变成不可分割的一段。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const schedule = ['A', 'B', 'A', 'B'] as const;
  const s = runSchedule('split', schedule.slice(0, step));
  return <><h4>逐步诊断：为什么上了锁还丢更新？</h4><p>固定“读和写分别加锁”。每次推进都执行一条访问，观察临时变量与共享值。</p><div className="t85-model" data-testid="live-model" data-state={String(step)}><p>A 临时值 {s.local.A ?? '未读'}；B 临时值 {s.local.B ?? '未读'}；共享 n = {s.value}</p><ol>{s.log.map((line, i) => <li key={i}>{line}</li>)}</ol><p>{step === 4 ? '诊断：每次内存访问都受锁保护，但两份旧值都为 0。修复对象是整个读改写事务的锁范围。' : '关注：释放读操作的锁，并不会更新已经抄到局部变量的值。'}</p></div><div className="t85-actions"><button data-testing-action="step" disabled={step === 4} onClick={() => setStep(step + 1)}>执行第 {Math.min(step + 1, 4)} 步</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button data-testing-action="reset" onClick={() => setStep(0)}>重置诊断</button></div></>;
}
export function Help({ mode }: { mode: string }) { return <section className="testing-85" data-testid="testing-help-85">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Workbench transfer />}</section>; }
