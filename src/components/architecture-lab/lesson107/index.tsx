import { useState } from 'react';
import { advance, completed, defaults, initial, inspect, names, rewind, type Config, type Outcome } from './model';
import './style.css';
import RelationGraph from '../RelationGraph';

const phases = ['准备', '入口转换', '业务校验', '持久化', '入口收尾'];
function Pipeline({ config, phase }: { config: Config; phase: number }) {
  const view = inspect({ config, phase });
  const nodes = [config.entry === 'fake' ? '测试调用' : config.entry === 'http' ? 'HTTP 适配器' : '消息适配器', config.design === 'ports' ? '退款用例' : '绑定框架的退款函数', config.design === 'ports' ? 'RefundStore 端口' : 'SQL driver', config.design === 'coupled' ? 'SQL 资源' : config.entry === 'fake' ? 'Fake Store' : 'SQL 适配器'];
  return <div className="arch107-flow" aria-label="退款运行调用路径">{nodes.map((node, i) => <div key={i} className={(i === 0 ? !!view.command : i === 1 ? view.validated : view.saveCalls > 0) ? 'active' : ''}><small>{i === 0 ? '输入' : i === 1 ? '业务' : i === 2 ? '保存契约' : '实现'}</small><strong>{node}</strong>{i < 3 && <span aria-hidden="true">↓</span>}</div>)}<p>调用方向：从上到下。{view.committed ? `记录已写入 ${view.recordAmount} 元` : '尚无退款记录'}；{view.acknowledged ? 'Broker 已确认' : '尚无成功 Ack'}。</p></div>;
}
export default function Lesson107() {
  const [state, setState] = useState(() => initial());
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [captured, setCaptured] = useState<{ prediction: string; reason: string } | null>(null);
  const [compare, setCompare] = useState(false);
  const view = inspect(state);
  function configure(patch: Partial<Config>) { setState(initial({ ...state.config, ...patch })); setCaptured(null); setCompare(false); }
  function reset() { setState(initial()); setPrediction(''); setReason(''); setCaptured(null); setCompare(false); }
  return <section className="arch107" data-testid="architecture-lab-107">
    <h3>同一条退款规则，三种入口</h3><p>换入口、注入存储与确认故障，追踪业务决定和协议收尾各由谁负责。</p>
    <div className="arch107-controls">
      <label>核心结构<select value={state.config.design} onChange={e => configure({ design: e.target.value as Config['design'] })}><option value="ports">业务用例 + 端口适配器</option><option value="coupled">规则直连 HTTP / SQL / Broker</option></select></label>
      <label>调用入口<select value={state.config.entry} onChange={e => configure({ entry: e.target.value as Config['entry'] })}><option value="message">消息</option><option value="http">HTTP</option><option value="fake">纯 fake 端口测试</option></select></label>
      <label>退款金额<select value={state.config.amount} onChange={e => configure({ amount: Number(e.target.value) })}><option value="40">40 元（余额 100）</option><option value="120">120 元（超过余额）</option><option value="0">0 元（边界）</option><option value="100">100 元（恰好可退）</option></select></label>
      <label><input type="checkbox" checked={!state.config.storageOk} onChange={e => configure({ storageOk: !e.target.checked })} />注入保存失败</label>
      <label><input type="checkbox" disabled={state.config.entry !== 'message'} checked={!state.config.ackOk} onChange={e => configure({ ackOk: !e.target.checked })} />注入消息 Ack 失败</label>
    </div>
    <fieldset disabled={state.phase > 0}><legend>可选：预测最后结果</legend><select aria-label="退款结果预测" value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">直接探索</option>{(['success', 'invalid', 'storage', 'ack', 'blocked'] as Outcome[]).map(x => <option key={x} value={x}>{names[x]}</option>)}</select><input aria-label="退款预测理由" placeholder="哪一步决定结果？" value={reason} onChange={e => setReason(e.target.value)} /></fieldset>
    <div className="arch107-actions"><button data-arch-action="back" disabled={!state.phase} onClick={() => { setState(rewind(state)); setCompare(false); }}>上一步</button><button data-arch-action="step" disabled={state.phase === 4} onClick={() => { if (!state.phase) setCaptured({ prediction, reason }); setState(advance(state)); }}>下一步</button><button data-arch-action="reset" onClick={reset}>重置实验</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({ ...state, ...view })}>
      <p className="arch107-status" aria-live="polite">{phases[state.phase]} · {state.phase}/4 · {captured?.prediction ? '已记录预测' : '自由探索'}{state.phase === 4 ? ` · ${names[view.outcome]}` : ''}</p>
      <Pipeline config={state.config} phase={state.phase} />
      <dl className="arch107-metrics"><div><dt>Save 调用</dt><dd>{view.saveCalls}</dd></div><div><dt>已提交记录</dt><dd>{view.committed ? '1 条' : '0 条'}</dd></div><div><dt>Ack 调用</dt><dd>{view.ackCalls}</dd></div><div><dt>确认成功</dt><dd>{view.acknowledged ? '是' : '否'}</dd></div></dl>
      <p>核心的源码依赖：<code>{view.dependencies.join(' / ')}</code></p>
      <ol className="arch107-trace">{view.trace.map((line, i) => <li key={i} className={i === state.phase ? 'current' : ''}>{line}</li>)}</ol>
    </div>
    {state.phase === 4 && captured?.prediction && <p className="arch107-feedback">预测{captured.prediction === view.outcome ? '吻合' : '需修正'}：{names[captured.prediction as Outcome]}。实际：{names[view.outcome]}。理由记录：{captured.reason || '未填写'}。请用上方 Save 与 Ack 证据检查因果。</p>}
    {state.phase === 4 && <><button onClick={() => setCompare(!compare)}>对照另一种核心结构</button>{compare && <div className="arch107-feedback"><p>保持金额、入口与故障相同，仅切换结构。</p>{(['coupled', 'ports'] as const).map(design => { const result = completed({ ...state.config, design }); return <p key={design}><strong>{design === 'ports' ? '端口适配器' : '框架直连'}</strong>：{names[result.outcome]}；Save {result.saveCalls} 次；核心依赖 {result.dependencies.join('、')}。</p>; })}<p>分层改变复用与替换边界，不会自动修复存储或确认故障。选纯 fake 入口可检验装配边界。</p></div>}</>}
    <p className="arch107-note">教学模型：固定可退余额 100 元，Save 失败视为事务已回滚；无效消息按死信策略处理。所有 SQL / Broker 均为模拟。暂不实现并发、重复投递去重和真实分布式事务；已提交但 Ack 失败时仍需设计幂等，不能靠分层解决。</p>
  </section>;
}

