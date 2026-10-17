import {useState} from 'react';
import {metricsFor, moveStage, traceFor, visibleTrace, type RequestKind, type Trace} from './model';
import './style.css';

function Timeline({trace, selected, onSelect}: {trace: Trace; selected: string; onSelect: (id: string) => void}) {
  return <div className="obs173-timeline" aria-label="请求时间线，所有时间为毫秒">
    <p>0 → {trace.duration} ms · 蓝色为执行，条纹为等待 · ◆ 位于关键路径</p>
    {trace.segments.map(s => <button type="button" className={`obs173-span ${s.kind} ${selected === s.id ? 'selected' : ''}`} aria-pressed={selected === s.id} key={s.id} onClick={() => onSelect(s.id)}>
      <span>{s.critical ? '◆ ' : ''}{s.name}：{s.start}–{s.start + s.duration} ms</span>
      <span className="obs173-track"><i style={{marginLeft: `${s.start / trace.duration * 100}%`, width: `${s.duration / trace.duration * 100}%`}} /></span>
    </button>)}
    <p>根 Span：订单 {trace.duration} ms。库存和运费并行；根时长 = 20 + max(库存分支, 120) + 20，不能把所有子 Span 相加。</p>
  </div>;
}
function Transfer({assisted = false}: {assisted?: boolean}) {
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);
  return <fieldset className="obs173-transfer"><legend>{assisted ? '帮助内练习（有提示）' : '独立迁移 · 新的导出请求'}</legend>
    <p>导出 P99 从 200 升到 900 ms。样本 Trace 显示：入口 20 ms → 连接池等待 700 ms → SQL 执行 160 ms → 返回 20 ms。日志有 pool.wait，其他请求未采样。下一步最有证据支持的行动是什么？</p>
    {assisted && <p>提示：先区分等待和执行，再评估样本能支持多大范围的结论。</p>}
    <label>行动<select value={answer} disabled={result !== null} onChange={e => setAnswer(e.target.value)}><option value="">选择一个行动</option><option value="sql">立即重写 SQL，执行必定占大头</option><option value="pool">检查连接池占用和等待指标，扩大样本验证</option><option value="absent">删除未采到 Trace 的请求计数</option></select></label>
    <label>证据与结论边界<textarea value={reason} disabled={result !== null} onChange={e => setReason(e.target.value)} placeholder="指出哪段时间最长，以及样本不能证明什么" /></label>
    <button type="button" disabled={!answer || !reason.trim() || result !== null} onClick={() => setResult(answer === 'pool' ? '行动选择合理：700 ms 等待大于 160 ms 执行。但一个样本不能证明所有慢请求都同因；用池等待指标和更多 Trace 验证。请自行对照理由是否覆盖这两点。' : '重新定位：主要时间花在连接池等待，不是 SQL 执行；未采样不意味着请求不存在。应检查池占用及等待指标，并验证更多样本。')}>提交迁移判断</button>
    {result && <p role="status">{result} 本练习只保留本页作答，不计入课程掌握度。{assisted ? '已使用帮助。' : '首次作答已揭晓；后续重做属于复习。'}</p>}
  </fieldset>;
}
export default function Lesson173() {
  const [retries, setRetries] = useState(2);
  const [request, setRequest] = useState<RequestKind>('slow');
  const [stage, setStage] = useState(0);
  const [selected, setSelected] = useState('inventory-0');
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const metrics = metricsFor(retries);
  const trace = visibleTrace(request, retries);
  const segment = trace?.segments.find(s => s.id === selected);
  const restart = () => {setStage(0); setLocked(false); setPrediction(''); setReason(''); setSelected('inventory-0');};
  return <section className="obs173" data-testid="observability-lab-173">
    <h3>一次慢订单，三种证据</h3>
    <p>目标：从总体异常进入单次路径，再把等待和重试关联到事件原因。教学窗口固定 1,000 个订单，其中 20 个遇到两次库存版本冲突；各次执行 80 ms，重试间隔 120 ms，运费查询并行耗时 120 ms。</p>
    <div className="obs173-controls"><label>最多重试次数<select value={retries} onChange={e => {setRetries(Number(e.target.value)); restart();}}>{[0, 1, 2, 3].map(n => <option key={n} value={n}>{n} 次</option>)}</select></label><label>待查请求<select value={request} onChange={e => {setRequest(e.target.value as RequestKind); setSelected('inventory-0');}}><option value="slow">订单 O-17 · 有 Trace</option><option value="normal">订单 O-18 · 正常样本</option><option value="missing">订单 O-19 · 未采样</option></select></label></div>
    <fieldset><legend>先预测，再打开证据</legend><label>增加重试预算到两次后，慢订单最可能怎样？<select value={prediction} disabled={locked} onChange={e => setPrediction(e.target.value)}><option value="">选择预测</option><option value="tail">尾延迟上升，但冲突可恢复</option><option value="cpu">所有请求 CPU 执行时间同幅上升</option><option value="none">依赖平均耗时正常，所以没有慢订单</option></select></label><label>理由<textarea value={reason} disabled={locked} onChange={e => setReason(e.target.value)} placeholder="重试执行与退避等待分别会增加什么？" /></label><button type="button" disabled={!prediction || !reason.trim() || locked} onClick={() => setLocked(true)}>锁定预测与理由</button></fieldset>
    <div className="obs173-controls"><button type="button" data-obs-action="step" disabled={!locked || stage === 3} onClick={() => setStage(moveStage(stage, 1))}>{['查看聚合指标', '展开请求 Trace', '关联事件日志', '证据已齐'][stage]}</button><button type="button" data-obs-action="back" disabled={stage === 0} onClick={() => setStage(moveStage(stage, -1))}>回退一步</button><button type="button" data-obs-action="reset" onClick={() => {setRetries(2); setRequest('slow'); restart();}}>重置实验</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({stage, retries, request, selected, locked, metrics: stage ? metrics : null, traceAvailable: stage >= 2 ? trace !== null : null})}>
      <p role="status">阶段 {stage}/3：{['先提交预测；尚未揭晓结果。', '指标说明总体有何变化，尚不能定位原因。', '点击 Span 查看时间位置；选中对象将在下一步关联日志。', '日志解释选中 Span 的事件；比较不同请求与重试预算。'][stage]}</p>
      {stage >= 1 && <div className="obs173-card"><h4>指标 · route=/orders，method=POST</h4><div className="obs173-metrics"><span>请求数 <strong>1,000</strong></span><span>平均 <strong>{metrics.mean.toFixed(1)} ms</strong></span><span>P99 <strong>{metrics.p99} ms</strong></span><span>失败 <strong>{metrics.errors}/1,000</strong></span></div><p>对照窗口：全部正常，平均/P99 均为 160 ms，失败 0。当前窗口完整计入所有订单，指标不随 Trace 采样或请求选择变化；订单 ID 仅用于诊断关联，不作为指标标签。</p><p>P99 使用最近秩法：排序后第 ceil(0.99 × 1,000) = 990 个值。默认两次重试时，第 990 个值落在 20 个慢请求中；只有 10 个慢请求时，最近秩 P99 仍可能正常。不要平均各服务 P99。</p></div>}
      {stage >= 2 && <div className="obs173-card"><h4>Trace · {request === 'slow' ? 'O-17 / trace-t17' : request === 'normal' ? 'O-18 / trace-t18' : 'O-19'}</h4>{trace ? <Timeline trace={trace} selected={selected} onSelect={setSelected} /> : <p>本请求未被采样：无 Span 可展开。独立订单计数仍包含它；缺少 Trace 不能证明请求未发生，也不能据此断言没有重试。</p>}</div>}
      {stage >= 3 && <div className="obs173-card"><h4>日志 · 与选中 Span 联动</h4>{trace ? <><p><code>trace_id={request === 'slow' ? 'trace-t17' : 'trace-t18'} · span_id={selected}</code></p><p>{segment?.log ?? '请在时间线选择一个 Span。'}</p><p>结果：{trace.success ? '成功' : '失败'}。{request === 'normal' ? '正常订单没有发生冲突，库存只执行一次；运费分支决定关键路径。' : retries < 2 ? '较少重试缩短观测延迟，却使冲突订单失败；不能仅以延迟下降宣布修复。' : '两次冲突经退避恢复；多配一次重试也不会执行无用尝试。'} 仅保留事件码、尝试次数与受控关联 ID，不记录支付令牌或敏感正文。</p></> : <p>本教学样本没有 O-19 的可关联日志。记录为证据缺失；应回查独立业务记录，不能捏造一个根因。</p>}<p>预测对照：{prediction === 'tail' ? '你的选择抓住了尾延迟与恢复之间的取舍。' : '本模型中只有 20 个冲突请求增加尝试与等待；平均值无法排除尾部异常，等待也不等于 CPU 执行。'} 请对照你提交的理由解释当前预算下的结果。</p></div>}
    </div>
    <details><summary>独立迁移题（使用新请求）</summary><Transfer /></details>
    <p className="obs173-note">边界：这是固定冲突次数与时长的可控模型，不代表真实延迟分布；日志是本模型设定的事件证据，生产中仍需验证因果假设。</p>
  </section>;
}
export function Help({mode}: {mode: string}) {
  const [retries, setRetries] = useState(2);
  const [signal, setSignal] = useState('metrics');
  const [step, setStep] = useState(0);
  const trace = traceFor('slow', retries);
  const steps = ['先看低基数路由指标：P99 变化定位异常窗口，不能给出单次根因。', '找同窗口的慢 Trace：核对根 Span、父子关系与每次库存尝试。', '把执行与等待分开：并行分支取关键路径，不把父子 Span 时长相加。', '用 trace_id + span_id 联动日志：库存冲突 → 退避 → 再尝试；再改变预算验证副作用。'];
  return <section className="obs173" data-testid="observability-help-173"><p className="obs173-note">辅助理解 · 此处操作独立于实验、编辑器和课程进度。</p>
    {mode === 'example' ? <><h3>反事实对照：少重试一定更好吗？</h3><label>重试预算<select value={retries} onChange={e => setRetries(Number(e.target.value))}>{[0, 1, 2, 3].map(n => <option key={n} value={n}>{n} 次</option>)}</select></label><p>同一个遇到两次冲突的订单：{trace.attempts} 次库存尝试，{trace.duration} ms，最终{trace.success ? '成功' : '失败'}。</p><p>固定对照：允许两次重试时 520 ms 且成功。当前方案是否只是更早失败？比较延迟时要同时看成功率。</p><Timeline trace={trace} selected={signal} onSelect={setSignal} /></> : mode === 'diagram' ? <><h3>建立证据链：每个信号能回答什么？</h3><div className="obs173-controls">{[['metrics', '① 指标'], ['trace', '② Trace'], ['logs', '③ 日志']].map(([id, label]) => <button type="button" key={id} aria-pressed={signal === id} onClick={() => setSignal(id)}>{label}</button>)}</div><div className="obs173-card">{signal === 'metrics' ? '全量订单 → route=/orders 的延迟分布 → P99 上升。能发现总体变化；不能标出是哪次重试。' : signal === 'trace' ? '同一 trace_id → 入口 → 库存尝试 / 退避 → 汇合。每个 span_id 定位路径位置；没有采到不等于没有执行。' : 'trace_id + span_id → inventory.conflict → retry.scheduled。日志解释事件原因；单条日志不等于全局比例。'}</div><p>连接顺序：异常窗口 → 请求样本 → Span → 关联事件。订单 ID 不进入聚合指标标签。</p></> : mode === 'steps' ? <><h3>按证据排查</h3><p>步骤 {step + 1}/4：{steps[step]}</p><progress max={4} value={step + 1} aria-label="诊断步骤" /><div className="obs173-controls"><button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button type="button" disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button type="button" onClick={() => setStep(0)}>重新梳理</button></div></> : <><h3>换一个瓶颈检验理解</h3><HelpTry /></>}
  </section>;
}

function HelpTry() {
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  return <fieldset><legend>帮助内练习 · 采样缺失</legend><p>完整路由计数显示 1,000 次请求；只采到 50 条 Trace，其中 10 条包含重试。能否据此宣布整体重试率为 20%？</p><label>判断<select value={answer} disabled={checked} onChange={e => setAnswer(e.target.value)}><option value="">先作判断</option><option value="yes">可以，10 / 50 就是整体重试率</option><option value="no">不能直接宣布，需要采样策略和完整计数口径</option></select></label><label>理由<textarea value={reason} disabled={checked} onChange={e => setReason(e.target.value)} /></label><button type="button" disabled={!answer || !reason.trim() || checked} onClick={() => setChecked(true)}>核对推理</button>{checked && <p role="status">{answer === 'no' ? '判断合理。' : '要区分样本比例与整体比例。'} 若慢请求被优先采样，10 / 50 会偏向慢请求；采样缺失也不能证明其余请求没有重试。应使用独立全量重试计数，或已知抽样设计下带不确定性的估计。本页是辅助练习，不计入独立掌握证据。</p>}</fieldset>;
}
