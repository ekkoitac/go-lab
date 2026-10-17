import { useState } from 'react';
import { advance, defaults, initial, pause, rollback, strategies, type Config, type State, type Strategy } from './model';
import './style.css';

export default function Lesson195() {
  const [config, setConfig] = useState<Config>({ ...defaults });
  const [history, setHistory] = useState<State[]>([initial()]);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [record, setRecord] = useState<{ prediction: string; reason: string } | null>(null);
  const state = history[history.length - 1];
  const change = (patch: Partial<Config>) => { const next = { ...config, ...patch }; setConfig(next); setHistory([initial(next)]); };
  const act = (fn: (s: State) => State) => { const next = fn(state); if (next !== state) setHistory([...history, next]); };
  const reset = () => { setHistory([initial(config)]); setRecord(null); setPrediction(''); setReason(''); };
  return <section className="dl195" data-testid="delivery-lab-195">
    <h3>把发布风险放进真实订单里观察</h3>
    <p>目标：在容量约束下控制影响范围，用同类客户的金额差异决定是否放量。先记录预测，再逐步切流和观察。</p>
    <fieldset disabled={record !== null}><legend>本轮控制条件</legend><div className="dl195-controls">
      <label>发布策略<select value={config.strategy} onChange={e => change({ strategy: e.target.value as Strategy })}>{Object.entries(strategies).map(([key, v]) => <option value={key} key={key}>{v.label}</option>)}</select></label>
      <label>额外容量预算<select value={config.extraCapacity} onChange={e => change({ extraCapacity: +e.target.value })}>{[10, 20, 100].map(n => <option key={n} value={n}>{n} 单位</option>)}</select></label>
      <label>金额异常暂停阈值<select value={config.threshold} onChange={e => change({ threshold: +e.target.value })}><option value={1}>1%</option><option value={10}>10%（宽松）</option></select></label>
      <label>观测客群<select value={String(config.representative)} onChange={e => change({ representative: e.target.value === 'true' })}><option value="true">普通 + 折扣客户，分层对照</option><option value="false">只看内部测试账户</option></select></label>
    </div><label><input type="checkbox" checked={config.pricingBug} onChange={e => change({ pricingBug: e.target.checked })} /> 新版本存在折扣定价缺陷</label><label><input type="checkbox" checked={config.compatible} onChange={e => change({ compatible: e.target.checked })} /> 新旧版本能互读写入数据</label></fieldset>
    <fieldset disabled={record !== null}><legend>先预测并解释</legend><label>预计结果<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择预测</option><option>上线前被容量或兼容门禁阻止</option><option>小流量后暂停</option><option>全量后才暴露问题</option><option>业务对照通过并逐步全量</option></select></label><label>预测依据<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="把容量、客群或业务阈值与结果联系起来" /></label><button type="button" disabled={!prediction || !reason.trim()} onClick={() => setRecord({ prediction, reason: reason.trim() })}>记录本轮预测</button></fieldset>
    {record && <p className="dl195-record">已锁定预测：{record.prediction}。理由：{record.reason}。回退只重放实验，不能修改已见结果前的预测。</p>}
    <div className="dl195-actions"><button type="button" data-delivery-action="step" disabled={!record || ['paused', 'complete', 'rolledBack'].includes(state.phase)} onClick={() => act(advance)}>单步：{state.phase === 'setup' ? '检查发布条件' : state.phase === 'ready' ? '切入下一档流量' : '运行订单并比较'}</button><button type="button" data-delivery-action="back" disabled={history.length < 2} onClick={() => setHistory(history.slice(0, -1))}>回退一步</button><button type="button" disabled={!['ready', 'observe'].includes(state.phase)} onClick={() => act(pause)}>暂停放量</button><button type="button" disabled={state.traffic === 0} onClick={() => act(rollback)}>回切旧版本</button><button type="button" data-delivery-action="reset" onClick={reset}>重置本轮</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({ ...state, prediction: record })} className="dl195-model">
      <div className="dl195-traffic" aria-label={`旧版本 ${100 - state.traffic}%，新版本 ${state.traffic}%`}><span style={{ flexGrow: 100 - state.traffic }} /><strong style={{ flexGrow: state.traffic }} /></div><p>旧版本 {100 - state.traffic}% → 路由分配 → 新版本 {state.traffic}%</p>
      <div className="dl195-stats"><div>容量需求<strong>{100 + strategies[config.strategy].extra} / {100 + config.extraCapacity}</strong></div><div>CPU<strong>正常</strong></div><div>新 / 旧金额异常<strong>{state.observedError === null ? '待观测' : `${state.observedError}% / 0%`}</strong></div><div>累计错误订单<strong>{state.badOrders} 笔</strong></div></div>
      <p role="status" className="dl195-feedback">{state.note}</p>
      {['paused', 'complete', 'rolledBack'].includes(state.phase) && record && <p>核对预测「{record.prediction}」：本轮最终新版本流量 {state.traffic}%，错误订单 {state.badOrders} 笔。用上面的门禁原因检查自己的理由；重置后可换一个条件做对照。</p>}
    </div>
    <details><summary>模型假设与边界</summary><p>基线容量 100 单位；滚动额外 10、金丝雀额外 20、蓝绿额外 100 是本实验部署配置，不是通用固定比例。每档运行 1000 个请求的对应份额；代表性样本含 20% 折扣客户，其中 40% 金额错误，因此新版本组内异常率为 8%。内部账户不含折扣；达到全量后真实订单仍含全部客群。这里只比较确定性金额，不模拟统计置信度、负载尖峰和随机波动。回退是教学时间旅行；生产回切只影响后续流量。</p></details>
  </section>;
}

