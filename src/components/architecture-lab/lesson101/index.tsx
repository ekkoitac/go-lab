import { useState } from 'react';
import { advance, defaults, initial, inspect, modules, rewind, trace, type Config, type LabState } from './model';
import './style.css';

function Network({ state, selected, onSelect }: { state: LabState; selected?: number; onSelect?: (i: number) => void }) {
  const view = inspect(state);
  return <div className={`arch101-network ${state.config.topology}`} aria-label="部署边界与版本图">
    <p>{state.config.topology === 'monolith' ? '一个部署单元 · 内部保留三个业务模块' : '三个部署单元 · 箭头经过网络'}</p>
    <div className="arch101-nodes">{modules.map((name, i) => <div key={name} className="arch101-node-wrap">
      <button type="button" className={`arch101-node ${view.released.includes(i) ? 'updated' : ''} ${selected === i ? 'selected' : selected !== undefined && Math.abs(selected - i) === 1 ? 'related' : ''}`} onClick={() => onSelect?.(i)} disabled={!onSelect} aria-pressed={onSelect ? selected === i : undefined}>
        <strong>{name}</strong><span>v{view.versions[i]}</span><small>{view.replicas[i]} 个副本</small>
      </button>{i < 2 && <span className={`arch101-arrow ${selected !== undefined && (selected === i || selected === i + 1) ? 'active' : ''}`} aria-label={state.config.topology === 'services' ? '远程调用' : '进程内调用'}>→</span>}
    </div>)}</div>
    <div className={`arch101-request ${view.blocked ? 'blocked' : ''}`}>请求：订单 → 优惠 → 结算 · {view.blocked ? '契约拒绝' : '可完成'}</div>
  </div>;
}

export default function Lesson101() {
  const [state, setState] = useState<LabState>(() => initial());
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [captured, setCaptured] = useState<{ prediction: string; reason: string } | null>(null);
  const view = inspect(state);
  const comparison = inspect({ ...state, config: { ...state.config, topology: state.config.topology === 'monolith' ? 'services' : 'monolith' } });
  function configure(patch: Partial<Config>) { setState(initial({ ...state.config, ...patch })); setCaptured(null); }
  function step() { if (!state.phase) setCaptured({ prediction, reason }); setState(advance(state)); }
  return <section className="arch101" data-testid="architecture-lab-101">
    <header><p className="arch101-kicker">边界实验室 / 101</p><h3>拆成服务，共同变化会消失吗？</h3><p>在同一条订单链上推进发布，观察代码边界、部署边界和契约兼容之间的关系。</p></header>
    <div className="arch101-controls">
      <label>部署方式<select value={state.config.topology} onChange={e => configure({ topology: e.target.value as Config['topology'] })}><option value="monolith">模块化单体</option><option value="services">三个独立服务</option></select></label>
      <label>本次变更<select value={state.config.scope} onChange={e => configure({ scope: e.target.value as Config['scope'] })}><option value="shared">订单、优惠、结算共同修改规则</option><option value="settlement">只改结算算法，对外协议稳定</option></select></label>
      <label className="arch101-check"><input type="checkbox" checked={state.config.compatible} onChange={e => configure({ compatible: e.target.checked })} />为新旧契约增加兼容桥接</label>
      <label className="arch101-check"><input type="checkbox" checked={state.config.hotSettlement} onChange={e => configure({ hotSettlement: e.target.checked })} />结算需 4 个副本，其余只需 1 个</label>
    </div>
    <fieldset className="arch101-predict" disabled={state.phase > 0}><legend>可选：先预测第一次发布</legend><select aria-label="预测首次发布结果" value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">不预测，直接探索</option><option value="blocked">请求被契约拒绝</option><option value="ok">请求可完成</option></select><input aria-label="预测理由" placeholder="为什么？例如：新旧规则是否会共存" value={reason} onChange={e => setReason(e.target.value)} /></fieldset>
    <div data-testid="live-model" data-state={JSON.stringify(state)}><Network state={state} />
      <div className="arch101-metrics"><span><strong>{view.deployments} / {view.totalDeployments}</strong>发布操作</span><span><strong>{view.remoteCalls}</strong>请求链远程边</span><span><strong>{view.resourceUnits}</strong>资源单位</span></div>
    </div>
    <div className="arch101-actions"><button type="button" data-arch-action="back" disabled={state.phase === 0} onClick={() => { setState(rewind(state)); if (state.phase === 1) setCaptured(null); }}>回退一步</button><button type="button" data-arch-action="step" disabled={view.done} onClick={step}>{state.phase === 0 ? '发布第一批' : '发布下一批'}</button><button type="button" data-arch-action="reset" onClick={() => { setState(initial()); setPrediction(''); setReason(''); setCaptured(null); }}>重置实验</button></div>
    <div className="arch101-feedback" aria-live="polite"><strong>第 {state.phase} 步 · {view.done ? '变更完成' : '发布过程'}</strong><p>{trace(state)}</p>{captured && <p>{captured.prediction ? `首次预测：${captured.prediction === 'blocked' ? '请求被拒绝' : '请求可完成'}；首次实际：${inspect(advance(initial(state.config))).blocked ? '请求被拒绝' : '请求可完成'}。${captured.reason ? `你的理由：${captured.reason}` : ''}` : '本轮为自由探索，没有记录预测。'}</p>}</div>
    <details className="arch101-compare"><summary>同样需求，另一种部署方式怎样？</summary><p>相同变更范围、兼容条件和负载。以下比较整轮变更所需发布及目标副本资源。</p><table><thead><tr><th>指标</th><th>当前方案</th><th>另一方案</th></tr></thead><tbody><tr><th>整轮发布</th><td>{view.totalDeployments} 次</td><td>{comparison.totalDeployments} 次</td></tr><tr><th>远程调用边</th><td>{view.remoteCalls}</td><td>{comparison.remoteCalls}</td></tr><tr><th>资源单位</th><td>{view.resourceUnits}</td><td>{comparison.resourceUnits}</td></tr></tbody></table><p>试着把“共同规则变更”改为“稳定协议下独改结算”，再提高结算负载。拆分收益来自可独立变化和扩容的能力。</p></details>
    <p className="arch101-note">教学假设：单体发布在本模型中原子切换；服务按订单 → 优惠 → 结算滚动发布。共同规则变更需要同版契约，兼容桥接可接纳两版。资源单位仅按模块副本计数，忽略进程开销；不是性能实测。实际单体滚动发布也可能需版本兼容。</p>
  </section>;
}

