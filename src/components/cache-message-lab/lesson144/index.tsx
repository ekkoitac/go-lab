import { useState } from 'react';
import { defaults, initial, leaseSnapshot, readers, snapshot, transition, type Config } from './model';
import './style.css';

function Controls({ config, change }: { config: Config; change: (patch: Partial<Config>) => void }) {
  return <div className="cm144-controls">
    <label>实例数量<select value={config.instances} onChange={e => change({ instances: Number(e.target.value) })}><option value={1}>1 个实例</option><option value={2}>2 个实例</option><option value={20}>20 个实例</option></select></label>
    <label>每实例的 Group<select value={config.groups} onChange={e => change({ groups: Number(e.target.value) })}><option value={1}>共用 1 个 Group</option><option value={2}>拆成 2 个 Group</option></select></label>
    <label>每 Group 的 key<select value={config.keys} onChange={e => change({ keys: Number(e.target.value) })}><option value={1}>只有商品 A</option><option value={2}>商品 A 和 B</option></select></label>
    <label>同组合的 3 次调用<select value={config.overlap ? 'overlap' : 'serial'} onChange={e => change({ overlap: e.target.value === 'overlap' })}><option value="overlap">执行期间重叠到达</option><option value="serial">前次完成后再到达</option></select></label>
    <label className="cm144-check"><input type="checkbox" checked={config.cache} onChange={e => change({ cache: e.target.checked })} />首波完成后写共享缓存</label>
  </div>;
}
function Topology({ config, phase, selected, select }: { config: Config; phase: number; selected: number; select: (instance: number) => void }) {
  const s = snapshot(config, phase);
  return <div className="cm144-topology">
    <div className="cm144-instances" aria-label="实例拓扑，选择实例查看内部调用">{Array.from({ length: config.instances }, (_, i) => <button key={i} aria-pressed={selected === i} onClick={() => select(i)} className={s.running ? 'working' : phase >= 2 ? 'returned' : ''}><strong>实例 {i + 1}</strong><span>{phase === 0 ? '等待调用' : phase === 3 && config.cache ? '缓存命中' : s.running ? '正在回源' : '本波返回'}</span></button>)}</div>
    <section className="cm144-detail"><h4>放大实例 {selected + 1} · Group 是实例里的对象</h4><div className="cm144-groups">{Array.from({ length: config.groups }, (_, group) => <div className="cm144-group" key={group}><b>Group {group + 1}</b>{Array.from({ length: config.keys }, (_, key) => <div className="cm144-key" key={key}><span>商品 {key ? 'B' : 'A'}</span><div className="cm144-callers">{Array.from({ length: readers }, (_, call) => <span key={call} className={s.running ? call === 0 ? 'leader' : config.overlap ? 'waiter' : '' : phase ? 'done' : ''}>{phase === 0 ? `调用 ${call + 1}` : phase === 3 && config.cache ? '命中' : s.running ? call === 0 ? '执行 fn' : config.overlap ? '等结果' : '未到达' : '已返回'}</span>)}</div></div>)}</div>)}</div><p className="cm144-link">↓ 每个 Group / key 单独查找进行中的调用 ↓</p><div className="cm144-database">数据库 · 全集群正在执行 <strong>{s.running}</strong> 次</div></section>
  </div>;
}
const stages = ['等待预测', '首波到达', '首波全部完成', '第二波到达', '第二波全部完成'];
export default function Lesson144() {
  const [state, setState] = useState(() => initial());
  const [selected, setSelected] = useState(0);
  const dispatch = (action: Parameters<typeof transition>[1]) => setState(s => transition(s, action));
  const s = snapshot(state.config, state.phase);
  const actual = snapshot(state.config, 4).origin;
  return <section className="cm144" data-testid="cache-message-lab-144">
    <header><span className="cm144-eyebrow">144 · 合并范围实验室</span><h3>20 个实例，究竟是谁在共享一次调用？</h3><p>改变进程、Group、key 和到达时机，追踪每一次真正执行的 fn。</p></header>
    <Controls config={state.config} change={patch => { dispatch({ type: 'configure', patch }); setSelected(0); }} />
    <p className="cm144-note">每波，每个实例的每个 Group / key 都有 3 次调用。两波之间前一波完全结束；初始缓存为空。开启共享缓存后，第一波全部完成并写入缓存，第二波才到达，且不失效。串行模式在“全部完成”步骤内依次执行余下调用。未模拟错误、取消、Forget、租约、真实延迟或压力。</p>
    <fieldset disabled={state.submitted}><legend>先预测：两波合计执行多少次回源 fn？</legend><label>预测回源次数<input type="number" min={0} step={1} value={state.prediction} onChange={e => dispatch({ type: 'predict', value: e.target.value })} /></label><label>我的依据<textarea value={state.reason} onChange={e => dispatch({ type: 'reason', value: e.target.value })} placeholder="哪些调用能共享？第二波能否复用第一波？" /></label></fieldset>
    <div className="cm144-actions"><button data-cm-action="step" disabled={!/^\d+$/.test(state.prediction) || !state.reason.trim() || state.phase === 4} onClick={() => dispatch({ type: 'step' })}>{state.phase === 0 ? '提交预测并发出首波' : state.phase === 1 ? '完成首波' : state.phase === 2 ? '发出第二波' : state.phase === 3 ? '完成第二波' : '两波已完成'}</button><button data-cm-action="back" disabled={state.phase === 0} onClick={() => dispatch({ type: 'back' })}>回退一步</button><button data-cm-action="reset" onClick={() => { dispatch({ type: 'reset' }); setSelected(0); }}>重置实验</button></div>
    <ol className="cm144-timeline" aria-label="两波调用时间线">{stages.map((stage, i) => <li key={stage} aria-current={state.phase === i ? 'step' : undefined} className={state.phase === i ? 'current' : state.phase > i ? 'passed' : ''}>{i}. {stage}</li>)}</ol>
    <div data-testid="live-model" data-state={JSON.stringify({ ...state, ...s, selectedInstance: selected + 1 })}>
      <div className="cm144-metrics"><span>累计回源<strong>{s.origin}</strong></span><span>等待共享结果<strong>{s.waiting}</strong></span><span>已返回调用<strong>{s.returned}</strong></span><span>共享缓存命中<strong>{s.cacheHits}</strong></span></div>
      <Topology config={state.config} phase={state.phase} selected={selected} select={setSelected} />
    </div>
    <p className="cm144-feedback" aria-live="polite">{state.phase === 4 ? <><strong>{Number(state.prediction) === actual ? '预测吻合。' : '请修正预测。'}</strong> 你预测 {state.prediction} 次，实际 {actual} 次。首波每实例执行 {s.perInstance} 次，乘以 {state.config.instances} 个实例；{state.config.cache ? '第二波由共享缓存直接返回，减少回源的是缓存命中。' : '第一波完成后 singleflight 不保存结果，第二波再次执行相同数量的 fn。'} {state.config.overlap ? '同 Group 同 key 的重叠调用才共享本次结果。' : '即使 Group 与 key 相同，先后到达的调用也不会合并。'}</> : state.phase ? <>{stages[state.phase]}：累计执行 {s.origin} 次，正在执行 {s.running} 次。{state.phase === 2 ? '原先进行中的调用已移除；现在可以发出第二波，检查是否还能合并。' : '点击任意实例，把调用者、Group 和回源路径关联起来。'}</> : '先留下预测与理由。模型从未执行的状态开始；修改任一条件会开启新一轮预测。'}</p>
    <small>回源 fn 计数不代表持久幂等、缓存一致性或 exactly once。本实验与帮助仅作探索，不写入正式得分。</small>
  </section>;
}

