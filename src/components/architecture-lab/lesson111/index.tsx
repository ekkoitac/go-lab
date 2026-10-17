import { useState } from 'react';
import { advance, configure, defaults, initial, inspect, rewind, scenarios, timeline, transports, type Config, type LabState, type Scenario, type Transport } from './model';
import './style.css';

function Board({ state, selected, onSelect }: { state: LabState; selected?: string; onSelect?: (node: string) => void }) {
  const view = inspect(state);
  const nodes = [{ id: 'client', title: '客户端所知', value: view.client }, { id: 'service', title: '服务端处理', value: view.service }, { id: 'task', title: '任务交接', value: view.handoff }];
  return <div className="arch111-board">
    <div className="arch111-nodes">{nodes.map(node => <button type="button" key={node.id} disabled={!onSelect} aria-pressed={onSelect ? selected === node.id : undefined} className={selected === node.id ? 'selected' : ''} onClick={() => onSelect?.(node.id)}><strong>{node.title}</strong><span data-testid={`status-${node.id}`}>{node.value}</span></button>)}</div>
    <div className="arch111-edge" data-edge={view.edge}>{view.edge === 'request' ? '客户端 → 服务端：发起请求' : view.edge === 'accept' ? '任务记录 → 客户端：返回任务编号' : view.edge === 'work' ? '服务端 → 业务处理：推进计算' : view.edge === 'result' ? '服务端 → 客户端：返回业务结果' : '尚无消息流动'}</div>
    <label className="arch111-progress">服务端已处理 {view.progress} / {state.config.duration} 单位<progress value={view.progress} max={state.config.duration} /></label>
    <div className="arch111-facts"><span>逻辑时刻：{view.tick}</span><span>接收确认：{view.accepted ? '已发出' : '未发出'}</span><span>业务结果：{view.result ? '服务端已生成' : '尚未生成'}</span></div>
    {selected && <p className="arch111-selected" aria-live="polite">{selected === 'client' ? `客户端只知道「${view.client}」。${view.result && view.client.includes('未知') ? '服务器完成不代表客户端得知。' : '任务编号与最终结果要分开解释。'}` : selected === 'service' ? `服务端处理 ${view.progress}/${state.config.duration}，这与所选序列化协议没有速度换算。` : `任务记录：${view.handoff}。任务交接把接收与执行拆成两个生命周期。`}</p>}
  </div>;
}
function Buttons({ state, setState, reset }: { state: LabState; setState: (state: LabState) => void; reset: () => void }) {
  return <div className="arch111-actions"><button type="button" data-arch-action="back" disabled={state.phase === 0} onClick={() => setState(rewind(state))}>回退一步</button><button type="button" data-arch-action="step" disabled={inspect(state).done} onClick={() => setState(advance(state))}>{state.phase === 0 ? '发起请求' : '推进下一事件'}</button><button type="button" data-arch-action="reset" onClick={reset}>重置实验</button></div>;
}
const scenarioDefaults: Record<Scenario, Partial<Config>> = { browser: { budget: 2, duration: 1 }, internal: { budget: 2, duration: 2 }, export: { budget: 2, duration: 4 } };
export default function Lesson111() {
  const [state, setState] = useState(() => initial());
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const view = inspect(state);
  function change(patch: Partial<Config>) { setState(configure(state, patch)); setPrediction(''); setReason(''); }
  const outcome = view.blocked ? 'blocked' : state.config.interaction === 'task' ? 'task' : state.config.duration > state.config.budget ? 'timeout' : 'result';
  const labels: Record<string, string> = { blocked: '接入或交互被阻断', task: '先得任务编号，之后查询结果', timeout: '客户端超时，结果未知', result: '预算内取得业务结果' };
  return <section className="arch111" data-testid="architecture-lab-111">
    <header><p className="arch111-kicker">协议与交互实验室 / 111</p><h3>先定如何交互，再选如何传输</h3><p>保持处理工作量相同，改变接口方案，追踪客户端所知与服务端事实何时分离。</p></header>
    <div className="arch111-controls">
      <label>业务场景<select aria-label="业务场景" value={state.config.scenario} onChange={event => { const scenario = event.target.value as Scenario; change({ scenario, ...scenarioDefaults[scenario] }); }}>{Object.entries(scenarios).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>传输方案<select aria-label="传输方案" value={state.config.transport} onChange={event => change({ transport: event.target.value as Transport })}>{Object.entries(transports).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>交互方式<select aria-label="交互方式" value={state.config.interaction} onChange={event => change({ interaction: event.target.value as Config['interaction'] })}><option value="sync">同步等待业务结果</option><option value="task">异步任务：先交接，再查询</option></select></label>
      <label>等待预算（逻辑单位）<input type="number" min={1} max={8} value={state.config.budget} onChange={event => change({ budget: Number(event.target.value) })} /></label>
      <label>处理耗时（逻辑单位）<input type="number" min={1} max={8} value={state.config.duration} onChange={event => change({ duration: Number(event.target.value) })} /></label>
      <label className="arch111-check"><input type="checkbox" checked={state.config.adapted} onChange={event => change({ adapted: event.target.checked })} />启用浏览器网关／客户端适配</label>
    </div>
    <p className="arch111-constraint">{state.config.scenario === 'internal' ? '内部计算：客户端支持生成契约；本模型允许直接接入 gRPC 或消息。仍须按交互需求选择。' : state.config.scenario === 'browser' ? '浏览器查询：优先考虑易接入与立即反馈。浏览器访问 gRPC／消息在本模型中需要网关适配。' : '报表导出：从浏览器发起，允许延迟完成。超过等待预算时可设计 HTTP 任务接口。'}</p>
    <fieldset disabled={state.phase > 0}><legend>可选：先预测这一轮的交互结果</legend><select aria-label="预测结果" value={prediction} onChange={event => setPrediction(event.target.value)}><option value="">直接探索</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="预测理由" placeholder="根据预算、接入条件或交接含义作判断" value={reason} onChange={event => setReason(event.target.value)} /></fieldset>
    <div data-testid="live-model" data-state={JSON.stringify(state)}><Board state={state} /></div>
    <Buttons state={state} setState={setState} reset={() => { setState(initial()); setPrediction(''); setReason(''); }} />
    <div className="arch111-feedback" aria-live="polite"><strong>事件 {state.phase} / {view.total}</strong><p>{view.event}</p>{view.done && prediction && <p>你的预测：{labels[prediction]}。实际：{labels[outcome]}。{prediction === outcome ? '结果一致；请自查理由是否说明因果。' : '请检查接入是否可行，以及预算限制的是等待还是后台处理。'} 你的理由：{reason || '未填写'}</p>}</div>
    <ol className="arch111-timeline" aria-label="已发生的交互事件">{view.rows.slice(1).map((row, i) => <li key={i} aria-current={i === view.rows.length - 2 ? 'step' : undefined}><span>t={row.tick}</span>{row.event}</li>)}</ol>
    <p className="arch111-note">教学模型：1 单位代表一次逻辑处理，不是毫秒或性能实测；任务交接固定耗时 1 单位，查询即时返回已存结果。导出和浏览器场景使用浏览器客户端。异步模式假定任务已可靠记录并有查询接口；消息方案可经网关查询。本例超时不自动取消服务端工作；实际需单独设计取消、持久化、重试、幂等和权限。HTTP、gRPC 都可承载任务接口；消息请求应答模式不在本实验范围。</p>
  </section>;
}
export function Help({ mode }: { mode: string }) {
  return <aside className="arch111 arch111-help" data-testid="architecture-help-111"><p className="arch111-kicker">辅助理解 · 不计入独立掌握</p>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}</aside>;
}
function Example() {
  const [async, setAsync] = useState(false);
  const [budget, setBudget] = useState(2);
  const [state, setState] = useState(() => initial({ ...defaults, duration: 3 }));
  const change = (task: boolean, nextBudget: number) => { setAsync(task); setBudget(nextBudget); setState(initial({ ...defaults, duration: 3, budget: nextBudget, interaction: task ? 'task' : 'sync' })); };
  return <><h4>照片打印店：拿到取件号等于照片印好了吗？</h4><p>浏览器提交一套照片，打印需要 3 个逻辑单位；店内接单与完成打印是两个事件。</p><label>柜台安排<select value={async ? 'task' : 'sync'} onChange={event => change(event.target.value === 'task', budget)}><option value="sync">站在柜台等打印结果</option><option value="task">先拿取件号，完成后查询</option></select></label><label>可等待的时间<select value={budget} onChange={event => change(async, Number(event.target.value))}><option value={2}>2 单位</option><option value={4}>4 单位</option></select></label><Board state={state} /><Buttons state={state} setState={setState} reset={() => change(false, 2)} /><p className="arch111-feedback" aria-live="polite">{inspect(state).event}</p><p className="arch111-note">取件号类比任务 ID；实际系统还需保证记录持久性、授权访问和失败状态。</p></>;
}
function Diagram() {
  const [state, setState] = useState(() => initial({ ...defaults, interaction: 'task', duration: 2 }));
  const [selected, setSelected] = useState('client');
  return <><h4>点选泳道，比较各方所知</h4><p>选中角色后推进事件，观察同一时刻三方状态。交接箭头带回编号；结果箭头带回业务结果。</p><Board state={state} selected={selected} onSelect={setSelected} /><Buttons state={state} setState={setState} reset={() => { setState(initial({ ...defaults, interaction: 'task', duration: 2 })); setSelected('client'); }} /><p className="arch111-feedback" aria-live="polite">{inspect(state).event}</p></>;
}
function Steps() {
  const [state, setState] = useState(() => initial({ ...defaults, scenario: 'internal', transport: 'grpc', budget: 2, duration: 3 }));
  return <><h4>从调用预算推导一次失败，再修复</h4><p>内部图像分析使用生成的 gRPC 客户端，处理需 3 单位，等待预算只有 2。先推进观察超时，再改变交互重跑。</p><label>修复选择<select value={state.config.interaction} onChange={event => setState(configure(state, { interaction: event.target.value as Config['interaction'] }))}><option value="sync">保持同步调用</option><option value="task">用 gRPC 返回任务编号</option></select></label><Board state={state} /><Buttons state={state} setState={setState} reset={() => setState(initial({ ...defaults, scenario: 'internal', transport: 'grpc', budget: 2, duration: 3 }))} /><div className="arch111-feedback" aria-live="polite"><strong>当前输入：处理 {state.config.duration}，预算 {state.config.budget}</strong><p>{inspect(state).event}</p><p>判断依据：{state.config.interaction === 'sync' ? '同步返回必须在等待预算内完成；更换序列化协议不会消除这项工作量。' : '先可靠交接，再查询结果，改变的是交互生命周期。'}</p></div></>;
}
const challenges = [
  { prompt: '浏览器申请语音转写，处理需 6 单位，用户只愿等 1 单位。已有 HTTP 接口，允许稍后取结果。你会怎样改造？', options: [['task', 'HTTP 返回任务编号，稍后查询'], ['grpc', '只换成同步 gRPC，保持原预算'], ['done', '接收确认后立即显示转写完成']], expected: 'task', feedback: 'HTTP 任务接口在 1 单位内交接，6 单位处理在后台进行。只换协议不会减少工作量；接收确认不能证明转写完成。修复：明确任务记录、状态查询与失败恢复。' },
  { prompt: '受控内部客户端已有生成契约，计算需 2 单位，预算也是 2 单位，要求直接取得结果。当前 gRPC 接入可用。应怎样判断？', options: [['sync', '同步 gRPC 可满足本轮约束'], ['message', '必须改消息，否则一定超时'], ['fast', 'gRPC 天生更快，所以无需检查预算']], expected: 'sync', feedback: '本模型处理 2 单位恰好在 2 单位预算内完成，接入也可用，同步响应可满足约束。理由来自条件，不能推出 gRPC 普遍更快；真实系统还需考虑网络与排队余量。修复：先核对接入和端到端预算。' },
];
function Try() {
  const [variant, setVariant] = useState(0);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const challenge = challenges[variant];
  const reset = () => { setAnswer(''); setReason(''); setSubmitted(false); };
  return <><h4>让我试试：按约束安排交互</h4><p>情境 {variant + 1} / 2：{challenge.prompt}</p><label>你的判断<select value={answer} disabled={submitted} onChange={event => setAnswer(event.target.value)}><option value="">请选择</option>{challenge.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>判断理由<textarea value={reason} disabled={submitted} onChange={event => setReason(event.target.value)} placeholder="指出接入能力、等待预算或接收与完成的区别" /></label><button type="button" disabled={!answer || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交并看反馈</button>{submitted && <div className="arch111-feedback" data-testid="challenge-feedback" aria-live="polite"><strong>{answer === challenge.expected ? '方案符合本情境约束' : '方案与关键约束不符'}</strong><p>{challenge.feedback}</p><p>你的理由：{reason}</p><p>这里只核对所选方案；请自行对照上面的因果检查理由，不对自由文本自动评分。</p></div>}<div className="arch111-actions"><button type="button" onClick={reset}>重试本题</button><button type="button" onClick={() => { setVariant(1 - variant); reset(); }}>换一个情境</button></div></>;
}
