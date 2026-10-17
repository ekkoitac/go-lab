import {useState} from 'react';
import {budget, faultNames, initialConfig, layerNames, layers, snapshot, transactionFrame, type Config, type Fault, type Layer} from './model';
import './style.css';
const statusNames = {pass: '通过', fail: '失败', skipped: '未运行'};
const faults = Object.keys(faultNames) as Fault[];
function toggle<T>(list: T[], item: T) { return list.includes(item) ? list.filter(value => value !== item) : [...list, item]; }
export default function Lesson191() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [step, setStep] = useState(0);
  const [baseline, setBaseline] = useState<ReturnType<typeof snapshot> | null>(null);
  const [prediction, setPrediction] = useState('');
  const state = snapshot(config, step);
  function configure(next: Config) { setConfig(next); setStep(0); setPrediction(''); setBaseline(null); }
  function repair() { setBaseline(snapshot(config, 3)); setConfig({...config, faults: []}); setStep(0); }
  return <section className="lesson191" data-testid="delivery-lab-191">
    <h3>支付测试证据台</h3>
    <p>目标：找到“全绿却漏掉重复支付”的原因，再补齐能观察它的测试。每步运行一道边界，观察到什么由用例与依赖决定。</p>
    <div className="l191-config">
      <fieldset><legend>注入缺陷</legend>{faults.map(fault => <label key={fault}><input type="checkbox" checked={config.faults.includes(fault)} onChange={() => configure({...config, faults: toggle(config.faults, fault)})}/>{faultNames[fault]}</label>)}</fieldset>
      <fieldset><legend>构建测试组合</legend>{layers.map(layer => <label key={layer}><input type="checkbox" checked={config.layers.includes(layer)} onChange={() => configure({...config, layers: toggle(config.layers, layer)})}/>{layerNames[layer]}</label>)}<label><input type="checkbox" checked={config.realDependencies} onChange={event => configure({...config, realDependencies: event.target.checked})}/>集成用例连接真实约束模型</label></fieldset>
    </div>
    <label className="l191-predict">先预测：这组测试能否发现所有注入缺陷？<select value={prediction} onChange={event => setPrediction(event.target.value)} disabled={step > 0}><option value="">选择后再验证</option><option value="yes">能发现全部</option><option value="no">仍有缺陷逃逸</option><option value="none">当前没有注入缺陷</option></select></label>
    <div className="l191-actions"><button data-delivery-action="step" disabled={step === 3 || !prediction} onClick={() => setStep(step + 1)}>{step === 3 ? '本轮已完成' : `单步：${layerNames[layers[step]]}`}</button><button data-delivery-action="back" disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button data-delivery-action="reset" onClick={() => {setStep(0);setPrediction('');setBaseline(null);}}>重置本轮</button><button disabled={step !== 3 || !config.faults.length} onClick={repair}>修复缺陷，保留测试作对照</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({config, ...state})} className="l191-live">
      <div className="l191-metrics"><span>进度 <b>{step}/3</b></span><span>反馈成本 <b>{state.cost} 单位</b></span><span>已发现 <b>{state.detected.length} 类</b></span></div>
      <ol className="l191-evidence">{layers.map((layer, index) => {const evidence = state.evidence[index];return <li key={layer} className={evidence?.status ?? 'pending'}><strong>{layerNames[layer]} · {evidence ? statusNames[evidence.status] : '待执行'}</strong><p>{evidence?.detail ?? '单步运行后，在这里显示输入、结果与边界证据。'}</p>{evidence && <small>本次可观察：{evidence.observed.map(fault => faultNames[fault]).join('、') || '无真实风险边界'}</small>}</li>;})}</ol>
      <p className="l191-result" aria-live="polite">尚无证据覆盖：{state.unknown.map(fault => faultNames[fault]).join('、') || '本模型的三类风险都有对应证据'}。{step === 3 && <> 本轮注入缺陷 {config.faults.length} 类、发现 {state.detected.length} 类。你的预测“{prediction === 'yes' ? '能发现全部' : prediction === 'no' ? '仍有缺陷逃逸' : '没有注入缺陷'}”{(prediction === 'none' ? !config.faults.length : prediction === 'yes' ? config.faults.length > 0 && state.detected.length === config.faults.length : state.detected.length < config.faults.length) ? '与结果一致' : '需要修正'}；优先给漏掉的边界增加对应输入和真实依赖。</>}</p>
      {baseline && <p className="l191-result">修复前（同一测试组合）：{baseline.detected.map(fault => faultNames[fault]).join('、') || '没有发现缺陷'}，成本 {baseline.cost}；修复后当前：发现 {state.detected.length} 类，成本 {state.cost}。未覆盖的边界仍需补证据。</p>}
    </div>
    <small>教学边界：这里模拟依赖语义，不启动数据库或浏览器。成本 1/8/30 是相对示例，不是实测秒数或通用比例。端到端用例仅首次支付，不能替代重复请求测试；提交后发送也仍需处理发送失败，真实系统可用事务发件箱。本实验不记为独立掌握。</small>
  </section>;
}
function Example() {
  const [counts, setCounts] = useState([20, 0, 0]);
  const result = budget(...counts as [number, number, number]);
  return <><h4>案例：把反馈成本花在不同风险上</h4><p>已有 20 个金额分支。现在还需验证数据库约束及部署路由。拖动数量，比较新增测试带来的证据类别。</p>{['金额分支单测', '真实约束集成用例', '关键旅程'].map((label, index) => <label className="l191-range" key={label}>{label}：{counts[index]}<input type="range" min="0" max={index ? 10 : 40} value={counts[index]} onChange={event => setCounts(counts.map((count, at) => at === index ? Number(event.target.value) : count))}/></label>)}<div className="l191-metrics"><span>总成本 <b>{result.cost}</b></span><span>参考预算 <b>60</b></span></div><ul><li>局部规则：{result.local ? '有对应测试' : '缺少快速分支反馈'}</li><li>数据库约束：{result.constraints ? '有真实边界用例' : '没有证据；增加单测数量不会补齐'}</li><li>部署旅程：{result.deployment ? '有关键链路用例' : '没有部署组合证据'}</li></ul><p aria-live="polite">{result.cost > 60 ? '超过示例预算：尝试保留少量关键旅程，把局部细节放到单测。' : '仍在示例预算内；检查三类风险是否各有对应输入。'}数量只代表投入，不能证明用例质量或覆盖完整。</p></>;
}
const mapNodes = ['用户界面', '网关', '金额规则', '数据库', '消息系统'];
const mapEdges = [{from:0,to:1,label:'支付请求'},{from:1,to:2,label:'路由'},{from:2,to:3,label:'事务写入'},{from:3,to:4,label:'提交成功才发布'}];
function Diagram() {
  const [selected, setSelected] = useState(3);
  const [scope, setScope] = useState<Layer>('integration');
  const included = scope === 'unit' ? [2] : scope === 'integration' ? [2,3,4] : [0,1,2,3,4];
  const related = mapEdges.filter(edge => edge.from === selected || edge.to === selected);
  return <><h4>探索：一条连线就是一道协议边界</h4><div className="l191-actions">{layers.map(layer => <button key={layer} aria-pressed={scope === layer} onClick={() => setScope(layer)}>{layerNames[layer].split('：')[0]}</button>)}</div><div className="l191-network">{mapNodes.map((node,index) => <div key={node}><button aria-pressed={selected === index} className={included.includes(index) ? 'in-scope' : 'outside'} onClick={() => setSelected(index)}>{node}<small>{included.includes(index) ? '参与本层测试' : '本层外部 / 替身'}</small></button>{index < 4 && <div className={related.some(edge => edge.from === index) ? 'l191-edge active' : 'l191-edge'}>↓ {mapEdges[index].label}</div>}</div>)}</div><div className="l191-result"><strong>{mapNodes[selected]} 的关联路径</strong>{related.map(edge => <p key={edge.from}>{mapNodes[edge.from]} → {mapNodes[edge.to]}：{edge.label}。{included.includes(edge.from) && included.includes(edge.to) ? '位于当前测试范围；仍需构造触发它的输入。' : '跨越替身边界，真实语义未执行。'}</p>)}</div><p>图中的箭头表示依赖/提交条件，不表示测试必须按这五个节点串行执行。集成用例绕过界面和网关，端到端经过它们，但首次支付仍不会触发重复键冲突。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [afterCommit, setAfterCommit] = useState(false);
  const state = transactionFrame(afterCommit, step);
  return <><h4>分步：为什么数据库回滚收不回消息？</h4><label><input type="checkbox" checked={afterCommit} onChange={event => {setAfterCommit(event.target.checked);setStep(0);}}/>修复：提交成功才允许发消息</label><div className="l191-actions"><button disabled={step === 3} onClick={() => setStep(step + 1)}>执行下一事件</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>回到上一事件</button><button onClick={() => setStep(0)}>重放</button></div><div className="l191-metrics"><span>数据库订单 <b>{state.rows}</b></span><span>已发送消息 <b>{state.messages}</b></span><span>唯一约束 <b>{state.rejected ? '已拒绝' : '未执行'}</b></span></div><p className="l191-result" aria-live="polite">{step}/3 · {state.detail}</p><p>这里隔离“重复键失败”这一事件，未模拟发送丢失或进程崩溃。修复后消息数不增加，是失败事务没有产生消息的证据。</p></>;
}
function Try() {
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return <><h4>新情境：库存扣减为什么仍会超卖？</h4><p>库存规则单测全绿，网页首次购买旅程也通过。两位用户同时购买最后一件商品时出现超卖。测试库的隔离级别与生产不同。你优先补哪项证据？</p><fieldset disabled={submitted}><legend>提交前不会揭晓判断</legend>{[['unit','再复制 100 个顺序单测'],['integration','用生产相同的隔离配置，集成并发扣减并检查库存不变量'],['e2e','重复运行首次购买端到端，保持每次只有一个用户']].map(([value,label]) => <label key={value}><input type="radio" name="l191-transfer" value={value} checked={answer === value} onChange={() => setAnswer(value)}/>{label}</label>)}</fieldset><label className="l191-predict">理由：指出缺失的边界和要观察的不变量<textarea value={reason} disabled={submitted} onChange={event => setReason(event.target.value)} placeholder="说明输入、依赖配置与应保持的结果"/></label><div className="l191-actions"><button disabled={!answer || reason.trim().length < 8 || submitted} onClick={() => setSubmitted(true)}>提交判断与理由</button><button onClick={() => {setAnswer('');setReason('');setSubmitted(false);}}>重新作答（已看提示）</button></div>{submitted && <div className="l191-result" role="status"><strong>{answer === 'integration' ? '选择匹配故障边界。' : '当前用例仍未触发真实并发边界。'}</strong><p>需要生产相同隔离语义下的两个并发请求，验证最多一个成功、库存不为负。重点是输入与真实依赖；仅增加数量或“端到端”名称不能自动覆盖它。</p><p>你的理由：{reason}</p><p>自查是否包含“真实隔离配置、并发输入、库存不变量”。这里只反馈选择，不自动判定自由文本推理正确；本地练习不写入掌握记录。</p></div>}</>;
}
export function Help({mode}: {mode: string}) { return <section className="lesson191" data-testid="delivery-help-191">{mode === 'example' ? <Example/> : mode === 'diagram' ? <Diagram/> : mode === 'steps' ? <Steps/> : <Try/>}</section>; }

