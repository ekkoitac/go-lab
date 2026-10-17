import { useState } from 'react'
import { defaults, methods, names, phases, simulate, transferFeedback, type Config, type Method, type Snapshot } from './model'
import './style.css'

function Boundary({ state }: { state: Snapshot }) {
  const remote = state.method === 'rpc'
  return <div className="a109-boundary" aria-label={`${names[state.method]}进程关系`}>
    <div className={`a109-process ${state.host === '已退出' ? 'a109-failed' : ''}`}><strong>宿主进程</strong><span>{state.host}</span>{!remote && <div className="a109-extension">扩展：{state.extension}</div>}</div>
    {remote && <><div className="a109-wire">↕ 版本握手 / RPC<br />{state.call}</div><div className={`a109-process ${state.extension.includes('退出') ? 'a109-failed' : ''}`}><strong>扩展进程</strong><span>{state.extension}</span></div></>}
  </div>
}
function Result({ state }: { state: Snapshot }) {
  return <article className="a109-result"><h4>{names[state.method]}</h4><Boundary state={state} /><dl><div><dt>业务调用</dt><dd>{state.call}</dd></div><div><dt>用户文件</dt><dd>{state.file}</dd></div><div><dt>扩展仍驻留</dt><dd>{state.loaded ? '是' : '否'}</dd></div></dl><p className="a109-cause">{state.trace.at(-1) ?? '先调整条件，再单步运行；三种方案使用同一事件。'}</p></article>
}
export default function Lesson109() {
  const [config, setConfig] = useState<Config>({ ...defaults })
  const [phase, setPhase] = useState(0)
  const [prediction, setPrediction] = useState('')
  const [reason, setReason] = useState('')
  const [traceMethod, setTraceMethod] = useState<Method>('rpc')
  const snapshots = methods.map(method => simulate(config, method, phase))
  const change = (patch: Partial<Config>) => { setConfig(current => ({ ...current, ...patch })); setPhase(0) }
  const reset = () => { setConfig({ ...defaults }); setPhase(0); setPrediction(''); setReason(''); setTraceMethod('rpc') }
  return <section className="arch109" data-testid="architecture-lab-109">
    <h3>让同一个扩展故障穿过三种边界</h3><p>目标：区分平台与构建限制、崩溃隔离和权限隔离。单步比较同一条件下宿主、调用和文件访问的变化。</p>
    <fieldset><legend>实验条件（修改后回到第 0 步）</legend><div className="a109-controls">
      <label>目标系统<select value={config.os} onChange={e => change({ os: e.target.value as Config['os'] })}><option value="linux">Linux</option><option value="windows">Windows</option></select></label>
      <label>扩展事件<select value={config.failure} onChange={e => change({ failure: e.target.value as Config['failure'] })}><option value="panic">未恢复 panic</option><option value="timeout">无限阻塞，忽略取消</option><option value="normal">正常返回</option><option value="file">读取用户私有文件</option></select></label>
      <label><input type="checkbox" checked={config.buildMatch} onChange={e => change({ buildMatch: e.target.checked })} />Go plugin 构建兼容</label>
      <label><input type="checkbox" checked={config.protocolMatch} onChange={e => change({ protocolMatch: e.target.checked })} />RPC 双方都支持 v1（取消则扩展仅 v2）</label>
      <label><input type="checkbox" checked={config.restricted} onChange={e => change({ restricted: e.target.checked })} />对子进程另行施加已验证的 OS 文件拒绝策略</label>
    </div></fieldset>
    <details><summary>可选：运行前留下预测与理由</summary><label>预测宿主 / 调用 / 文件的变化<input value={prediction} disabled={phase > 0} onChange={e => setPrediction(e.target.value)} placeholder="例如：子进程退出后，本次调用会怎样？" /></label><label>我的理由<textarea value={reason} disabled={phase > 0} onChange={e => setReason(e.target.value)} /></label></details>
    <div className="a109-actions"><button data-arch-action="back" onClick={() => setPhase(p => Math.max(0, p - 1))} disabled={phase === 0}>上一步</button><button data-arch-action="step" onClick={() => setPhase(p => Math.min(5, p + 1))} disabled={phase === 5}>下一步</button><button data-arch-action="reset" onClick={reset}>重置实验</button></div>
    <p aria-live="polite"><strong>{phase} / 5 · {phases[phase]}</strong> · {prediction.trim() ? '已记录预测，按证据自行核对' : '自由探索，未提交预测'}</p>
    <div data-testid="live-model" data-state={JSON.stringify({ config, phase, snapshots })} className="a109-results">{snapshots.map(s => <Result key={s.method} state={s} />)}</div>
    <div className="a109-trace"><label>因果日志<select value={traceMethod} onChange={e => setTraceMethod(e.target.value as Method)}>{methods.map(m => <option value={m} key={m}>{names[m]}</option>)}</select></label><ol>{simulate(config, traceMethod, phase).trace.map((line, i) => <li key={i}>{line}</li>)}</ol></div>
    <p className="a109-note">模型假设：已备好各目标平台可执行文件；panic 未被 recover；阻塞不响应取消；RPC 宿主能检测退出、执行截止时间并回收子进程。文件实验假设当前用户可读该路径，勾选权限策略只模拟已额外配置的 OS 拒绝。Go plugin 还支持官方列出的其他系统，本实验仅比较 Linux / Windows。模拟不是实测性能，也不证明恶意代码已被完整沙箱隔离。</p>
  </section>
}
function Example() {
  const [fault, setFault] = useState(false)
  const state = simulate({ ...defaults, failure: fault ? 'panic' : 'normal' }, 'rpc', 4)
  return <><h4>例子：文档导出器突然退出</h4><p>编辑器把导出任务交给独立进程。切换故障，比较“文档仍可编辑”与“导出是否成功”这两个不同结果。</p><button onClick={() => setFault(v => !v)}>{fault ? '恢复正常导出' : '注入导出器 panic'}</button><Boundary state={state} /><p aria-live="polite">导出调用：{state.call}。{fault ? '宿主仍运行，但这次导出失败；重新启动导出器不代表旧请求自动完成。' : '收到导出结果后，宿主才把任务标为完成。'}</p></>
}
function Diagram() {
  const [remote, setRemote] = useState(false)
  const [event, setEvent] = useState<'panic' | 'file'>('panic')
  const state = simulate({ ...defaults, failure: event }, remote ? 'rpc' : 'static', 4)
  return <><h4>关系图：边界挡住了什么？</h4><label><input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} />把扩展移到独立进程</label><div className="a109-actions"><button aria-pressed={event === 'panic'} onClick={() => setEvent('panic')}>追踪 panic</button><button aria-pressed={event === 'file'} onClick={() => setEvent('file')}>追踪文件读取</button></div><Boundary state={state} /><div className="a109-file">用户文件 ← 当前用户权限 ← {remote ? '宿主 + 子进程' : '宿主（含扩展）'}</div><p aria-live="polite">{event === 'panic' ? `宿主：${state.host}；调用：${state.call}。${remote ? '跨进程连接断开，失败不会被隐藏。' : '同一进程终止，扩展与宿主共同退出。'}` : `文件访问：${state.file}。本图没有额外 OS 权限策略；移动进程不会撤销用户权限。`}</p></>
}
function Steps() {
  const [step, setStep] = useState(0)
  const state = simulate({ ...defaults, failure: 'timeout' }, 'rpc', step)
  const prompts = ['先确定平台上是否有扩展可执行文件。', '检查通过后，启动扩展进程。', '握手完成前，不能发业务请求。', '契约已就绪，现在发起请求，扩展将忽略取消。', '观察等待状态，再让宿主截止时间到期。', '本次调用超时失败，子进程已回收；后续可重启，但旧调用未成功。']
  return <><h4>一步步：阻塞扩展如何结束</h4><p>{step} / 5 · {prompts[step]}</p><Boundary state={state} /><p aria-live="polite">{state.trace.at(-1) ?? '尚未启动扩展。'}</p><div className="a109-actions"><button disabled={!step} onClick={() => setStep(n => n - 1)}>回看</button><button disabled={step === 5} onClick={() => setStep(n => n + 1)}>推进生命周期</button><button onClick={() => setStep(0)}>从头观察</button></div></>
}
function Transfer() {
  const [method, setMethod] = useState<Method>('plugin')
  const [restricted, setRestricted] = useState(false)
  const [protocol, setProtocol] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [why, setWhy] = useState('')
  const issues = transferFeedback(method, restricted, protocol)
  return <><h4>迁移练习：第三方缩略图服务</h4><p>运行在 Windows，插件独立发布，可能崩溃；宿主必须继续服务，并且扩展不能读取指定私有目录。构建一套满足这些条件的方案，再提交核对。</p><fieldset disabled={submitted}><label>执行方式<select value={method} onChange={e => setMethod(e.target.value as Method)}>{methods.map(m => <option key={m} value={m}>{names[m]}</option>)}</select></label><label><input type="checkbox" checked={restricted} onChange={e => setRestricted(e.target.checked)} />另行配置并验证 OS 文件权限限制</label><label><input type="checkbox" checked={protocol} onChange={e => setProtocol(e.target.checked)} />版本握手，不兼容则拒绝业务调用</label><label>说明故障时宿主和本次请求的区别<textarea value={why} onChange={e => setWhy(e.target.value)} /></label></fieldset><div className="a109-actions"><button disabled={submitted || !why.trim()} onClick={() => setSubmitted(true)}>提交方案</button><button onClick={() => { setSubmitted(false); setWhy('') }}>修改后重试</button></div>{submitted && <div aria-live="polite">{issues.length ? <ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p>配置满足本例条件：扩展崩溃时宿主存活，本次请求仍失败；权限由额外 OS 策略强制，协议由握手验证。还需设计超时、回收和恢复策略。</p>}<p>你的解释：{why}。文字解释供自行对照，未自动判分。</p></div>}</>
}
export function Help({ mode }: { mode: string }) {
  return <section className="arch109 a109-help" data-testid="architecture-help-109">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="a109-note">本区是辅助理解练习，独立于主实验，不计入掌握成绩。</p></section>
}
