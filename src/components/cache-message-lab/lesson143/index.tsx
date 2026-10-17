import { useState } from 'react';
import { capacity, defaults, expiry, initial, peak, simulate, times, transition, type Config, type Window } from './model';
import './style.css';

function Toggles({ config, onChange }: { config: Config; onChange: (patch: Partial<Config>) => void }) {
  return <div className="cm143-controls">
    <label>流量形状<select value={config.hot ? 'hot' : 'many'} onChange={e => onChange({ hot: e.target.value === 'hot' })}><option value="many">12 个 key，各 1 个请求</option><option value="hot">1 个热 key，12 个请求</option></select></label>
    <label><input type="checkbox" checked={config.jitter} onChange={e => onChange({ jitter: e.target.checked })} />按 key 抖动 TTL</label>
    <label><input type="checkbox" checked={config.merge} onChange={e => onChange({ merge: e.target.checked })} />同 key 请求合并</label>
    <label><input type="checkbox" checked={config.gate} onChange={e => onChange({ gate: e.target.checked })} />限制回源并发</label>
    {config.jitter && <label>允许的过期范围<select value={config.spread} onChange={e => onChange({ spread: Number(e.target.value) })}><option value={60}>300–360 秒</option><option value={20}>300–320 秒</option><option value={0}>只能在 300 秒失效</option></select></label>}
    {config.gate && <label>回源名额：{config.budget}<input aria-label="回源名额" type="range" min={1} max={8} value={config.budget} onChange={e => onChange({ budget: Number(e.target.value) })} /></label>}
  </div>;
}
function Buckets({ config, cursor }: { config: Config; cursor: number }) {
  const keys = expiry(config);
  return <div className="cm143-buckets" aria-label="按过期时刻分组的 key">
    {times.map((time, i) => <div key={time} className={cursor === i ? 'current' : ''}><strong>{time}s</strong><div>{keys.filter(key => key.time === time).map(key => <span key={key.key} title={`${key.key}，${key.readers} 个请求`} className={cursor >= i ? 'expired' : ''}>{key.key.replace('key-', 'K')}</span>)}</div><small>{keys.filter(key => key.time === time).length} 个 key</small></div>)}
  </div>;
}
function Result({ title, window }: { title: string; window?: Window }) {
  return <section className="cm143-result"><h4>{title}</h4>{window ? <>
    <div className="cm143-chain"><span>请求 <b>{window.requests}</b></span><i>→</i><span>待回源 <b>{window.queries}</b></span><i>→</i><span>入库 <b>{window.admitted}</b></span></div>
    <div className="cm143-db" aria-label={`数据库入库 ${window.admitted}，安全容量 ${capacity}`}>{Array.from({ length: Math.max(capacity, window.admitted) }, (_, i) => <span key={i} className={i >= capacity ? 'over' : i < window.admitted ? 'busy' : ''}>{i >= capacity ? '超' : i < window.admitted ? '查' : '空'}</span>)}</div>
    <p>合并等待 {window.merged} · 准入拒绝 {window.rejected} · 超容量查询 {window.overloaded}</p>
    <small>安全槽位内完成 {window.completed} 次查询；超过 4 的查询在本模型记为过载。</small>
  </> : <p>先记录预测与理由，再运行查看数据库状态。</p>}</section>;
}
export default function Lesson143() {
  const [state, setState] = useState(() => initial());
  const dispatch = (action: Parameters<typeof transition>[1]) => setState(s => transition(s, action));
  const actual = simulate(state.config), baselineConfig = { ...state.config, jitter: false, merge: false, gate: false }, baseline = simulate(baselineConfig);
  const complete = state.cursor === times.length - 1;
  return <section className="cm143" data-testid="cache-message-lab-143">
    <header><span className="cm143-eyebrow">143 · 缓存过期调度台</span><h3>过期可以错开，回源也要有边界</h3><p>先用 12 个请求缩小观察：多 key 雪崩和单 key 击穿，分别由谁解决？</p></header>
    <Toggles config={state.config} onChange={patch => dispatch({ type: 'configure', patch })} />
    <p className="cm143-note">修改条件会开启新实验。每个 key 在过期瞬间收到一批并发请求；查询在下一时间窗前结束。容量固定为 4；开启准入后，超名额查询直接拒绝。无队列、重试或预刷新。数字是教学模型，不是百万 key 压测，也不验证缓存一致性。</p>
    <h4>预热后的过期计划 · {state.cursor < 0 ? '尚未运行' : `当前 ${times[state.cursor]} 秒`}</h4>
    <Buckets config={state.config} cursor={state.cursor} />
    <fieldset disabled={state.submitted}><legend>先预测完整观察区间：数据库会出现超容量吗？</legend><label><input type="radio" name="cm143-prediction" checked={state.prediction === 'safe'} onChange={() => dispatch({ type: 'predict', value: 'safe' })} />不会超过 4</label><label><input type="radio" name="cm143-prediction" checked={state.prediction === 'overload'} onChange={() => dispatch({ type: 'predict', value: 'overload' })} />至少一个时刻超过 4</label><label>我的依据<textarea placeholder="从 key 数、同 key 请求数和入库名额解释……" value={state.reason} onChange={e => dispatch({ type: 'reason', value: e.target.value })} /></label></fieldset>
    <div className="cm143-actions"><button data-cm-action="step" disabled={!state.prediction || !state.reason.trim() || complete} onClick={() => dispatch({ type: 'step' })}>{state.cursor < 0 ? '验证：走到 300 秒' : '前进 10 秒'}</button><button data-cm-action="back" disabled={state.cursor < 0} onClick={() => dispatch({ type: 'back' })}>回退一步</button><button data-cm-action="reset" onClick={() => dispatch({ type: 'reset' })}>重新预测</button><button onClick={() => setState(initial())}>恢复初始条件</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({ ...state, current: actual[state.cursor] ?? null })} className="cm143-comparison"><Result title="对照 · 相同流量，固定 TTL，无保护" window={baseline[state.cursor]} /><Result title="实验 · 你配置的保护" window={actual[state.cursor]} /></div>
    <div className="cm143-feedback" aria-live="polite">{complete ? <><strong>{(peak(state.config) <= capacity) === (state.prediction === 'safe') ? '预测与本轮结果一致。' : '预测需要修正。'}</strong> 入库峰值 {peak(state.config)}，对照为 {peak(baselineConfig)}。{state.config.hot ? '同一个 key 只有一个过期时刻；抖动只是移动整批请求。合并才会把 12 次查询变为 1 次。' : '不同 key 的过期时刻可以分散；范围缩小时仍可能集中。'} {actual.some(w => w.rejected > 0) ? '本轮存在准入拒绝；未进入数据库的查询不能计为请求成功。' : '再缩小过期范围或提高并发名额，试着找到结论失效的条件。'}</> : state.cursor >= 0 ? `当前 ${times[state.cursor]} 秒：${actual[state.cursor].keys.length} 个 key 过期，${actual[state.cursor].requests} 个请求产生 ${actual[state.cursor].queries} 次候选查询。请继续到 360 秒再判断整轮预测。` : '尝试边界：只开抖动，再切换到单个热 key。你的原判断还成立吗？'}</div>
    <small>本实验与帮助只记录局部探索，不写入课程得分或独立掌握记录。</small>
  </section>;
}

