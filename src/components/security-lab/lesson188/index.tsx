import {useState} from 'react';
import {assess, back, configure, createState, exposure, initialConfig, labels, phases, step, type Config, type Exposure} from './model';
import './style.css';

function Path({config}: {config: Config}) {
  return <div className="sec188-path" aria-label="教学调用图">
    <div>生产入口<br/><small>app → adapter</small></div>
    <span aria-hidden="true">↓</span>
    <div className={config.callEdge ? 'sec188-connected' : 'sec188-disconnected'}>adapter → Decode<br/><strong>{config.callEdge ? '调用边连接' : '调用边断开'}</strong></div>
    <span aria-hidden="true">↓</span>
    <div>decoder v{config.version}<br/><small>{config.productionTag ? 'legacy 标签启用' : 'legacy 标签关闭'}</small></div>
  </div>;
}
function Prediction({value, reason, onValue, onReason, disabled = false}: {disabled?: boolean; value: Exposure | ''; reason: string; onValue: (value: Exposure) => void; onReason: (value: string) => void}) {
  return <div className="sec188-prediction"><label>预测漏洞判断<select disabled={disabled} value={value} onChange={e => onValue(e.target.value as Exposure)}><option value="">先选择预测</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>预测理由<textarea disabled={disabled} rows={2} value={reason} onChange={e => onReason(e.target.value)} placeholder="哪条调用边、版本或构建证据支持你的判断？"/></label></div>;
}
function Check({label, value, onChange}: {label: string; value: boolean; onChange: (value: boolean) => void}) {return <label className="sec188-check"><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)}/>{label}</label>;}
const decisionLabels = {block: '停止交付：存在明确阻断证据', hold: '暂缓交付：补齐证据再决定', conditional: '可进入受控发布评审，持续监测'};

