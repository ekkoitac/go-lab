import { useState } from 'react'
import { defaults, phases, simulate, transferFeedback, writerName, type Config, type Snapshot } from './model'
import './style.css'

function Ledger({ state }: { state: Snapshot }) {
  return <div className="a110-table"><table><caption>实际扣款账本（回退不删除）</caption><thead><tr><th>业务键</th><th>唯一执行者</th><th>金额</th><th>格式</th></tr></thead><tbody>{state.charges.map((r, i) => <tr key={i} className={state.charges.findIndex(c => c.key === r.key) !== i ? 'a110-danger' : ''}><td>{r.key}</td><td>{writerName(r.writer)}</td><td>¥{r.amount}</td><td>{r.format}</td></tr>)}</tbody></table>{!state.charges.length && <p>还没有正式扣款。</p>}</div>
}
function Metrics({ state }: { state: Snapshot }) {
  return <dl className="a110-metrics"><div><dt>真实扣款</dt><dd>{state.charges.length} 次</dd></div><div><dt>重复副作用</dt><dd>{state.duplicates} 次</dd></div><div><dt>旧版读者</dt><dd>{state.oldCanRead ? '可读现存数据' : '无法读取 v2'}</dd></div></dl>
}
export default function Lesson110() {
  const [config, setConfig] = useState<Config>({ ...defaults })
  const [phase, setPhase] = useState(0)
  const [prediction, setPrediction] = useState('')
  const [reason, setReason] = useState('')
  const [saved, setSaved] = useState<{ config: Config; state: Snapshot } | null>(null)
  const s = simulate(config, phase)
  const change = (patch: Partial<Config>) => { setConfig(c => ({ ...c, ...patch })); setPhase(0); setPrediction(''); setReason('') }
  return <section className="arch110" data-testid="architecture-lab-110">
    <h3>迁移计费：切回路由以后，钱和数据还在吗？</h3><p>目标：让 4 笔 ¥100 的账单只扣一次，并保留可验证的回退路径。操控数据格式与幂等边界，观察同一个 B01 重试。</p>
    <fieldset><legend>迁移条件（改变后从第 0 步重跑）</legend><div className="a110-controls">
      <label>计划新版流量<select value={config.rollout} onChange={e => change({ rollout: Number(e.target.value) as Config['rollout'] })}><option value={0}>0% · 保持旧版</option><option value={25}>25% · 仅 B01</option><option value={100}>100% · 全部账单</option></select></label>
      <label>故障时的策略<select value={config.rollback} onChange={e => change({ rollback: e.target.value as Config['rollback'] })}><option value="verified">先验证数据与重试，再回退</option><option value="route">只切回旧版路由</option></select></label>
      <label><input type="checkbox" checked={config.algorithmBug} onChange={e => change({ algorithmBug: e.target.checked })} />新版错误地多算 B01 ¥20</label>
      <label><input type="checkbox" checked={config.compatible} onChange={e => change({ compatible: e.target.checked })} />新版写入保留旧读者可读的 v1 格式</label>
      <label><input type="checkbox" checked={config.sharedAuthority} onChange={e => change({ sharedAuthority: e.target.checked })} />新旧共用有原子去重保证的扣款权威</label>
    </div></fieldset>
    <details><summary>可选：运行前预测与解释</summary><label>最后会扣几次？旧版能继续读吗？<input disabled={phase > 0} value={prediction} onChange={e => setPrediction(e.target.value)} /></label><label>理由<textarea disabled={phase > 0} value={reason} onChange={e => setReason(e.target.value)} /></label></details>
    <div className="a110-actions"><button data-arch-action="back" disabled={phase === 0} onClick={() => setPhase(p => p - 1)}>上一步</button><button data-arch-action="step" disabled={phase === 5} onClick={() => setPhase(p => p + 1)}>下一步</button><button data-arch-action="reset" onClick={() => { setConfig({ ...defaults }); setPhase(0); setPrediction(''); setReason(''); setSaved(null) }}>重置实验</button></div>
    <p aria-live="polite"><strong>{phase} / 5 · {phases[phase]}</strong> · {prediction.trim() ? `已记录预测：${prediction}` : '自由探索，未提交预测'}</p>
    <div data-testid="live-model" data-state={JSON.stringify({ config, ...s })}>
      <div className="a110-flow"><div>4 笔稳定业务键<br /><small>B01 / B02 / B03 / B04</small></div><span>↓</span><div>影子只读计算<br /><strong>真实扣款 0 次</strong></div><span>↓ 对账闸门</span><div className={s.gate === 'blocked' ? 'a110-danger' : ''}>{s.gate === 'pending' ? '尚未比较' : s.gate === 'blocked' ? '有差异 → 禁止新流量' : '本批无差异 → 允许计划流量'}</div><span>↓ 正式请求仅选一个执行者</span><div>当前新版路由 {s.route}% · 旧版 {100 - s.route}%</div></div>
      {s.shadow.length > 0 && <div className="a110-table"><table><caption>同输入、同单位：影子金额对账</caption><thead><tr><th>账单</th><th>旧算法</th><th>新算法</th><th>差额</th></tr></thead><tbody>{s.shadow.map(r => <tr key={r.key} className={r.old !== r.next ? 'a110-danger' : ''}><td>{r.key}</td><td>¥{r.old}</td><td>¥{r.next}</td><td>¥{r.next - r.old}</td></tr>)}</tbody></table></div>}
      <Metrics state={s} /><Ledger state={s} /><p className="a110-result" aria-live="polite">回退状态：{s.rollback}</p><ol className="a110-trace">{s.trace.map((line, i) => <li key={i}>{line}</li>)}</ol>
    </div>
    <div className="a110-actions"><button disabled={phase === 0} onClick={() => setSaved({ config: { ...config }, state: s })}>保留当前证据作对照</button><button onClick={() => change({ compatible: true, sharedAuthority: true, rollback: 'verified', algorithmBug: false })}>修复兼容与去重后重跑</button></div>
    {saved && <aside className="a110-saved"><h4>保留的第 {saved.state.phase} 步证据</h4><p>{saved.config.compatible ? '兼容格式' : 'v2 格式'} · {saved.config.sharedAuthority ? '共同扣款权威' : '独立幂等表'} · {saved.config.rollback === 'verified' ? '验证后回退' : '只切路由'} · 新版计划 {saved.config.rollout}% · {saved.config.algorithmBug ? '算法有差异' : '算法一致'}</p><Metrics state={saved.state} /><p>{saved.state.rollback}。修改条件不会覆盖此证据；教学重跑不代表生产退款。</p></aside>}
    <p className="a110-note">教学模型：固定 4 笔输入，分组桶为 10 / 35 / 60 / 85，计费金额差异阈值为 0，未测量生产性能。影子仅计算；正式流量每笔只交给一个版本。共同权威假设对业务键的检查、记录和扣款有原子保证；两个独立幂等表不会自动互通。演示回退前已停止放量，省略在途请求排空；真实迁移还需验证排空、数据转换、监控与外部支付对账。回退不会撤回扣款，恢复旧快照也不能代替对账和补偿。</p>
  </section>
}
function Example() {
  const [bug, setBug] = useState(true)
  const s = simulate({ ...defaults, algorithmBug: bug }, 3)
  return <><h4>例子：优惠券规则差了 ¥20</h4><p>B01 旧版计算 ¥100，新版漏优惠。只有通过金额对账的版本才会接收正式请求。</p><button onClick={() => setBug(v => !v)}>{bug ? '修复新版优惠规则' : '注入漏优惠错误'}</button><div className="a110-flow"><div>影子 B01：旧 ¥100 / 新 ¥{bug ? 120 : 100}</div><span>↓</span><div>{s.gate === 'blocked' ? '禁止放量 → B01 仍由旧版扣款' : '允许 25% → B01 由新版扣款'}</div></div><Ledger state={s} /><p aria-live="polite">影子没有任何扣款权限。修复改变了正式执行者；本批仍只发生 4 次扣款。</p></>
}
function Diagram() {
  const [shared, setShared] = useState(false)
  const [run, setRun] = useState(false)
  const s = simulate({ ...defaults, sharedAuthority: shared, rollback: 'route' }, run ? 5 : 0)
  return <><h4>关系图：同一个业务键在哪里被认出来？</h4><p>B01 先由新版成功扣款，再切回旧版重试。改变幂等记录的连接关系，然后送入重试。</p><label><input type="checkbox" checked={shared} onChange={e => { setShared(e.target.checked); setRun(false) }} />两版接入共同扣款权威</label><div className="a110-flow"><div>新版 B01 → {shared ? '共同权威：B01' : '新版表：B01'}</div><span>{shared ? '↓ 同一记录可被旧版识别' : '✕ 独立表不互通'}</span><div>旧版 B01 → {shared ? '共同权威：B01' : '旧版表：空'}</div></div><button onClick={() => setRun(true)}>执行跨版本重试</button>{run && <p aria-live="polite">B01 共扣 {s.charges.filter(c => c.key === 'B01').length} 次。{shared ? '旧版命中既有业务记录，返回原结果。' : '旧版自己的表没有 B01，再次发起扣款；每个版本内部去重仍然不够。'}</p>}</>
}
function Steps() {
  const [step, setStep] = useState(0)
  const [compatible, setCompatible] = useState(false)
  const s = simulate({ ...defaults, compatible }, 5)
  return <><h4>分步演练：先证明旧版还能接手</h4><ol className="a110-steps"><li>保全新账本与支付结果，不恢复过期快照。</li>{step >= 1 && <li>用旧读者读取新版样本：<strong>{compatible ? 'v1 兼容样本通过' : 'v2 样本读取失败'}</strong>。</li>}{step >= 2 && <li>用已扣的 B01 重试：共同权威可以识别既有记录。</li>}{step >= 3 && <li>决策：{s.rollback}；现有 {s.charges.length} 次扣款保留。</li>}</ol>{step >= 1 && <label><input type="checkbox" checked={compatible} onChange={e => setCompatible(e.target.checked)} />改为保留旧字段的兼容写入样本，重新检查</label>}<div className="a110-actions"><button disabled={step === 0} onClick={() => setStep(v => v - 1)}>回看证据</button><button disabled={step === 3} onClick={() => setStep(v => v + 1)}>检查下一项</button><button onClick={() => { setStep(0); setCompatible(false) }}>重新演练</button></div><p>这是迁移前的样本演练：勾选仅改变试验样本，不会自动修复生产里已经写入的 v2 数据。</p></>
}
function Transfer() {
  const [choice, setChoice] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [reason, setReason] = useState('')
  const feedback = transferFeedback(choice)
  return <><h4>迁移练习：订阅续费事故</h4><p>新版已成功续费并写入旧版不能解析的 v2 记录；两版各有独立幂等表。新版随后故障，同一续费请求正在重试。你先做什么？</p><fieldset disabled={submitted}><legend>先选择方案再查看反馈</legend>{[['route', '立即切回旧版，重试续费'], ['restore', '恢复上线前数据库快照，再切回旧版'], ['repair', '停止放量并对账，验证数据兼容与跨版本去重后决策']].map(([value, label]) => <label key={value}><input type="radio" name="a110-transfer" checked={choice === value} onChange={() => setChoice(value)} />{label}</label>)}<label>解释为什么<input value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="a110-actions"><button disabled={!choice || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交判断</button><button onClick={() => { setChoice(''); setReason(''); setSubmitted(false) }}>重新作答</button></div>{submitted && <p aria-live="polite" className="a110-result">{feedback.correct ? '判断符合约束。' : '还有遗漏。'}{feedback.text}</p>}</>
}
export function Help({ mode }: { mode: string }) {
  return <section className="arch110 a110-help" data-testid="architecture-help-110">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="a110-note">本区为辅助理解与局部练习，不计入独立掌握记录。</p></section>
}
