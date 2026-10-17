import { useState } from 'react';
import { advance, configure, initial, inspect, intents, labels, outcome, presets, rewind, type LabState, type Strategy } from './model';
import './style.css';

function Comparison({ state, selected, onSelect }: { state: LabState; selected?: Strategy; onSelect?: (value: Strategy) => void }) {
  return <div className="arch113-comparison">{inspect(state).map(row => <article key={row.strategy} data-testid={'patch-' + row.strategy} className={selected === row.strategy ? 'arch113-selected' : ''}>
    {onSelect ? <button aria-pressed={selected === row.strategy} onClick={() => onSelect(row.strategy)}>{labels[row.strategy]}</button> : <h4>{labels[row.strategy]}</h4>}
    <dl><dt>解码所得</dt><dd>{state.phase >= 1 ? row.decoded : '等待解码'}</dd><dt>更新意图</dt><dd>{state.phase >= 2 ? intents[row.intent] : '等待判断'}</dd><dt>存储中的姓名</dt><dd><code>{JSON.stringify(row.stored)}</code></dd></dl>
    {state.phase === 3 && <p className={row.matches ? 'arch113-ok' : 'arch113-warning'}>{row.matches ? '符合本题契约' : '意图不符：契约要求' + intents[row.expected]}</p>}
  </article>)}</div>;
}
function Lab({ example = false, steps = false }: { example?: boolean; steps?: boolean }) {
  const fresh = () => initial(example ? { current: '周末读书会', payload: '{"name":null}' } : steps ? { current: 'Ada', payload: '{"name":""}' } : undefined);
  const [state, setState] = useState<LabState>(fresh);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  function change(payload: string) { setState(configure(state, { payload })); setPrediction(''); setReason(''); }
  const phaseNames = ['准备输入', '解码字段', '解释更新意图', '提交或拒绝'];
  return <>
    <h3>{example ? '读书会改名：删除名字与没改名字' : steps ? '跟随空字符串完成一次更新' : '一份 PATCH，三种解码方式'}</h3>
    <p>{example ? '组织者清空活动名称；比较省略 name 与明确发送 null，哪种表示能保留他的意图？' : '相同旧值、相同请求并排执行。修改输入后从解码重新开始；每步只表示一个教学阶段。'}</p>
    <div className="arch113-presets">{presets.map(p => <button key={p.label} aria-pressed={state.config.payload === p.payload} onClick={() => change(p.payload)}>{p.label}</button>)}</div>
    <label>请求 JSON<textarea value={state.config.payload} onChange={e => change(e.target.value)} spellCheck={false} /></label>
    <label>更新前姓名<input value={state.config.current} onChange={e => { setState(configure(state, { current: e.target.value })); setPrediction(''); setReason(''); }} /></label>
    {!example && !steps && <fieldset disabled={state.phase > 0}><legend>可选预测：零值方案会保留旧姓名吗？</legend><select aria-label="预测零值方案" value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">自由探索</option><option value="keep">会保留</option><option value="change">会改变</option></select><input aria-label="预测理由" value={reason} placeholder="写下依据（可选）" onChange={e => setReason(e.target.value)} /></fieldset>}
    <div data-testid="live-model" data-state={JSON.stringify(state)}><ol className="arch113-stages">{phaseNames.map((name, i) => <li key={name} aria-current={state.phase === i ? 'step' : undefined}>{i + 1}. {name}</li>)}</ol><Comparison state={state} /></div>
    <div className="arch113-actions"><button data-arch-action="back" disabled={state.phase === 0} onClick={() => setState(rewind(state))}>回退一步</button><button data-arch-action="step" disabled={state.phase === 3} onClick={() => setState(advance(state))}>{state.phase === 0 ? '解码请求' : state.phase === 1 ? '判断意图' : '提交更新'}</button><button data-arch-action="reset" onClick={() => { setState(fresh()); setPrediction(''); setReason(''); }}>重置实验</button></div>
    <div className="arch113-feedback" aria-live="polite"><strong>{phaseNames[state.phase]}</strong><p>{state.phase === 0 ? '先选请求，再推进解码；数据库仍保留原值。' : state.phase === 1 ? '零值解码丢失缺失与 null 的区别；新建指针字段中，两者都为 nil。存在性检查保留了额外信息。' : state.phase === 2 ? '本实验的零值方案总是赋值；指针方案在 nil 时跳过；存在性方案先检查键，再解释 null。错误类型在所有方案中拒绝。' : '比较意图和最终值：null 清空与设置空字符串的结果都为 ""，但操作意图不同。非法请求保留旧值，不能提交。'}</p>
    {state.phase === 3 && prediction && <p>你的预测：{prediction === 'keep' ? '会保留' : '会改变'}；实际：{outcome(state.config, 'zero').value === state.config.current ? '保留原值' : '值发生改变'}。理由：{reason || '未填写'}。值相等也不代表意图正确。</p>}</div>
    <p className="arch113-note">模型边界：每次解码使用新建的 Go 字段；null 清空是本题契约，其他 API 可有不同约定。忽略其他键，仅模拟 name；无真实数据库写入。</p>
  </>;
}
export default function Lesson113() { return <section className="arch113" data-testid="architecture-lab-113"><Lab /></section>; }
export function Help({ mode }: { mode: string }) { return <aside className="arch113 arch113-help" data-testid="architecture-help-113"><p>辅助理解 · 不计入独立掌握</p>{mode === 'example' ? <Lab key="example" example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Lab key="steps" steps /> : <Challenge />}</aside>; }
function Diagram() {
  const [payload, setPayload] = useState('{}');
  const [selected, setSelected] = useState<Strategy>('presence');
  const state = { ...initial({ current: 'Ada', payload }), phase: 3 };
  const row = outcome(state.config, selected);
  return <><h3>追踪字段信息在哪里丢失</h3><label>图中的请求<select value={payload} onChange={e => setPayload(e.target.value)}>{presets.map(p => <option key={p.label} value={p.payload}>{p.label}</option>)}</select></label><p>选择一种表示，追踪从请求到存储的路径。</p><Comparison state={state} selected={selected} onSelect={setSelected} /><div className="arch113-path" aria-live="polite"><code>{payload}</code><span>↓ {labels[selected]}</span><strong>{row.decoded}</strong><span>↓ 解释规则</span><strong>{intents[row.intent]}</strong><span>↓ {row.error ? '拒绝写入' : '执行更新'}</span><code>存储值 = {JSON.stringify(row.value)}</code></div><p>{selected === 'presence' ? '存在性和原始值共同决定路径：缺失走保留，null 走清空，字符串走设置。' : selected === 'pointer' ? 'nil 把缺失与 null 合并在同一节点，单凭该字段无法恢复发送者意图。' : '空字符串节点合并了缺失、null 和显式空字符串；赋值会把未发送的名字也覆盖。'}</p></>;
}
function Challenge() {
  const [variant, setVariant] = useState(0), [answer, setAnswer] = useState(''), [reason, setReason] = useState(''), [submitted, setSubmitted] = useState(false);
  const scenarios = [
    { text: '项目名称当前为“春季计划”。请求 {}，只修改了其他资料。name 应执行什么操作？', expected: 'keep', explanation: 'name 键没有提供，应保留“春季计划”。用零值直接赋值会错误清空；先检查键存在性。' },
    { text: '联系人别名当前为“小林”。请求 {"name":null}，本接口约定 null 清空。name 应执行什么操作？', expected: 'clear', explanation: '键已提供且值为 null，应显式清空。新建 *string 为 nil 也可能来自缺失，不能靠 nil 跳过更新；补上存在性判断。' },
    { text: '书签名称当前为“参考资料”。请求 {"name":""}，允许空字符串。name 应执行什么操作？', expected: 'set', explanation: '字段已提供且类型是字符串，应设置为空字符串。它与清空得到同样的值，却是不同的输入意图。' },
  ];
  const scenario = scenarios[variant];
  function reset(next = variant) { setVariant(next); setAnswer(''); setReason(''); setSubmitted(false); }
  return <><h3>判断一个新请求</h3><p>{scenario.text}</p><label>你的判断<select disabled={submitted} value={answer} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option>{Object.entries(intents).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label><label>判断理由<textarea disabled={submitted} value={reason} onChange={e => setReason(e.target.value)} placeholder="指出字段存在性与值的证据" /></label><button disabled={!answer || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交并看反馈</button>{submitted && <div className="arch113-feedback" data-testid="challenge-feedback" aria-live="polite"><strong>{answer === scenario.expected ? '操作判断正确' : '你的操作与契约不同：应' + intents[scenario.expected as keyof typeof intents]}</strong><p>{scenario.explanation}</p><p>你的理由：{reason}</p><p>仅核对操作选择；请自己对照证据检查理由，没有自动评价理由或记录掌握分。</p></div>}<div className="arch113-actions"><button onClick={() => reset()}>重试本题</button><button onClick={() => reset((variant + 1) % scenarios.length)}>换一个情境</button></div></>;
}