export default function Lesson188Lab() {
  const [state, setState] = useState(createState);
  const {config, phase} = state;
  const result = assess(config);
  const change = (patch: Partial<Config>) => setState(current => configure(current, patch));
  return <section className="sec188" data-testid="security-lab-188">
    <h3>依赖证据工作台</h3>
    <p>目标：把“下载内容一致”“已知漏洞暴露”和“允许交付”分开判断。先预测，再逐步收集证据；改一个条件可以回退对照。</p>
    <p className="sec188-note">这是确定性教学模型，decoder 与 LAB-188-A 均为虚构。没有运行真实 govulncheck；真实分析需覆盖实际构建配置、入口与依赖。</p>
    <div className="sec188-grid"><fieldset><legend>构造依赖与使用方式</legend>
      <label>依赖版本<select value={config.version} onChange={e => change({version: e.target.value as Config['version']})}><option value="1.0">v1.0 · 教学公告影响版本</option><option value="1.1">v1.1 · 已修复该已知问题</option></select></label>
      <label>依赖来源<select value={config.source} onChange={e => change({source: e.target.value as Config['source']})}><option value="controlled">受控来源，已核验发布者</option><option value="unverified">新发布者，身份尚未核验</option></select></label>
      <Check label="下载校验和与 go.sum 匹配" value={config.checksum} onChange={value => change({checksum: value})}/>
      <Check label="保留 adapter → Decode 调用边" value={config.callEdge} onChange={value => change({callEdge: value})}/>
      <Check label="生产构建启用 legacy 标签" value={config.productionTag} onChange={value => change({productionTag: value})}/>
      <Check label="分析配置启用 legacy 标签" value={config.scanTag} onChange={value => change({scanTag: value})}/>
    </fieldset><fieldset><legend>可追踪的交付证据</legend>
      <Check label="有版本、标签与制品对应的构建记录" value={config.buildEvidence} onChange={value => change({buildEvidence: value})}/>
      <Check label="已审查版本差异和构建权限" value={config.review} onChange={value => change({review: value})}/>
      <Check label="生产配置兼容性测试通过" value={config.tests} onChange={value => change({tests: value})}/>
      <Check label="有经过验证的回退制品与路径" value={config.rollback} onChange={value => change({rollback: value})}/>
      <p>勾选表示向模型提供证据假设，不会替你执行审查、测试或部署。改条件会清空本轮推演，避免沿用旧结论。</p>
    </fieldset></div>
    <Prediction disabled={phase > 0} value={state.prediction} reason={state.reason} onValue={prediction => setState(s => ({...s, prediction}))} onReason={reason => setState(s => ({...s, reason}))}/>
    <div className="sec188-controls"><button type="button" data-security-action="step" disabled={!state.prediction || !state.reason.trim() || phase === 3} onClick={() => setState(step)}>单步收集证据</button><button type="button" data-security-action="back" disabled={!state.history.length} onClick={() => setState(back)}>回退一步</button><button type="button" data-security-action="reset" onClick={() => setState(createState())}>重置基线</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({phase, config, exposure: phase >= 2 ? result.exposure : 'pending', decision: phase === 3 ? result.decision : 'pending'})} className="sec188-live">
      <ol className="sec188-stages">{phases.map((name, index) => <li key={name} aria-current={index === phase ? 'step' : undefined}>{index + 1}. {name}</li>)}</ol>
      <div className="sec188-grid"><Path config={config}/><div aria-live="polite">
        <h4>当前证据：{phases[phase]}</h4>
        <p>版本 decoder v{config.version} · 生产 legacy={String(config.productionTag)} · 分析 legacy={String(config.scanTag)}</p>
        {phase >= 1 && <p className="sec188-evidence">E1 完整性：{config.checksum ? '匹配；只证明内容与预期一致，尚未证明代码安全。' : '不匹配；停止交付，调查下载内容及来源。'}</p>}
        {phase >= 2 && <><p className="sec188-evidence">E2 暴露判断：<strong>{labels[result.exposure]}</strong></p><p>你的预测：{labels[state.prediction as Exposure]}。{state.prediction === result.exposure ? '与模型一致，请核对证据路径。' : '与模型不同，请核对版本、调用边及生产/分析标签。'}理由：{state.reason}</p></>}
        {phase === 3 && <><p className="sec188-decision">E3 决策：{decisionLabels[result.decision]}</p><ul>{result.evidence.map(item => <li key={item}>{item}</li>)}</ul><p>即使证据齐全，也不承诺零风险；未知漏洞与来源变化仍需持续响应。</p></>}
        {phase === 0 && <p>下一步先核对校验和；它不会改变调用图，也不会消除漏洞。</p>}
        {phase === 1 && <p>下一步把公告影响版本与真实构建中的调用路径关联。</p>}
        {phase === 2 && <p>下一步把来源、审查、测试、回退证据汇总为交付判断。</p>}
      </div></div>
    </div>
  </section>;
}

