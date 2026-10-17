import { useState } from 'react';
import { initialConfig, inspect, formatCents, strategyNames, type Config, type Strategy, type Change } from './model';
import './style.css';

function Dependency({ config, phase, focus = 'all' }: { config: Config; phase: number; focus?: string }) {
  const model = inspect(config, phase);
  const shared = config.strategy !== 'local';
  return <div className="a105-network" aria-label="依赖与版本关系">
    {['marketing', 'settlement'].filter(team => focus === 'all' || focus === team || focus === 'shared').map(team => <div key={team} className="a105-lane">
      <strong>{team === 'marketing' ? '营销估算' : '结算入账'} <small>{(team === 'marketing' ? model.marketingUpdated : model.settlementUpdated) ? '已部署变更' : '保持 v1'}</small></strong>
      <span aria-hidden="true">↓ 依赖</span>
      <div>{config.strategy === 'all' ? '共享金额规则 + 表示 + 校验' : config.strategy === 'representation' ? '本地业务规则 → 共享表示 + 校验' : '本地规则 + 表示 + 校验副本'}</div>
    </div>)}
    {shared && <p className="a105-library">共同维护者：{config.owner ? '已指定' : '缺席'} · 共享库：{model.published && model.sharedChange ? 'v2 可用' : 'v1'}<br />箭头表示代码依赖；应用固定库版本，需显式升级。</p>}
  </div>;
}
function Results({ config, phase }: { config: Config; phase: number }) {
  const m = inspect(config, phase);
  return <table><caption>相同输入：{config.mills} 厘，币种 {config.currency}（10 厘 = 1 分）</caption><thead><tr><th>调用方</th><th>当前输出</th><th>变更后的要求</th></tr></thead><tbody><tr><th>营销</th><td>{formatCents(m.marketing)}</td><td>{formatCents(m.expectedMarketing)}</td></tr><tr><th>结算</th><td>{formatCents(m.settlement)}</td><td>{formatCents(m.expectedSettlement)}</td></tr></tbody></table>;
}
export default function Lesson105() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [phase, setPhase] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [compare, setCompare] = useState(false);
  const model = inspect(config, phase);
  const change = (next: Config) => { setConfig(next); setPhase(0); setPrediction(''); setReason(''); setCompare(false); };
  return <div className="arch105" data-testid="architecture-lab-105">
    <h3>相似的金额代码，该共享到哪里？</h3>
    <p>目标：发布一次规则变更，追踪它如何经过库版本进入两个业务，区分“结果恰好相同”和“业务语义相同”。</p>
    <div className="a105-controls">
      <label>共享边界<select value={config.strategy} onChange={e => change({ ...config, strategy: e.target.value as Strategy })}>{Object.entries(strategyNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>变更请求<select value={config.change} onChange={e => change({ ...config, change: e.target.value as Change })}><option value="rounding">仅结算：改为按分向下取整</option><option value="currency">双方同一规则：仅接受 CNY</option></select></label>
      <label>测试金额（整数厘）<select value={config.mills} onChange={e => change({ ...config, mills: Number(e.target.value) })}><option value={1005}>1005 厘：1.005 主单位</option><option value={1010}>1010 厘：1.010 主单位</option><option value={1001}>1001 厘：1.001 主单位</option><option value={0}>0 厘：零金额</option></select></label>
      <label>输入币种<select value={config.currency} onChange={e => change({ ...config, currency: e.target.value as Config['currency'] })}><option value="CNY">CNY</option><option value="XYZ">XYZ（虚构的不支持币种）</option></select></label>
      <label className="a105-check"><input type="checkbox" checked={config.owner} onChange={e => change({ ...config, owner: e.target.checked })} />已指定共同维护者与兼容测试责任</label>
    </div>
    <p className="a105-note">教学假设：金额非负、无税率与汇率；基线按分四舍五入，使用整数厘运算。币种变更模拟协议白名单修复，并非完整安全校验。次数只统计本模型的改动与部署，不是实测工时。</p>
    <div className="a105-panel" data-testid="live-model" data-state={JSON.stringify({ config, ...model })}>
      <strong>发布进度：{['基线', '准备并发布变更', '结算部署', '营销检查并部署'][phase]}</strong>
      <Dependency config={config} phase={phase} />
      <Results config={config} phase={phase} />
      <div className="a105-metrics"><span>实现修改 <b>{model.implementations}</b> 处</span><span>调用方部署 <b>{model.upgrades}</b> 次</span></div>
    </div>
    {phase === 0 && <div className="a105-panel"><label>可选预测：全部步骤完成后，营销输出会变化吗？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">直接探索</option><option value="yes">会变化</option><option value="no">不会变化</option></select></label><label>理由（可留空）<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="跟踪哪个规则、哪个版本传到了营销" /></label></div>}
    <div className="a105-controls"><button data-arch-action="step" disabled={phase === 3} onClick={() => setPhase(v => v + 1)}>{['准备并发布变更', '部署结算', '检查营销升级', '观察完成'][phase]}</button><button data-arch-action="back" disabled={phase === 0} onClick={() => setPhase(v => v - 1)}>回退一步</button><button data-arch-action="reset" onClick={() => change(initialConfig)}>重置实验</button></div>
    <div aria-live="polite" className="a105-feedback"><ol>{model.trace.map((line, i) => <li key={i}>{line}</li>)}</ol>{phase === 3 && <><p>{prediction ? `预测${(prediction === 'yes') === model.changedMarketing ? '一致' : '不一致'}。${reason ? `你的理由：${reason}` : ''}` : '本次为自由探索，未记录预测。'}</p><p>{model.blocked ? '先指定维护者，重新发布；无维护者的共享抽象没有免除责任。' : !model.marketingMatches ? '营销仍需要估算，升级却改变了规则。把共享边界缩到稳定表示与同义校验，再跑相同输入。' : config.change === 'rounding' && config.strategy === 'all' ? '这个输入恰好得到相同金额，但营销仍随共享规则升级。试试 1005 厘，寻找隐藏的语义分歧。' : config.change === 'currency' ? '两边因同一个协议约束变化，共享校验可减少重复修复；调用方升级与兼容验证依然存在。' : '结算规则已改变，营销保持估算。稳定表示无需跟着业务规则发布。'}</p></>}</div>
    <button aria-pressed={compare} onClick={() => setCompare(v => !v)}>同条件对照三种边界</button>
    {compare && <div className="a105-panel"><p>以下对照完成全部三步；输入、变更与维护者条件保持一致。</p><table><thead><tr><th>共享边界</th><th>营销符合要求</th><th>修改 / 部署</th></tr></thead><tbody>{(Object.keys(strategyNames) as Strategy[]).map(strategy => { const m = inspect({ ...config, strategy }, 3); return <tr key={strategy}><td>{strategyNames[strategy]}</td><td>{m.blocked ? '未能发布' : m.marketingMatches ? '是' : '否'}</td><td>{m.implementations} / {m.upgrades}</td></tr>; })}</tbody></table></div>}
  </div>;
}
function Example() {
  const [mills, setMills] = useState(1010);
  const [run, setRun] = useState(false);
  return <><h4>找一个能暴露差异的金额</h4><p>营销继续四舍五入，结算改为向下取整。先用一个输入观察，再尝试反例。</p><label>选择输入<select value={mills} onChange={e => { setMills(Number(e.target.value)); setRun(false); }}><option value={1010}>1010 厘</option><option value={1005}>1005 厘</option><option value={1001}>1001 厘</option></select></label><button onClick={() => setRun(true)}>计算两个业务结果</button>{run && <div aria-live="polite"><Results config={{ ...initialConfig, strategy: 'representation', mills }} phase={3} /><p>{mills === 1005 ? '100.5 分在营销成为 101 分，在结算成为 100 分。相似代码表达不同承诺。' : '这次两种规则得到同一输出，不能由一个样本推断规则同义。试试半分边界。'}</p></div>}</>;
}
function Diagram() {
  const [strategy, setStrategy] = useState<Strategy>('all');
  const [target, setTarget] = useState('all');
  const [applied, setApplied] = useState(false);
  const config = { ...initialConfig, strategy };
  return <><h4>拆开一条规则传播路径</h4><p>箭头表示代码依赖；通过调整共享边界，改变结算规则能否传播到营销。</p><label>连接方式<select value={strategy} onChange={e => { setStrategy(e.target.value as Strategy); setApplied(false); }}>{Object.entries(strategyNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>追踪对象<select value={target} onChange={e => setTarget(e.target.value)}><option value="all">全部关系</option><option value="marketing">营销依赖路径</option><option value="settlement">结算依赖路径</option></select></label><Dependency config={config} phase={applied ? 3 : 0} focus={target} /><button onClick={() => setApplied(v => !v)}>{applied ? '撤销本次传播' : '注入结算舍入变更并升级'}</button><p aria-live="polite">{applied ? `营销输出 ${formatCents(inspect(config, 3).marketing)}；结算输出 ${formatCents(inspect(config, 3).settlement)}。${strategy === 'all' ? '同一规则连接了不同业务。' : '结算的本地规则没有经过共享表示传播。'}` : '尚未注入变更。'}</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [duplicate, setDuplicate] = useState(false);
  const config: Config = { ...initialConfig, strategy: duplicate ? 'local' : 'representation', change: 'currency', currency: 'XYZ' };
  const m = inspect(config, step);
  return <><h4>跟一次“同因变化”的协议修复</h4><p>两队执行完全相同的币种白名单规范；XYZ 应被拒绝。这里统一维护有明确语义依据。</p><label className="a105-check"><input type="checkbox" checked={duplicate} onChange={e => { setDuplicate(e.target.checked); setStep(0); }} />改成两份独立校验副本</label><Results config={config} phase={step} /><p aria-live="polite">步骤 {step + 1} / 4：{m.trace.at(-1)}</p><p>修改 {m.implementations} 处，已部署 {m.upgrades} 个调用方。即使共享一份实现，也不能省略两个应用的升级验证。</p><div className="a105-controls"><button disabled={!step} onClick={() => setStep(v => v - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(v => v + 1)}>下一步</button><button onClick={() => setStep(0)}>重新走一遍</button></div></>;
}
function Transfer() {
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return <><h4>迁移：发票规则与报文编码</h4><p>三个团队每次协议更新都同步修改同一种报文编码，已经出现重复实现不一致。发票折扣和会员积分目前公式相似，但分别由财务和运营决定。怎样划共享边界？</p><label>你的决定<select value={choice} disabled={submitted} onChange={e => setChoice(e.target.value)}><option value="">先选方案</option><option value="all">编码、折扣和积分全部放进 common</option><option value="protocol">共享有维护者和版本约定的编码；分别维护折扣和积分</option><option value="copy">三个团队全部复制，避免任何共享</option></select></label><label>依据什么判断语义相同？<textarea rows={2} value={reason} disabled={submitted} onChange={e => setReason(e.target.value)} /></label><div className="a105-controls"><button disabled={!choice || submitted} onClick={() => setSubmitted(true)}>提交并看反馈</button><button onClick={() => { setChoice(''); setReason(''); setSubmitted(false); }}>重新尝试</button></div>{submitted && <div className="a105-feedback" aria-live="polite"><p>{choice === 'protocol' ? '符合约束：编码持续因同一协议变化，统一实现可减少偏差。折扣和积分由不同业务决策驱动，不应仅因公式相似合并。' : choice === 'all' ? '折扣和积分没有共同演进承诺。全部共享会把独立业务决策绑定到同一个版本。' : '所有重复都保留，会继续承担三处协议修复和兼容偏差。试着只统一被证明同义的部分。'}</p><p>共享库还需要所有者、兼容测试、发布版本及调用方升级计划。{reason ? `你的依据：${reason}` : ''}</p></div>}</>;
}
export function Help({ mode }: { mode: string }) {
  return <div className="arch105" data-testid="architecture-help-105">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="a105-note">辅助理解与练习，不计入独立掌握证据；本区不改变主实验。</p></div>;
}
