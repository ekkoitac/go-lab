import {useState} from 'react';
import {compare, initialConfig, initialState, inputFor, measure, nextStep, scopeFeedback, type Config, type Placement} from './model';
import './style.css';
const placements: {value: Placement; label: string}[] = [
  {value: 'inside', label: '每轮生成输入 + 求和'},
  {value: 'outside-counted', label: '循环前生成，但不重置计时'},
  {value: 'outside-reset', label: '循环前生成，再 ResetTimer'},
];
function ScopeSelect({value, onChange}: {value: Placement; onChange: (value: Placement) => void}) {
  return <label>方案 B 的准备位置<select value={value} onChange={e => onChange(e.target.value as Placement)}>{placements.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>;
}
function Meter({title, result}: {title: string; result: ReturnType<typeof measure>}) {
  return <article className="l87-meter"><h4>{title}</h4><div className="l87-bars"><span style={{flex: result.setupUnits || .01}} className="l87-setup">准备 {result.setupUnits}</span><span style={{flex: result.workUnits || .01}} className="l87-work">求和 {result.workUnits}</span></div><dl><div><dt>已执行轮次</dt><dd>{result.executed}</dd></div><div><dt>计时内总教学成本</dt><dd>{result.totalUnits} 单位</dd></div><div><dt>每轮平均教学成本</dt><dd>{result.averageUnits === null ? '—' : result.averageUnits.toFixed(2)}</dd></div><div><dt>计时内模拟分配次数</dt><dd>{result.allocations ?? '未开启报告'}</dd></div><div><dt>被消费的结果 sink</dt><dd>{result.sink ?? '尚无'}</dd></div></dl></article>;
}
export default function Lab() {
  const [state, setState] = useState(initialState);
  const [goal, setGoal] = useState<'sum' | 'end-to-end'>('sum');
  const {config, step} = state;
  const results = compare(config, step);
  const done = step === config.rounds + 1;
  const update = (patch: Partial<Config>) => setState(initialState({...config, ...patch}));
  return <section className="l87" data-testid="testing-lab-87"><h3>给基准测试划定计时范围</h3><p>两条轨道使用相同输入和相同求和函数。改变准备位置，观察计时范围如何改变结论。</p><p className="l87-note">教学模型：生成一个元素成本 4 单位，求和一个元素成本 1 单位；生成数组算 1 次分配。数字不是实测 ns/op、B/op 或 allocs/op，也不模拟编译优化与机器波动。</p><div className="l87-controls"><label>测量问题<select value={goal} onChange={e => {setGoal(e.target.value as typeof goal);setState(initialState(config));}}><option value="sum">同一输入上，求和本身成本多少？</option><option value="end-to-end">每次生成新输入再求和，成本多少？</option></select></label><label>相同输入长度<select value={config.size} onChange={e => update({size: Number(e.target.value)})}><option value="4">4 个元素</option><option value="8">8 个元素</option></select></label><ScopeSelect value={config.placement} onChange={placement => update({placement})}/><label><input type="checkbox" checked={config.consume} onChange={e => update({consume: e.target.checked})}/>B 消费结果：sink = sum(xs)</label><label><input type="checkbox" checked={config.reportAllocs} onChange={e => update({reportAllocs: e.target.checked})}/>ReportAllocs：显示分配证据</label></div><p>输入固定为 [{inputFor(config.size).join(', ')}]；教学运行 b.N = {config.rounds}，真实 b.N 由基准框架调整。</p><fieldset disabled={step > 0}><legend>运行前留下预测与理由</legend><label>B 的计时成本与 A 相比<select value={state.prediction} onChange={e => setState({...state, prediction: e.target.value})}><option value="">请选择</option><option value="less">更少</option><option value="same">相同</option></select></label><label>依据哪些工作被计入？<input value={state.reason} onChange={e => setState({...state, reason: e.target.value})} placeholder="例如：输入准备会执行几次？"/></label></fieldset><div className="l87-actions"><button data-testing-action="step" disabled={!state.prediction || !state.reason.trim() || done} onClick={() => setState(nextStep(state))}>{step === 0 ? '提交预测，执行准备阶段' : done ? '本轮比较已完成' : `执行第 ${step} 次求和`}</button><button data-testing-action="reset" onClick={() => {setState(initialState());setGoal('sum');}}>恢复基线</button></div><div data-testid="live-model" data-state={JSON.stringify({step, config, goal, sink: results.candidate.sink})} aria-live="polite"><p className="l87-state">{step === 0 ? '等待预测：计时器尚未执行。' : step === 1 ? '准备阶段结束：B 若调用 ResetTimer，准备时间和分配计数都从测量中清除。A 将在每轮重新准备。' : `已完成 ${results.candidate.executed} / ${config.rounds} 轮；每轮都对同样的数值求和。`}</p><div className="l87-compare"><Meter title="A · 每轮准备并消费结果" result={results.baseline}/><Meter title="B · 你配置的计时范围" result={results.candidate}/></div>{step > 1 && !config.consume && <p className="l87-warning">B 丢弃了结果。图中仍列出源代码规定的教学工作量；实际编译器可能优化，不能把这里的数字当作有效性能结论。</p>}{done && <div className="l87-feedback"><p>你的预测：{state.prediction === 'less' ? 'B 更少' : '两者相同'}。理由：{state.reason}</p><p>模型观察：B {results.candidate.totalUnits < results.baseline.totalUnits ? '更少' : '与 A 相同'}。差异来自计入的准备次数，不代表求和算法变快。</p><p>{scopeFeedback(config, goal)}</p><p>真实报告的 ns/op 表示每次操作耗时，B/op 和 allocs/op 分别表示每次操作的分配字节和次数；需多轮实测并记录环境。本模块不记录掌握成绩。</p></div>}</div></section>;
}
function Example() {
  const [includeShoes, setIncludeShoes] = useState(false);
  return <><h4>跑一圈：系鞋带该不该计时？</h4><label><input type="checkbox" checked={includeShoes} onChange={e => setIncludeShoes(e.target.checked)}/>问题改为“每次从穿鞋到跑完”的总成本</label><div className="l87-flow" data-testid="live-model" data-state={String(includeShoes)}><span className={includeShoes ? 'active' : ''}>系鞋带 · 8 单位</span><span className="active">跑一圈 · 4 单位</span><strong>本次计时：{includeShoes ? 12 : 4} 教学单位</strong></div><p>{includeShoes ? '端到端目标包含准备；每次系鞋带是目标工作，排除它会漏测。' : '只比较跑步阶段时，系鞋带在计时外；对应先准备 xs，再 ResetTimer。'}</p><p>类比边界：这里只解释测量范围；不把跑步数字对应为 CPU 耗时。</p></>;
}
function Diagram() {
  const [placement, setPlacement] = useState<Placement>('outside-counted');
  const config = {...initialConfig, placement};
  const result = measure(config, 4);
  return <><h4>移动计时边界，联动代码与成本</h4><ScopeSelect value={placement} onChange={setPlacement}/><div className="l87-flow" data-testid="live-model" data-state={placement}><span className={placement !== 'outside-reset' ? 'active' : ''}>准备 {placement === 'inside' ? '× b.N' : '× 1'}</span><span className="active">求和 × b.N</span><span className="active">sink 消费结果</span></div><pre>{placement === 'inside' ? 'b.ReportAllocs()\nfor i := 0; i < b.N; i++ {\n  xs := makeInput()\n  sink = sum(xs)\n}' : `xs := makeInput()\nb.ReportAllocs()\n${placement === 'outside-reset' ? 'b.ResetTimer()' : '// 未重置：一次准备仍被计入'}\nfor i := 0; i < b.N; i++ {\n  sink = sum(xs)\n}`}</pre><p>填色表示计时范围。总教学成本 = 准备 {result.setupUnits} + 求和 {result.workUnits} = {result.totalUnits}；计时内模拟分配 {result.allocations} 次。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [reset, setReset] = useState(true);
  const result = measure({...initialConfig, placement: reset ? 'outside-reset' : 'outside-counted'}, step);
  return <><h4>追踪一次传统 b.N 基准调用</h4><label><input type="checkbox" checked={reset} onChange={e => {setReset(e.target.checked);setStep(0);}}/>准备后调用 ResetTimer</label><ol><li>准备数组：建立 4 个元素。</li><li>ReportAllocs 请求报告分配；ResetTimer 清除已累计时间与分配计数。</li><li>循环 b.N 次，每次求和并赋给 sink。</li><li>框架按操作次数报告指标；实际可能多次调用基准来调整 b.N。</li></ol><div data-testid="live-model" data-state={`${reset}-${step}`}><Meter title={step === 0 ? '还未执行' : step === 1 ? '准备阶段已执行' : `求和执行 ${step - 1} 次`} result={result}/></div><div className="l87-actions"><button data-testing-action="step" disabled={step === 4} onClick={() => setStep(step + 1)}>执行下一阶段</button><button data-testing-action="reset" onClick={() => setStep(0)}>重新追踪</button></div></>;
}
function Try() {
  const [placement, setPlacement] = useState<Placement>('outside-reset');
  const [reason, setReason] = useState('');
  const [reveal, setReveal] = useState(false);
  const config = {...initialConfig, size: 8, rounds: 2, placement};
  return <><h4>换个目标：每次请求都需要重新生成 8 项数据</h4><p>要评估“生成输入 + 求和”的端到端成本。选择准备位置，先解释，再运行。此处为新条件练习，不计掌握成绩。</p><ScopeSelect value={placement} onChange={value => {setPlacement(value);setReveal(false);setReason('');}}/><label>这个计时范围为何符合目标？<input value={reason} onChange={e => {setReason(e.target.value);setReveal(false);}}/></label><div className="l87-actions"><button data-testing-action="step" disabled={!reason.trim()} onClick={() => setReveal(true)}>运行新条件</button><button data-testing-action="reset" onClick={() => {setPlacement('outside-reset');setReason('');setReveal(false);}}>重试</button></div><div data-testid="live-model" data-state={`${placement}-${reveal}`}>{reveal ? <><Meter title="2 次请求的教学模型" result={measure(config, 3)}/><p>{scopeFeedback(config, 'end-to-end')}</p><p>每次请求都准备时应计入 2 次准备，而你当前计入 {measure(config, 3).allocations} 次分配。可修改范围重新验证。</p></> : <p>结果未揭示，先说明你的测量范围。</p>}</div></>;
}
export function Help({mode}: {mode: string}) {
  return <section className="l87 l87-help" data-testid="testing-help-87">{mode === 'example' ? <Example/> : mode === 'diagram' ? <Diagram/> : mode === 'steps' ? <Steps/> : <Try/>}</section>;
}