export function Help({ mode }: { mode: string }) { return <HelpContent key={mode} mode={mode} />; }
function HelpContent({ mode }: { mode: string }) {
  const [config, setConfig] = useState<Config>({ ...defaults, instances: mode === 'diagram' ? 20 : mode === 'try' ? 2 : 1 });
  const [selected, setSelected] = useState(0);
  const [phase, setPhase] = useState(0);
  const [fencing, setFencing] = useState(false);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const lease = leaseSnapshot(phase, fencing);
  const change = (patch: Partial<Config>) => { setConfig(c => ({ ...c, ...patch })); setChecked(false); setSelected(0); };
  return <section className="cm144 cm144-help" data-testid="cache-message-help-144">
    {mode === 'example' ? <><h3>窗口类比：同一本登记簿才能共享</h3><p>把 Group 想成窗口的“办理中登记簿”，key 是业务名称。登记簿没有历史结果缓存。</p><label className="cm144-check"><input type="checkbox" checked={config.groups === 2} onChange={e => change({ groups: e.target.checked ? 2 : 1 })} />加开另一个独立登记窗口</label><label className="cm144-check"><input type="checkbox" checked={!config.overlap} onChange={e => change({ overlap: !e.target.checked })} />等前人办完再来</label><Topology config={config} phase={1} selected={0} select={() => undefined} /><p className="cm144-feedback">这一波需办理 {snapshot(config, 2).origin} 次。{config.overlap ? '同窗口同业务的 3 人共等一次结果。' : '登记在办完时删除，下一位会重新办理。'} 加开窗口也增加了独立的登记簿。</p></> : mode === 'diagram' ? <><h3>范围地图：选中实例，追踪到数据库</h3><label>地图中的 key<select value={config.keys} onChange={e => change({ keys: Number(e.target.value) })}><option value={1}>商品 A</option><option value={2}>商品 A 和 B</option></select></label><Topology config={config} phase={1} selected={selected} select={setSelected} /><p className="cm144-feedback">当前实例 {selected + 1} 的 {config.keys} 个执行者只是全图的一部分；同名 Group 分别属于各进程。全图共 {snapshot(config, 1).origin} 次回源，其他实例不会等待你选中的实例。</p></> : mode === 'steps' ? <><h3>分步推演：租约过期不等于旧工作停止</h3><p>跨进程协调是另一层机制。A 的读取很慢；租约到期后 B 得到更高令牌并读取新值。比较旧 A 最后返回时的写入。</p><label className="cm144-check"><input type="checkbox" checked={fencing} onChange={e => setFencing(e.target.checked)} />写入端校验 fencing 令牌</label><div className="cm144-lease"><div className={phase === 0 ? 'active' : ''}>A · 令牌 1<br />{phase === 3 ? lease.rejected ? '旧写入被拒绝' : '旧写入成功' : '慢查询尚未结束'}</div><div className={phase > 0 ? 'active' : ''}>B · 令牌 2<br />{phase === 0 ? '未获得租约' : phase === 1 ? '已获得新租约' : '新值已写入'}</div><div className="cm144-database">存储值：<strong>{lease.value}</strong><br />已启动查询 {lease.queries} 次</div></div><p className="cm144-feedback" aria-live="polite">{['A 取得租约并开始查询，尚未写入。', '租约到期，B 取得令牌 2；A 的工作仍在运行。', 'B 先写入新值，存储端已见过令牌 2。', fencing ? 'A 携带令牌 1 晚到，存储端拒绝过期写入；两次查询仍然已发生。' : 'A 携带令牌 1 晚到，没有写入校验，旧值覆盖 B 的新值。'][phase]}</p><div className="cm144-actions"><button data-cm-action="step" disabled={phase === 3} onClick={() => setPhase(p => p + 1)}>推进租约事件</button><button data-cm-action="back" disabled={!phase} onClick={() => setPhase(p => p - 1)}>回退一步</button><button data-cm-action="reset" onClick={() => { setPhase(0); setFencing(false); }}>重置推演</button></div><small>示意模型假定令牌单调且写入端强制校验。fencing 防旧写覆盖，不能撤销已发出的查询，也不承诺 exactly once。</small></> : <><h3>小挑战：两个实例，首波最多回源 2 次</h3><p>每实例共用 1 个 Group，商品 A 的 3 次调用已固定。用到达时机找到满足预算的方案；预测两波总次数后验证。</p><label>安排调用<select value={config.overlap ? 'overlap' : 'serial'} onChange={e => change({ overlap: e.target.value === 'overlap' })}><option value="overlap">让 3 次调用重叠</option><option value="serial">每次完成后再来</option></select></label><label className="cm144-check"><input type="checkbox" checked={config.cache} onChange={e => change({ cache: e.target.checked })} />首波完成后填充共享缓存</label><label>预测两波回源次数<input type="number" min={0} value={prediction} onChange={e => { setPrediction(e.target.value); setChecked(false); }} /></label><label>为什么能满足首波预算？<textarea value={reason} onChange={e => { setReason(e.target.value); setChecked(false); }} /></label><button disabled={!/^\d+$/.test(prediction) || !reason.trim()} onClick={() => setChecked(true)}>验证我的方案</button>{checked && <><Topology config={{ ...config, instances: 2 }} phase={1} selected={selected} select={setSelected} /><p className="cm144-feedback">首波 {snapshot({ ...config, instances: 2 }, 2).origin} 次，{config.overlap ? '满足' : '超出'}预算；两波 {snapshot({ ...config, instances: 2 }, 4).origin} 次。你的预测{Number(prediction) === snapshot({ ...config, instances: 2 }, 4).origin ? '吻合' : '需修正'}。共享缓存仅帮助第二波；请依据两条实例路径解释首波。</p></>}</>}
    <div data-testid="live-model" data-state={JSON.stringify({ mode, config, phase, selectedInstance: selected + 1, lease: mode === 'steps' ? lease : null, checked, prediction, reason })} />
    <small>辅助探索独立保存于当前面板，不计入独立掌握或正式测验。</small>
  </section>;
}