export function Help({ mode }: { mode: string }) {
  const [budget, setBudget] = useState(20);
  const [group, setGroup] = useState('discount');
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const process = [
    ['发布前', '先确认旧版可读新写入、路由可控、恢复负责人就绪。', '流量：旧 100% / 新 0%'],
    ['选择样本', '为普通和折扣客户分别保留旧版对照组，避免只测内部账户。', '两组都包含相同客群构成'],
    ['5% 金丝雀', '先切小流量，再收集同类订单的金额差异。', 'CPU 正常；金额异常新 8% / 旧 0%'],
    ['执行门禁', '8% 超过预设 1%，暂停下一档；保留故障证据。', '流量仍是 5%，没有扩大到 20%'],
    ['回切并核对', '后续请求回到旧版；对已写错误订单执行独立补偿流程。', '新流量 0%；历史错误订单仍存在'],
  ];
  return <section className="dl195 dl195-help" data-testid="delivery-help-195"><p className="dl195-muted">辅助探索：此处操作与答案揭示不计入独立掌握。</p>
    {mode === 'example' && <><h3>例子：只有 120 单位容量，怎样布置新旧环境？</h3><label>可用总容量<select value={budget} onChange={e => setBudget(+e.target.value)}><option value={10}>110</option><option value={20}>120</option><option value={100}>200</option></select></label><div className="dl195-comparison">{Object.entries(strategies).map(([key, plan]) => <article key={key} data-fit={budget >= plan.extra}><h4>{plan.label}</h4><div className="dl195-blocks"><span>旧环境基线 100</span><strong>额外 {plan.extra}</strong></div><p>需要 {100 + plan.extra} / 可用 {100 + budget}</p><p>{budget >= plan.extra ? '容量可容纳' : `还缺 ${plan.extra - budget} 单位`}</p><p>首次真实暴露 {plan.stages[0]}% 流量</p></article>)}</div><p>容量允许不等于风险合适：滚动首批影响 25%，蓝绿整体切换 100%，本例金丝雀从 5% 起步。更改预算，比较“部署得下”和“影响多少人”这两个不同问题。</p></>}
    {mode === 'diagram' && <><h3>沿客户 → 定价 → 指标追踪证据</h3><div className="dl195-actions">{[['internal', '内部账户'], ['normal', '普通客户'], ['discount', '折扣客户']].map(([id, label]) => <button type="button" key={id} aria-pressed={group === id} onClick={() => setGroup(id)}>{label}</button>)}</div><div className="dl195-path"><div>{group === 'discount' ? '折扣客户' : group === 'normal' ? '普通客户' : '内部账户'}</div><span>↓ 按同类客群分流</span><div className="dl195-branches"><article><strong>旧定价 v1</strong><p>金额正确</p><span>↓ 基线</span><p>金额异常 0%</p></article><article data-risk={group === 'discount'}><strong>新定价 v2</strong><p>{group === 'discount' ? '折扣计算有缺陷' : '不触发折扣分支'}</p><span>↓ 业务结果</span><p>金额异常 {group === 'discount' ? 40 : 0}%</p></article></div><span>↓ 同类对照决定是否放量</span><div>{group === 'discount' ? '发现折扣客群差异 → 暂停并核对' : '此客群未发现异常 → 还需覆盖折扣客群'}</div></div><p>图中连线表示请求与指标来源。切换客群会同时改变经过的定价分支和金额证据。两条路径 CPU 都正常；CPU 无法替代金额核对。</p></>}
    {mode === 'steps' && <><h3>跟着一次异常发布走完决策链</h3><ol className="dl195-timeline">{process.map(([title], i) => <li key={title} data-current={step === i}><button type="button" onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined}>{i + 1}. {title}</button></li>)}</ol><div className="dl195-stats" aria-label="当前步骤的发布状态"><div>新版本接收流量<strong>{step === 2 || step === 3 ? 5 : 0}%</strong></div><div>本次业务对照<strong>{step >= 2 ? '8% / 0%' : '尚无数据'}</strong></div><div>允许继续放量<strong>{step === 3 || step === 4 ? '否：门禁暂停' : '待完成检查'}</strong></div><div>待核对错误订单<strong>{step >= 2 ? 4 : 0} 笔</strong></div></div><article className="dl195-feedback"><strong>{process[step][0]}</strong><p>{process[step][1]}</p><p>{process[step][2]}</p></article><div className="dl195-actions"><button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button type="button" disabled={step === process.length - 1} onClick={() => setStep(step + 1)}>下一步</button><button type="button" onClick={() => setStep(0)}>回到起点</button></div></>}
    {mode === 'try' && <><h3>换情境：无法按请求分流的低风险修复</h3><p>新场景：只增加兼容日志字段，不改业务结果；额外容量 15%，暂时没有流量分组路由。旧版能读取全部数据，要求能暂停与回退。选择可执行的起步方案并解释。</p><fieldset disabled={submitted}><label>方案<select value={answer} onChange={e => setAnswer(e.target.value)}><option value="">先作判断</option><option value="rolling">分批滚动，逐批观测并设置暂停条件</option><option value="blueGreen">长时间保留双份完整蓝绿环境</option><option value="canary">宣称已按客户分组做金丝雀</option></select></label><label>依据<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="解释容量、路由和风险如何约束选择" /></label><button type="button" disabled={!answer || !reason.trim()} onClick={() => setSubmitted(true)}>提交并揭晓</button></fieldset>{submitted && <div className="dl195-feedback"><p>{answer === 'rolling' ? '选择与这个场景相符。' : '这个方案遗漏了实现条件。'} 这里应优先评估有观测、暂停和回退能力的滚动发布：变更风险低且兼容，15% 容量容得下本例 10% 额外需求；双份蓝绿超预算，无分流路由不能称已实现金丝雀。</p><p>你的理由：{reason}。检查是否同时覆盖低风险、兼容、容量和路由这四条约束。此为辅助练习，理由需自行对照，不自动判为掌握。</p></div>}</>}
  </section>;
}