function Example() {
  const [amount, setAmount] = useState(40);
  const [fake, setFake] = useState(false);
  return <><h4>同一张退款单，从两个门进入</h4><label>业务金额<select value={amount} onChange={e => setAmount(Number(e.target.value))}><option value="40">40 元</option><option value="120">120 元</option></select></label><label><input type="checkbox" checked={fake} onChange={e => setFake(e.target.checked)} />将存储实现替换为测试 Fake</label><p>HTTP JSON 和消息 payload 都转换为 <code>RefundCommand(amount={amount})</code>。换存储只改变装配，不改变金额规则。</p><div className="arch107-example">{(['http', 'message'] as const).map(entry => { const result = completed({ ...defaults, entry, amount }); return <article key={entry}><strong>{entry === 'http' ? 'HTTP JSON' : '消息 payload'} → RefundCommand</strong><p>相同用例 → {fake ? 'Fake Store' : 'SQL 适配器'}</p><p>{names[result.outcome]} · Save {result.saveCalls} 次</p><small>{entry === 'http' ? amount > 100 ? '映射 422' : '映射 200' : amount > 100 ? '拒绝到死信' : '提交后 Ack'}</small></article>; })}</div></>;
}
function Diagram() {
  const [kind, setKind] = useState<'source' | 'runtime'>('source');
  const [node, setNode] = useState('用例');
  const [fake, setFake] = useState(false);
  const adapter = fake ? 'Fake 实现' : 'SQL 适配器';
  const edges = kind === 'source' ? [['HTTP 适配器', '用例'], ['消息适配器', '用例'], ['用例', 'RefundStore'], [adapter, 'RefundStore']] : [['HTTP 适配器', '用例'], ['消息适配器', '用例'], ['用例', 'RefundStore'], ['RefundStore', adapter]];
  const linked = edges.filter(edge => edge.includes(node));
  return <><h4>运行调用与源码依赖，箭头一样吗？</h4><label>关系类型<select value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="source">源码依赖 / 实现契约</option><option value="runtime">运行时调用</option></select></label><label><input type="checkbox" checked={fake} onChange={e => { setFake(e.target.checked); setNode('RefundStore'); }} />替换 SQL 为 Fake</label><RelationGraph label={kind === 'source' ? '退款源码依赖图' : '退款运行调用图'} nodes={[{id:'HTTP 适配器',x:5,y:8,w:145},{id:'消息适配器',x:190,y:8,w:145},{id:'用例',x:105,y:110},{id:'RefundStore',x:5,y:225,w:145},{id:adapter,x:190,y:225,w:145}]} edges={edges.map(([from,to])=>({from,to}))} selected={node} onSelect={setNode}/><div className="arch107-node-picker">{['HTTP 适配器', '消息适配器', '用例', 'RefundStore', adapter].map(n => <button key={n} aria-pressed={node === n} onClick={() => setNode(n)}>{n}</button>)}</div><div className="arch107-edges">{edges.map(([from, to]) => <p key={from + to} className={from === node || to === node ? 'selected' : ''}>{from} <b>→</b> {to}{kind === 'source' && from === adapter ? '（实现契约）' : ''}</p>)}</div><p aria-live="polite">选中 {node}，突出 {linked.length} 条直接关系。{kind === 'source' ? '用例依赖自己需要的业务端口；SQL 实现该端口，核心无需导入 SQL driver。' : '调用沿端口分派到实际实现；调用方向不等于源码依赖方向。'}</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [fail, setFail] = useState(false);
  const view = inspect({ config: { ...defaults, storageOk: !fail }, phase: step });
  return <><h4>沿一条消息检查提交与确认</h4><label><input type="checkbox" checked={fail} onChange={e => { setFail(e.target.checked); setStep(0); }} />让 Save 返回错误</label><div className="arch107-guided"><strong>{phases[step]}</strong><p aria-live="polite">{view.trace.at(-1)}</p><p>已提交：{view.committed ? '是' : '否'} → Ack 调用：{view.ackCalls} 次</p></div><div className="arch107-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>回看</button><button disabled={step === 4} onClick={() => setStep(step + 1)}>推进一环</button><button onClick={() => setStep(0)}>重新走一遍</button></div>{step === 4 && <p>对照任务：切换 Save 故障，再追踪一次。业务用例返回错误后，消息适配器必须保留未确认状态。</p>}</>;
}
function Transfer() {
  const [location, setLocation] = useState('');
  const [ack, setAck] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return <><h4>迁移练习：定时任务也要调整授信</h4><p>API、消息消费者和新定时任务共用授信规则。本次规则通过，但保存额度失败。请先选择设计和消息处理。</p><fieldset disabled={submitted}><legend>提交前的判断</legend><label>定时任务调用哪里？<select value={location} onChange={e => setLocation(e.target.value)}><option value="">请选择</option><option value="handler">伪造 HTTP 请求，调用 handler</option><option value="usecase">构造业务命令，调用授信用例</option><option value="copy">复制规则到定时任务</option></select></label><label>保存失败的消息怎么处理？<select value={ack} onChange={e => setAck(e.target.value)}><option value="">请选择</option><option value="yes">已通过规则，立即 Ack</option><option value="no">返回错误，保持未确认以重试</option></select></label></fieldset><button disabled={!location || !ack || submitted} onClick={() => setSubmitted(true)}>提交判断</button>{submitted && <div className="arch107-feedback" aria-live="polite"><p>{location === 'usecase' && ack === 'no' ? '两处边界都正确。' : '还有边界需要调整。'}</p><p>{location === 'usecase' ? '业务命令让三个入口复用一个用例。' : '核心若需要 HTTP 请求，新入口仍受框架限制；复制规则还会分叉。将协议转换留在入口适配器。'}</p><p>{ack === 'no' ? '规则通过不等于持久化完成：错误应阻止成功 Ack。' : '提前 Ack 会让消息退出重试，而额度没有保存；分层并不会自动保证提交顺序。'}</p><button onClick={() => { setSubmitted(false); setLocation(''); setAck(''); }}>清空后重试</button></div>}</>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="arch107 arch107-help" data-testid="architecture-help-107">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="arch107-note">这是本地辅助练习，不写入独立掌握记录。</p></section>;
}
