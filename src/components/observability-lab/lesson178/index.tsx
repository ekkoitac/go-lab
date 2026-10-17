import { useState } from 'react';
import { comparison, gateNames, initialConfig, profileFits, profileNames, result, route, type Config, type Gate, type Profile, type Symptom } from './model';
import './style.css';

function Transfer() {
  const [task, setTask] = useState(0); const [choice, setChoice] = useState(''); const [why, setWhy] = useState(''); const [submitted, setSubmitted] = useState(false); const [seen, setSeen] = useState<number[]>([]);
  const tasks = [
    { text: '批处理结束后仍有大量 goroutine 长期等待。诊断入口已在内网，但同网段有其他团队工作负载。选择一个可行的首轮方案。', choices: ['内网无需鉴权，采 CPU 120 秒', '独立管理入口 + 授权审计，先取 goroutine 栈，再关联阻塞证据', '公网默认 mux，采 heap 比较文件大小'], answer: '独立管理入口 + 授权审计，先取 goroutine 栈，再关联阻塞证据', feedback: '长期等待优先看 goroutine 栈；内网仍需授权。栈是线索，要结合阻塞点和生命周期，不能仅凭数量宣称泄漏。' },
    { text: 'v2 的 CPU 热点样本少了 20%，但 v2 的请求量也减半。你只有一次追加采集机会，应怎样做？', choices: ['直接宣布优化 20%', '同环境、同类负载、相同窗口采 CPU，并记录版本与采集时间', '只比较 profile 文件字节数'], answer: '同环境、同类负载、相同窗口采 CPU，并记录版本与采集时间', feedback: '必须控制负载与采样条件；样本数或文件大小变化不能单独证明优化。' },
  ]; const t = tasks[task];
  return <section className="obs178-transfer"><h4>{seen.includes(task) && !submitted ? '解析后复习' : '迁移练习'} · {task + 1}/2</h4><p>{t.text}</p><label>你的方案<select value={choice} disabled={submitted} onChange={e => setChoice(e.target.value)}><option value="">先选择方案</option>{t.choices.map(v => <option key={v}>{v}</option>)}</select></label><label>在揭晓前写下依据<textarea value={why} disabled={submitted} onChange={e => setWhy(e.target.value)} placeholder="指出信号、访问边界或比较条件" /></label><button disabled={!choice || !why.trim() || submitted} onClick={() => { setSubmitted(true); setSeen(ids => ids.includes(task) ? ids : [...ids, task]); }}>{seen.includes(task) ? '提交复习判断' : '提交独立判断'}</button>{submitted && <p role="status">{choice === t.answer ? '方案判断符合条件。' : '需要修正方案。'}{t.feedback}你的理由「{why}」保留供自行核对；本地练习不计入课程掌握进度。</p>}<button onClick={() => { setTask(1 - task); setChoice(''); setWhy(''); setSubmitted(false); }}>{seen.includes(1 - task) ? '换到已揭晓题目复习' : '换一道未揭晓任务'}</button></section>;
}

export default function Lesson178() {
  const [c, setC] = useState<Config>(initialConfig); const [cursor, setCursor] = useState(0); const [prediction, setPrediction] = useState(''); const [why, setWhy] = useState(''); const [locked, setLocked] = useState(false);
  const hops = route(c); const done = cursor >= hops.length; const current = hops[cursor - 1];
  const change = (patch: Partial<Config>) => { setC(v => ({ ...v, ...patch })); setCursor(0); setLocked(false); setPrediction(''); setWhy(''); };
  const reset = () => { setC(initialConfig); setCursor(0); setLocked(false); setPrediction(''); setWhy(''); };
  return <section className="obs178" data-testid="observability-lab-178"><h3>把一次诊断请求送过管理边界</h3><p>预测访问结果，再单步追踪路由 → 授权 → 预算 → 采集。改变入口或权限，会重新开始一轮实验。</p><div className="obs178-controls">
    <label>入口方案<select value={c.gate} onChange={e => change({ gate: e.target.value as Gate })}>{Object.entries(gateNames).map(([v, title]) => <option key={v} value={v}>{title}</option>)}</select></label>
    <label>请求来源<select value={c.origin} onChange={e => change({ origin: e.target.value as Config['origin'] })}><option value="public">公网业务入口</option><option value="internal">内网管理入口</option></select></label>
    <label>诊断身份<select value={String(c.authorized)} onChange={e => change({ authorized: e.target.value === 'true' })}><option value="false">未授权访问者</option><option value="true">有诊断权限的工程师</option></select></label>
    <label>待解释症状<select value={c.symptom} onChange={e => change({ symptom: e.target.value as Symptom })}><option value="cpu">CPU 热点</option><option value="memory">存活对象占内存</option><option value="waiting">goroutine 长期等待</option></select></label>
    <label>采集信号<select value={c.profile} onChange={e => change({ profile: e.target.value as Profile })}>{Object.entries(profileNames).map(([v, title]) => <option key={v} value={v}>{title}</option>)}</select></label>
    <label>CPU 采样时长<select disabled={c.profile !== 'cpu'} value={c.seconds} onChange={e => change({ seconds: Number(e.target.value) })}>{[10, 30, 60].map(v => <option key={v} value={v}>{v} 秒</option>)}</select></label>
    <label>同进程并发采集<select value={c.concurrent} onChange={e => change({ concurrent: Number(e.target.value) })}>{[1, 2, 3].map(v => <option key={v} value={v}>{v} 个</option>)}</select></label>
    <label>采集开销预算<select value={c.budget} onChange={e => change({ budget: Number(e.target.value) })}>{[10, 30, 60].map(v => <option key={v} value={v}>{v} 单位</option>)}</select></label>
    <label>版本对照负载<select value={String(c.sameLoad)} onChange={e => change({ sameLoad: e.target.value === 'true' })}><option value="true">v1、v2 都为 100 请求/秒</option><option value="false">v1 100，v2 50 请求/秒</option></select></label>
  </div><div className="obs178-predict"><label>预测最终请求结果<select value={prediction} disabled={locked} onChange={e => setPrediction(e.target.value)}><option value="">先预测</option><option value="allow">允许采集</option><option value="deny">拒绝请求或采集</option></select></label><label>预测理由<textarea value={why} disabled={locked} onChange={e => setWhy(e.target.value)} placeholder="哪个节点会放行或拦截？采集是否适合症状？" /></label></div>
    <div className="obs178-actions"><button data-obs-action="step" disabled={!prediction || !why.trim() || done} onClick={() => { setLocked(true); setCursor(v => Math.min(v + 1, hops.length)); }}>单步发送 / 继续</button><button data-obs-action="back" disabled={cursor === 0} onClick={() => setCursor(v => Math.max(0, v - 1))}>回退一步</button><button data-obs-action="reset" onClick={reset}>重置实验</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({ config: c, cursor, outcome: current?.outcome ?? 'pending', cost: current?.cost ?? 0, prediction, revealed: done })} className="obs178-model"><ol className="obs178-path">{['入口 / mux', '授权 / 审计', '采集预算', 'Profile 结果'].map((v, i) => <li className={cursor > i ? 'visited' : ''} aria-current={cursor === i + 1 ? 'step' : undefined} key={v}>{v}<span>{cursor > i ? (hops[i]?.outcome === 'deny' ? '拦截' : '已到达') : '待执行'}</span></li>)}</ol><div aria-live="polite" className="obs178-feedback">{current ? <><strong>{current.node}</strong><p>{current.detail}</p><p>实际采集开销：{current.cost} 单位</p></> : <p>请求尚未发送。先提交预测和理由，结果会随请求经过各节点逐步出现。</p>}{done && <><p>{prediction === result(c) ? '访问结果与预测一致。' : '结果与预测不同，请定位拦截或漏检节点。'}你的理由：{why}</p>{result(c) === 'allow' && <><p>{profileFits(c) ? '信号与症状匹配。' : '尝试更换信号，访问成功不等于诊断有效。'}</p><p>{comparison(c)}</p></>}</>}</div></div><p className="obs178-note">教学模型，不发真实网络请求。开销单位为对照用假设值：CPU = 秒数 × 并发，heap = 12 × 并发，goroutine = 6 × 并发。30 秒和快照并发 2 是本实验策略，真实开销、授权实现与容量须在目标环境验证。CPU 同进程采集不能并行。</p></section>;
}