export function Help({ mode }: { mode: string }) {
  return <aside className="arch101 arch101-help" data-testid="architecture-help-101"><p className="arch101-kicker">辅助理解 · 不计入独立掌握</p>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</aside>;
}
function Example() {
  const [round, setRound] = useState(0);
  const phases = ['活动改成阶梯折扣：订单要传商品分组，优惠要计算阶梯价，结算要校验新金额。三个模块一起变化。', '拆成三个服务后，先发布订单 v2。优惠仍按旧字段计算，新请求无法满足旧契约。', '增加契约兼容桥接，再逐个更新优惠和结算。请求恢复，但团队仍需安排三次发布和两个协议版本的维护。'];
  return <><h4>四人团队的促销周</h4><div className="arch101-example-flow">需求变化 → 订单字段 → 优惠规则 → 结算校验</div><p aria-live="polite">{phases[round]}</p><div className="arch101-actions">{phases.map((_, i) => <button key={i} aria-pressed={round === i} onClick={() => setRound(i)}>片段 {i + 1}</button>)}</div><p className="arch101-note">划分业务模块仍有价值；把同一条变化链放进三个进程，并不会自动让它独立变化。</p></>;
}
function Diagram() {
  const [split, setSplit] = useState(false);
  const [node, setNode] = useState(0);
  const info = ['订单提供商品分组，调用优惠；选中节点影响下游优惠、结算。', '优惠接收订单信息并提供金额规则；选中节点连着订单、结算。', '结算校验最终金额；独立算法更新可只在本模块完成，前提是外部协议稳定。'];
  return <><h4>同一调用链，两种边界</h4><label className="arch101-check"><input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} />把模块分别部署</label><Network state={initial({ ...defaults, topology: split ? 'services' : 'monolith' })} selected={node} onSelect={setNode} /><p aria-live="polite">{info[node]} {split ? '当前跨模块连线是远程契约，需处理网络失败和版本兼容。' : '当前跨模块连线是内部接口，代码边界仍需维护。'}</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const steps = [ { title: '先画变化范围', text: '需求：折扣计算改为阶梯价。把订单字段、优惠算法和结算校验圈在同一变化集合内。', visual: '【订单 + 优惠 + 结算】一起变化' }, { title: '再找独立运营收益', text: '四人共同发布、低流量，没有独立扩容要求。当前没有证据表明拆进程值得新增契约维护。', visual: '独立发布需求：无 / 独立扩容需求：无' }, { title: '选择起点并留下复查信号', text: '在统一部署内维护三个业务模块。若结算形成稳定契约并需要独立扩容，再评估抽出该能力。', visual: '一个部署单元 → 保留代码边界 → 记录拆分信号' } ];
  return <><h4>从约束推到决策</h4><ol className="arch101-step-list">{steps.map((s, i) => <li key={s.title} aria-current={i === step ? 'step' : undefined}>{s.title}</li>)}</ol><div className="arch101-feedback" aria-live="polite"><strong>{steps[step].visual}</strong><p>{steps[step].text}</p></div><div className="arch101-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 2} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>重来</button></div></>;
}
function Transfer() {
  const [variant, setVariant] = useState(false);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const expected = variant ? 'keep' : 'extract';
  return <><h4>换个产品，再作判断</h4><p>{variant ? '预约产品只有两名开发者，每周同时改排班、优惠和收费规则，无独立负载或隔离要求。下一步如何组织部署？' : '视频平台的转码能力已有稳定任务协议，独立团队负责，需要 20 倍计算资源；其余模块低负载。下一步如何组织部署？'}</p><label>你的方案<select value={answer} disabled={submitted} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="keep">统一部署，保留业务模块</option><option value="extract">评估单独部署这项能力</option><option value="all">每个技术层都拆成服务</option></select></label><label>依据<input value={reason} disabled={submitted} onChange={e => setReason(e.target.value)} placeholder="指出一条影响决策的约束" /></label><button disabled={!answer || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交并看反馈</button>{submitted && <div className="arch101-feedback" aria-live="polite"><strong>{answer === expected ? '方案与约束相符' : '请重新检查变化范围和运营需求'}</strong><p>{variant ? '共同规则持续变化且没有独立运营收益，统一部署能减少当前协调；仍需维护业务边界。' : '稳定协议、独立所有者和明显不同的计算需求支持评估独立转码服务。仍需验证队列、失败恢复和运维成本。'}</p><p>你的依据：{reason}。反馈核对了方案，请用上述约束检查自己的理由。</p></div>}<div className="arch101-actions"><button onClick={() => { setSubmitted(false); setAnswer(''); setReason(''); }}>重试本题</button><button onClick={() => { setVariant(!variant); setSubmitted(false); setAnswer(''); setReason(''); }}>换一个情境</button></div></>;
}


