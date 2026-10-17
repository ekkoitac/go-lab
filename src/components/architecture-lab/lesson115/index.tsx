import { useState } from 'react';
import { advance, configure, initial, inspect, rewind, stages, type Config, type State, type Wrap } from './model';
import './style.css';
function Chain({ state, selected, select }: { state: State; selected?: number; select?: (n: number) => void }) {
  const view = inspect(state);
  return <div className="a115-chain" aria-label="可解包错误链">{view.nodes.map((node, i) => <div key={i} className={selected === i ? 'a115-selected' : ''}><button disabled={!select} aria-pressed={select ? selected === i : undefined} onClick={() => select?.(i)}><strong>{node.identity ?? node.type ?? (node.kind === 'wrapper' ? '上下文包装' : '普通错误')}</strong><span>{node.text}</span></button>{i < view.nodes.length - 1 ? <p>↓ Unwrap() 返回原因</p> : <p>⊣ 无下一层可解包原因</p>}</div>)}</div>;
}
function Output({ state }: { state: State }) {
  const view = inspect(state);
  return <div className="a115-outputs"><section><h4>公开 HTTP 响应</h4><pre data-testid="error-response">{view.response ? JSON.stringify(view.response, null, 2) : '尚未生成响应'}</pre></section><section><h4>受控内部诊断</h4><pre data-testid="error-diagnostic">{view.diagnostic ? JSON.stringify(view.diagnostic, null, 2) : '尚未记录诊断'}</pre></section></div>;
}
function Actions({ state, change }: { state: State; change: (s: State) => void }) { return <div className="a115-actions"><button data-arch-action="back" disabled={!state.phase} onClick={() => change(rewind(state))}>回退一步</button><button data-arch-action="step" disabled={state.phase === 4} onClick={() => change(advance(state))}>执行下一步</button><button data-arch-action="reset" onClick={() => change(initial(state.config))}>重置本轮</button></div>; }
function Wrapping({ value, change, label }: { value: Wrap; change: (v: Wrap) => void; label: string }) { return <label>{label}<select aria-label={label} value={value} onChange={e => change(e.target.value as Wrap)}><option value="w">%w：保留原因链</option><option value="text">%v：只拼接文本</option><option value="none">不包装</option></select></label>; }
export default function Lesson115() {
  const [state, setState] = useState(() => initial());
  const [prediction, setPrediction] = useState(''); const [reason, setReason] = useState(''); const [captured, setCaptured] = useState<string | null>(null);
  const view = inspect(state);
  function edit(patch: Partial<Config>) { setState(configure(state, patch)); setCaptured(null); }
  function move(next: State) { if (!state.phase && next.phase === 1) setCaptured(prediction ? `${prediction}；理由：${reason || '未填写'}` : null); if (!next.phase) setCaptured(null); setState(next); }
  return <section className="a115" data-testid="architecture-lab-115"><header><p>错误边界实验 / 115</p><h3>同一段错误文本，是否代表同一种原因？</h3><p>逐层包装一个错误，比较对象身份、文字匹配与原因链分类。</p></header>
    <div className="a115-controls"><label>原始原因<select value={state.config.cause} onChange={e => edit({ cause: e.target.value as Config['cause'] })}><option value="missing">ErrMissing sentinel</option><option value="invalid">ErrInvalid sentinel</option><option value="quota">*QuotaError 类型错误</option><option value="unknown">未知数据库错误</option><option value="mimic">普通 errors.New("missing")</option></select></label><Wrapping label="存储层包装" value={state.config.inner} change={inner => edit({ inner })} /><Wrapping label="服务层包装" value={state.config.outer} change={outer => edit({ outer })} /><label>分类方法<select value={state.config.method} onChange={e => edit({ method: e.target.value as Config['method'] })}><option value="equal">== 比较 sentinel</option><option value="text">字符串包含匹配</option><option value="is-as">errors.Is / errors.As</option></select></label><label className="a115-check"><input type="checkbox" checked={state.config.localized} onChange={e => edit({ localized: e.target.checked })} />更换已知错误的展示文案</label></div>
    <fieldset disabled={state.phase > 0}><legend>可选：预测最终状态</legend><label>预测 HTTP<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">直接探索</option>{[400,404,429,500].map(n => <option key={n}>{n}</option>)}</select></label><label>预测理由<input value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset>
    <div data-testid="live-model" data-state={JSON.stringify(state)}><Chain state={state} /><Output state={state} /></div><Actions state={state} change={move} /><div className="a115-feedback" aria-live="polite"><strong>第 {state.phase} 步 · {stages[state.phase]}</strong><p>{view.classification?.evidence ?? '观察箭头是否存在：文本仍可包含原始信息，但只有 %w 在这里保留可解包原因。'}</p>{view.response && captured && <p>预测：{captured}；实际 HTTP：{view.response.status}。请根据可达错误身份核对理由。</p>}</div>
    <p className="a115-note">确定性教学模拟，不执行真实请求。== 仅比较两个 sentinel；Is 检查身份，As 查找可赋值类型。此处不模拟自定义 Is/As、多原因 Join 或 nil；HTTP 映射是本接口契约。中文开关代表替换构造文案但保留类别标识，并非在运行中修改 Go error。内部诊断只对教学者展示，真实系统须控制访问与敏感数据。</p>
  </section>;
}
export function Help({ mode }: { mode: string }) { return <aside className="a115 a115-help" data-testid="architecture-help-115"><p className="a115-note">辅助理解 · 不计入独立掌握</p>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Challenge />}</aside>; }
function Example() {
  const [method, setMethod] = useState<Config['method']>('text'); const [localized, setLocalized] = useState(false);
  const state = { ...initial({ cause: 'quota', inner: 'w', outer: 'w', method, localized }), phase: 4 };
  return <><h4>图片上传：读取类型化配额错误</h4><label>上传接口分类<select value={method} onChange={e => setMethod(e.target.value as Config['method'])}><option value="text">搜索 quota 文本</option><option value="is-as">As 获取 *QuotaError</option></select></label><label className="a115-check"><input type="checkbox" checked={localized} onChange={e => setLocalized(e.target.checked)} />把上传错误文案改成中文</label><Chain state={state} /><Output state={state} /><p aria-live="polite">{inspect(state).classification!.evidence}</p></>;
}
function Diagram() {
  const [inner, setInner] = useState<Wrap>('w'); const [selected, setSelected] = useState(0);
  const state = { ...initial({ cause: 'invalid', inner, outer: 'w', method: 'is-as', localized: false }), phase: 4 };
  return <><h4>从入口沿 Unwrap 边查找原因</h4><Wrapping label="中间层如何连接" value={inner} change={value => { setInner(value); setSelected(0); }} /><Chain state={state} selected={selected} select={setSelected} /><p aria-live="polite">选中第 {selected + 1} 层：{inspect(state).nodes[selected]?.identity ?? '本层不是已知 sentinel'}。Is 从入口依次检查可达节点；断边后不会搜索文字中的名称。</p><Output state={state} /></>;
}
function Steps() {
  const [state, setState] = useState(() => initial({ cause: 'missing', inner: 'w', outer: 'text', method: 'is-as', localized: false }));
  return <><h4>修复一次被截断的错误链</h4><Wrapping label="修复服务层包装" value={state.config.outer} change={outer => setState(configure(state, { outer }))} /><Chain state={state} /><Output state={state} /><Actions state={state} change={setState} /><div className="a115-feedback" aria-live="polite"><strong>{stages[state.phase]}</strong><p>{inspect(state).classification?.evidence ?? '每一步真实生成新的错误对象。注意顶层只有文本时，后面的分类无法恢复已丢失的原因边。'}</p></div></>;
}
function Challenge() {
  const [scenario, setScenario] = useState(0); const [answer, setAnswer] = useState(''); const [reason, setReason] = useState(''); const [submitted, setSubmitted] = useState(false);
  function reset(n: number) { setScenario(n); setAnswer(''); setReason(''); setSubmitted(false); }
  const expected = scenario ? 'as' : 'unknown';
  return <><h4>给新错误选择边界处理</h4><p>{scenario ? '租户上传达到限制，底层返回 *QuotaError{Limit:3}，两层均用 %w；文案改成“上传次数已达上限”。如何分类？' : '第三方驱动新建了一个普通 error，文字恰好为 missing；它并不是约定的 ErrMissing，且没有已知类型。应怎样映射？'}</p><label>你的处理<select value={answer} disabled={submitted} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="unknown">未知错误：500 + INTERNAL_ERROR，内部记录</option><option value="missing">只凭文字返回 404 + RESOURCE_NOT_FOUND</option><option value="as">As 读取类型：429 + QUOTA_EXCEEDED</option></select></label><label>判断理由<textarea value={reason} disabled={submitted} onChange={e => setReason(e.target.value)} /></label><button disabled={!answer || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交判断并揭晓</button>{submitted && <div data-testid="challenge-feedback" className="a115-feedback" role="status"><strong>{answer === expected ? '判断符合原因与契约' : '需要重新检查分类依据'}</strong><p>{scenario ? '两层 %w 保留 *QuotaError；As 按类型查找并读取 Limit，与中文文本无关。改用类型识别，再映射稳定业务码。' : '同样文字不能证明 sentinel 身份。Is/As 未命中时返回通用错误，内部保留诊断；先定义并验证稳定类别，不能凭文本冒充资源缺失。'}</p><p>你的理由：{reason}。反馈核对方案，请自行检查理由是否指出了身份、类型或可达链。</p></div>}<div className="a115-actions"><button onClick={() => reset(scenario)}>重试本情境</button><button onClick={() => reset(1 - scenario)}>换一个情境</button></div></>;
}