export function Help({ mode }: { mode: string }) { return <HelpContent key={mode} mode={mode} />; }
function HelpContent({ mode }: { mode: string }) {
  const [hot, setHot] = useState(false);
  const [config, setConfig] = useState<Config>({ ...defaults, jitter: true, hot: mode === 'try' });
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const rows = simulate(config);
  return <section className="cm143 cm143-help" data-testid="cache-message-help-143" data-state={JSON.stringify({ mode, config, hot, step, checked })}>
    {mode === 'example' ? <><h3>取餐牌：分批到期，还是同一桌？</h3><p>把 key 看成餐桌，查询看成进厨房取餐。12 桌各来 1 人可以错开；同一桌的 12 人共享一张到期牌。</p><button onClick={() => setHot(v => !v)}>{hot ? '换成 12 桌各来 1 人' : '换成同一桌来 12 人'}</button><Buckets config={{ ...defaults, jitter: true, hot }} cursor={-1} /><p>抖动后最大的同时回源：<strong>{peak({ ...defaults, jitter: true, hot })}</strong>。{hot ? '时间被移动了，人群没有被拆开。让 1 人代表取餐，另外 11 人等结果，就是请求合并。' : '多个 key 分到了不同到期时刻；仍须看每个时刻是否超过厨房容量。'}</p></> :
    mode === 'diagram' ? <><h3>拨动保护开关，追踪流量</h3><p>图中的数字来自实际模型。先看抖动，再尝试单热 key、合并和准入。</p><Toggles config={config} onChange={patch => setConfig(c => ({ ...c, ...patch }))} /><Buckets config={config} cursor={-1} /><div className="cm143-flow"><span>{config.hot ? '一个 key / 12 请求' : '12 个 key / 各 1 请求'}</span><b>↓ 按 key 排过期时间</b><span>{config.jitter ? `300–${300 + config.spread} 秒` : '全部 300 秒'}</span><b>↓ {config.merge ? '同 key 合并' : '各自回源'}</b><span>入库峰值 {peak(config)} / 容量 4</span></div><p>{config.gate ? `准入名额是 ${config.budget}，设置超过容量也可能过载。` : '未限制准入；错开到期无法承诺安全。'}</p></> :
    mode === 'steps' ? <><h3>跟着一个过期窗口走</h3><p>固定条件：12 个 key、TTL 抖动、并发预算 2。每一步对应一个时间窗，队列为空。</p><Buckets config={{ ...defaults, jitter: true, gate: true, budget: 2 }} cursor={step} /><Result title={`${times[step]} 秒的因果链`} window={simulate({ ...defaults, jitter: true, gate: true, budget: 2 })[step]} /><div className="cm143-actions"><button disabled={step === 0} onClick={() => setStep(s => s - 1)}>上一步</button><button disabled={step === 6} onClick={() => setStep(s => s + 1)}>下一步</button><button onClick={() => setStep(0)}>重置步骤</button></div><p>先找这个桶里的 key，再数请求，最后看入库名额。回退可复查刚才是哪项限制生效。</p></> :
    <><h3>修复挑战：安全还要不拒绝</h3><p>目标：在整个区间里，入库峰值 ≤ 4，且没有准入拒绝。先解释方案，再验证。可用单热 key 检查“抖动总够用”的边界。</p><Toggles config={config} onChange={patch => { setConfig(c => ({ ...c, ...patch })); setChecked(false); }} /><label>我的修复依据<textarea value={reason} onChange={e => { setReason(e.target.value); setChecked(false); }} placeholder="哪种操作减少同时回源，为什么？" /></label><button disabled={!reason.trim()} onClick={() => setChecked(true)}>验证修复</button>{checked && <div aria-live="polite"><Buckets config={config} cursor={6} /><p>{peak(config) <= 4 && rows.every(w => !w.rejected) ? '本组输入满足两个目标。' : '尚未满足全部目标。'} 入库峰值 {peak(config)}；累计拒绝 {rows.reduce((n, w) => n + w.rejected, 0)}。{config.hot ? '单 key 的并发请求需要合并；抖动只能整体平移。' : '尝试放宽允许的 TTL 区间；准入拒绝保护了数据库，却损失请求。'}</p></div>}</>}
    <small>所有数字为教学模型。帮助内的操作属于有提示练习，不作为独立掌握证据。</small>
  </section>;
}