export function Lesson188Help({mode}: {mode: 'example' | 'diagram' | 'steps' | 'try'}) {
  const [sealed, setSealed] = useState(true);
  const [recalled, setRecalled] = useState(true);
  const [config, setConfig] = useState<Config>({...initialConfig});
  const [reviewStep, setReviewStep] = useState(0);
  const [prediction, setPrediction] = useState<Exposure | ''>('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const [scenario, setScenario] = useState<'mismatch' | 'new-source'>('mismatch');
  const trial = scenario === 'mismatch' ? {...initialConfig, scanTag: false} : {...initialConfig, version: '1.1' as const, source: 'unverified' as const};
  const trialResult = assess(trial);
  return <section className="sec188 sec188-help" data-testid="security-help-188">
    {mode === 'example' && <><h4>类比：封条完好的召回零件</h4><p>封条对应下载内容一致；召回公告对应已知漏洞。两条证据回答不同问题。</p><Check label="包装封条与出厂记录一致" value={sealed} onChange={setSealed}/><Check label="此批次有召回公告" value={recalled} onChange={setRecalled}/><div className="sec188-analogy"><div>封条检查<strong>{sealed ? '包装未发现变化' : '包装异常，调查来源'}</strong></div><div>产品风险<strong>{recalled ? '召回风险仍然存在' : '没有这条已知召回记录'}</strong></div></div><p aria-live="polite">{sealed && recalled ? '反例成立：封条完好，仍然可能买到有缺陷的原装零件。' : !recalled ? '没有召回记录也不保证未知缺陷不存在。' : '包装异常与召回风险需要分别处理。'}类比不能替代软件的调用可达性分析。</p></>}
    {mode === 'diagram' && <><h4>动调用边，看关联证据</h4><Check label="连接 adapter → Decode" value={config.callEdge} onChange={callEdge => setConfig(s => ({...s, callEdge}))}/><Check label="同时在生产与分析启用 legacy" value={config.productionTag} onChange={productionTag => setConfig(s => ({...s, productionTag, scanTag: productionTag}))}/><div className="sec188-grid"><Path config={config}/><div aria-live="polite"><p>公告 LAB-188-A → decoder v1.0 → Decode</p><p>当前：<strong>{labels[exposure(config)]}</strong></p><p>{config.callEdge && config.productionTag ? '入口与受影响函数连通。校验和即使匹配，也不会切断这条路径。' : '图中调用边断开或生产标签关闭；只说明本模型当前构建不可达。恢复连接/标签即可检验反事实。'}</p></div></div></>}
    {mode === 'steps' && <><h4>为修复版组装交付证据</h4><p>固定条件：v1.1、受控来源、校验匹配、构建记录齐全。逐项提供证据，观察仍缺什么。</p><ol className="sec188-stages">{['审查升级差异', '运行兼容测试', '验证回退制品'].map((text, i) => <li key={text}>{i < reviewStep ? '已收集' : '待收集'}：{text}</li>)}</ol><div className="sec188-controls"><button type="button" disabled={reviewStep === 3} onClick={() => setReviewStep(n => n + 1)}>收集下一项证据</button><button type="button" disabled={!reviewStep} onClick={() => setReviewStep(n => n - 1)}>撤回上一项证据</button><button type="button" onClick={() => setReviewStep(0)}>重新组装</button></div><p aria-live="polite">{decisionLabels[assess({...initialConfig, version: '1.1', review: reviewStep >= 1, tests: reviewStep >= 2, rollback: reviewStep >= 3}).decision]}</p><p>{reviewStep < 3 ? `下一步：${['审查差异及构建权限', '用生产配置验证行为', '确认旧制品仍可部署且兼容'][reviewStep]}。升级版本本身没有提供这项证据。` : '本轮证据支持评审；后续仍要监测未知问题，回退也需评估旧版本风险。'}</p></>}
    {mode === 'try' && <><h4>换情境：先判断证据能支持什么</h4><label>新情境<select value={scenario} onChange={e => {setScenario(e.target.value as typeof scenario); setChecked(false); setPrediction(''); setReason('');}}><option value="mismatch">默认分析关闭 legacy，生产开启</option><option value="new-source">修复版本，但新发布者身份待核验</option></select></label><p>{scenario === 'mismatch' ? 'v1.0 存在调用边；默认配置报告没有调用，但生产制品启用了 legacy。校验和匹配。' : 'v1.1 不在教学公告影响范围内，校验和匹配；新发布者的账号身份尚未核验。'}</p><Prediction value={prediction} reason={reason} onValue={v => {setPrediction(v); setChecked(false);}} onReason={v => {setReason(v); setChecked(false);}}/><button type="button" disabled={!prediction || !reason.trim()} onClick={() => setChecked(true)}>验证新情境预测</button>{checked && <div className="sec188-evidence" aria-live="polite"><p>{prediction === trialResult.exposure ? '判断与证据一致。' : '需修正判断。'}实际支持：{labels[trialResult.exposure]}。</p><p>{scenario === 'mismatch' ? '缺口是分析配置没有覆盖生产配置，应按生产标签重做分析。不能沿用默认构建的不可达结论。' : '没有匹配已知公告不能证明发布者可信。应核验来源、审查差异并验证构建权限。'}</p><p>交付判断：{decisionLabels[trialResult.decision]}。你的理由：{reason}</p></div>}<p>这是本地练习，不计入独立掌握记录。</p></>}
  </section>;
}

