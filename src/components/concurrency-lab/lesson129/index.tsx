import { useState } from 'react';
import { at, eventLabels, outcome, schedule, versions, type Config, type Outcome, type Strategy, type Timing } from './model';
import './style.css';
const names: Record<Strategy, string> = { fields: '每字段独立 atomic', reload: '快照：每字段重新 Load', once: '快照：只 Load 一次' };
const outcomes: Record<Outcome, string> = { old: '完整旧版', new: '完整新版', mixed: '混合版本' };
const defaultConfig: Config = { strategy: 'fields', timing: 'between', variant: 0 };
export default function Lab() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [cursor, setCursor] = useState(0);
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const state = at(config, cursor);
  const result = outcome(state);
  const events = schedule(config);
  const [old, next] = versions(config.variant);
  const update = (patch: Partial<Config>) => { setConfig(c => ({ ...c, ...patch })); setCursor(0); setPrediction(''); };
  return <section className="pair129" data-testid="concurrency-lab-129">
    <h3>调度两次读取，检查版本是否一致</h3>
    <p>目标：让 limit 与 burst 来自同一版配置。你可以把更新安排在读取前、中间或后面，再修复读取方式。</p>
    <div className="pair129-controls">
      <label>读取方式<select aria-label="读取方式" value={config.strategy} onChange={e => update({ strategy: e.target.value as Strategy })}>{Object.entries(names).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>更新插入位置<select aria-label="更新插入位置" value={config.timing} onChange={e => update({ timing: e.target.value as Timing })}><option value="before">两次读取之前</option><option value="between">两次读取之间</option><option value="after">两次读取之后</option></select></label>
      <label>输入版本<select aria-label="输入版本" value={config.variant} onChange={e => update({ variant: Number(e.target.value) })}><option value={0}>配置 A：10/20 → 30/40</option><option value={1}>迁移输入 B：2/4 → 9/18</option></select></label>
    </div>
    <p className="pair129-task">先预测，再执行。修复挑战：保持更新发生在两次读取之间，选择能守住完整版本的读取方式。</p>
    <label className="pair129-predict">预测读到的配置<select aria-label="预测读到的配置" value={prediction} disabled={cursor > 0} onChange={e => setPrediction(e.target.value as Outcome | '')}><option value="">请选择预测</option>{Object.entries(outcomes).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <div className="pair129-buttons"><button data-concurrency-action="step" disabled={!prediction || cursor >= events.length} onClick={() => setCursor(c => c + 1)}>执行下一步</button><button data-concurrency-action="back" disabled={cursor === 0} onClick={() => setCursor(c => c - 1)}>回退一步</button><button data-concurrency-action="reset" onClick={() => { setCursor(0); setPrediction(''); }}>重置实验</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({ config, state })}>
      <ol className="pair129-timeline" aria-label="确定的调度顺序">{events.map((event, i) => <li key={event} data-active={i === cursor - 1} data-done={i < cursor}><span>{i + 1}</span> {eventLabels[event]}{i === cursor - 1 ? ' ← 刚执行' : ''}</li>)}</ol>
      <div className="pair129-board">
        <article><h4>写者 / 共享状态</h4><p>V1：limit {old.limit} · burst {old.burst}</p><p>V2：limit {next.limit} · burst {next.burst}</p>{config.strategy === 'fields' ? <p className="pair129-number">当前字段：{state.limit.value} / {state.burst.value}<small>版本：V{state.limit.version} / V{state.burst.version}</small></p> : <p className="pair129-number">发布指针 → V{state.published}<small>V1、V2 都保持不可变</small></p>}</article>
        <article><h4>读者 / 已收集值</h4><p className="pair129-number">{state.readLimit?.value ?? '—'} / {state.readBurst?.value ?? '—'}<small>limit：{state.readLimit ? `V${state.readLimit.version}` : '未读'} · burst：{state.readBurst ? `V${state.readBurst.version}` : '未读'}</small></p><p>{config.strategy === 'once' ? `保留的快照：${state.held ? `V${state.held}` : '尚未 Load'}` : '两次读取各自选择当时可见的值'}</p></article>
      </div>
      <p className="pair129-status" aria-live="polite">{state.log.at(-1) ?? '尚未执行。原子操作使单次访问安全；整体一致性需要观察两次读取。'}</p>
      {result && <div className="pair129-feedback" role="status"><strong>{prediction === result ? '预测符合本次轨迹' : `预测为${outcomes[prediction as Outcome]}，实际为${outcomes[result]}`}：{state.readLimit!.value} / {state.readBurst!.value}</strong><p>{result === 'mixed' ? '证据：两次读取来自不同版本。保持交错位置不变，改成“快照：只 Load 一次”并重新预测。每字段重新 Load 仍会跨版本。' : '本次读取来自同一版本。将更新放在两次读取之间再检验：读前或读后的成功样例，不能证明所有交错都安全。'}</p><p>所有访问都使用原子操作；没有数据竞争，仍可能违反“同版本”业务约束。完成后换输入 B 再做一次预测。</p></div>}
    </div>
    <p className="pair129-note">确定顺序的教学模型，不模拟真实耗时或概率。快照发布前需构建完整，发布后包括嵌套引用都不可变；同一把锁覆盖完整读写也能实现一致性。本练习不记录独立掌握成绩。</p>
  </section>;
}
function Example() {
  const [strategy, setStrategy] = useState<Strategy>('reload');
  const config: Config = { strategy, timing: 'between', variant: 0 };
  const state = at(config, schedule(config).length);
  return <><h4>同一份配置，两种取法</h4><p>这是已经揭晓的辅助示例：在读 limit 与读 burst 之间发布新版。</p><div className="pair129-buttons">{(['reload', 'once'] as Strategy[]).map(s => <button key={s} aria-pressed={s === strategy} onClick={() => setStrategy(s)}>{names[s]}</button>)}</div><pre>{strategy === 'once' ? 's := state.Load()\na := s.Limit\n// 写者发布 V2\nb := s.Burst' : 'a := state.Load().Limit\n// 写者发布 V2\nb := state.Load().Burst'}</pre><p className="pair129-feedback">读取 {state.readLimit?.value} / {state.readBurst?.value}；{outcomes[outcome(state)!]}。{strategy === 'once' ? '第二字段沿用 s，发布不会修改 s。' : '两次 Load 各自安全，但返回不同对象。'}</p></>;
}
function Diagram() {
  const [published, setPublished] = useState(false);
  const [reader, setReader] = useState<1 | 2>(1);
  return <><h4>追踪读者持有的对象</h4><p>操作发布指针，再决定读者是否重新 Load。卡片中的值不随指针移动而改变。</p><div className="pair129-buttons"><button onClick={() => setPublished(true)} disabled={published}>写者发布 V2</button><button onClick={() => setReader(published ? 2 : 1)}>读者重新 Load</button><button onClick={() => { setPublished(false); setReader(1); }}>恢复 V1</button></div><div className="pair129-board"><article><h4>V1 对象</h4><p>limit 10 · burst 20</p><p>{!published ? '发布指针 → V1' : '发布指针已移走'}</p><strong>{reader === 1 ? '读者引用 → V1' : '读者已移走'}</strong></article><article><h4>V2 对象</h4><p>limit 30 · burst 40</p><p>{published ? '发布指针 → V2' : '尚未发布'}</p><strong>{reader === 2 ? '读者引用 → V2' : '读者未引用'}</strong></article></div><p>连线文字表示“引用哪个对象”，不表示复制字段。只 Load 一次的读者会持续读取所持对象。</p></>;
}
function Steps() {
  const [count, setCount] = useState(0);
  const steps = ['先写出不变量：一次业务读取的两个字段必须来自同一版本。', '找到同步单位：独立 atomic 只覆盖单字段，无法覆盖两次读取。', '修复读法：只 Load 一次并保留对象；或同一锁覆盖整组读写。', '检验约束：发布后对象及嵌套引用不再修改；安排更新穿过两次读取。'];
  return <><h4>逐项诊断整体一致性</h4><p>辅助检查单：每次展开一个推理步骤。</p><ol>{steps.slice(0, count + 1).map(s => <li key={s}>{s}</li>)}</ol><div className="pair129-buttons"><button disabled={count === 3} onClick={() => setCount(c => c + 1)}>下一条诊断</button><button disabled={!count} onClick={() => setCount(c => c - 1)}>回看上一条</button></div><p>race detector 的结果只帮助排查数据竞争；本题还要验证业务不变量。</p></>;
}
function Try() {
  const [timing, setTiming] = useState<Timing>('between');
  const [strategy, setStrategy] = useState<Strategy>('reload');
  const [guess, setGuess] = useState<Outcome | ''>('');
  const [revealed, setRevealed] = useState(false);
  const config: Config = { timing, strategy, variant: 1 };
  const state = at(config, revealed ? schedule(config).length : 0);
  const restart = () => { setGuess(''); setRevealed(false); };
  return <><h4>辅助练习：配额 2/4 → 9/18</h4><p>尝试制造混合版本，再用同一次 Load 修复。使用了帮助的练习不计入独立掌握。</p><div className="pair129-controls"><label>读取策略<select value={strategy} onChange={e => { setStrategy(e.target.value as Strategy); restart(); }}><option value="reload">每字段重新 Load</option><option value="once">只 Load 一次</option></select></label><label>发布位置<select value={timing} onChange={e => { setTiming(e.target.value as Timing); restart(); }}><option value="between">两次读取之间</option><option value="before">读取之前</option><option value="after">读取之后</option></select></label><label>预测版本<select value={guess} disabled={revealed} onChange={e => setGuess(e.target.value as Outcome | '')}><option value="">先选择</option>{Object.entries(outcomes).map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select></label></div><div className="pair129-buttons"><button disabled={!guess || revealed} onClick={() => setRevealed(true)}>检验辅助练习</button><button onClick={restart}>重新预测</button></div>{revealed && <div className="pair129-feedback" role="status">{guess === outcome(state) ? '预测吻合' : '需要修正'}：{state.readLimit?.value} / {state.readBurst?.value}，{outcomes[outcome(state)!]}。<p>{outcome(state) === 'mixed' ? '两次 Load 分别返回 V1 和 V2。切换只 Load 一次，保持发布时间再次检验。' : '两字段来自同一对象版本。试试每字段重新 Load，并把发布放到两次读取之间。'}</p></div>}</>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="pair129" data-testid="concurrency-help-129">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}</section>;
}