function Diagram() {
  const [origin, setOrigin] = useState<'public' | 'internal'>('public'); const [auth, setAuth] = useState(false);
  const hops = route({ ...initialConfig, gate: 'guarded', origin, authorized: auth });
  return <><h4>两条入口，两道独立边界</h4><div className="obs178-actions"><button aria-pressed={origin === 'public'} onClick={() => setOrigin('public')}>从公网发请求</button><button aria-pressed={origin === 'internal'} onClick={() => setOrigin('internal')}>从管理网发请求</button><button aria-pressed={auth} onClick={() => setAuth(v => !v)}>诊断权限：{auth ? '有' : '无'}</button></div><ol className="obs178-flow">{hops.map(h => <li key={h.node}><strong>{h.node} · {h.outcome === 'deny' ? '拒绝' : '通过'}</strong><p>{h.detail}</p></li>)}</ol><p>点击入口与权限，观察路径在哪一道门停止。管理网络与身份授权各负责一道边界。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0); const steps = ['先明确症状：CPU 在忙、对象仍存活、还是协程在等待？这决定采集信号。', '将诊断从业务 mux 分离，限定管理入口；检查来源与诊断权限，留下审计记录。', '按预算限制 CPU 时长、并发与采集范围，越界时停止采集。', '记录版本、环境、窗口、负载和时间；在同类负载下比较，再检查其他业务代价。'];
  return <><h4>逐步制定采集计划</h4><p>第 {step + 1} 步 / 4</p><p>{steps[step]}</p><div className="obs178-actions"><button disabled={step === 0} onClick={() => setStep(v => v - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(v => v + 1)}>下一步</button></div><p>带提示的计划练习；独立迁移在「让我试试」中单独完成。</p></>;
}
export function Help({ mode }: { mode: string }) {
  const [sample, setSample] = useState<'cpu' | 'memory' | 'waiting'>('cpu');
  return <section className="obs178" data-testid="observability-help-178">{mode === 'try' ? <Transfer /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <><h4>像做体检一样选择诊断工具</h4><label>观察到的症状<select value={sample} onChange={e => setSample(e.target.value as Symptom)}><option value="cpu">机器很忙</option><option value="memory">存活对象占用增长</option><option value="waiting">任务一直等</option></select></label><div className="obs178-feedback">{sample === 'cpu' ? <p>CPU profile 像记录「时间花在哪里」：采样窗口内哪些函数消耗 CPU。它不能完整解释睡眠或等待。</p> : sample === 'memory' ? <p>Heap 像拍一张「仍占着仓库的物品」快照：选择 inuse 视图观察存活对象。需要分配累计信息时要看 alloc 视图，并记录 GC 等采集条件。</p> : <p>Goroutine 栈像查看「每个人正停在哪道工序」：找到等待点，再与负载和生命周期结合判断；仅有数量不能证明泄漏。</p>}</div><p>诊断室仍要有门禁、预约限额和登记。把诊断室移到内楼，不会自动识别谁有权限。</p></>}</section>;
}
