import { useState } from 'react';
import { initial, inspect, repair, returnCode, contractCases, type Config, type CallOutcome } from './model';
import './style.css';
const stages = ['准备指针', '返回到接口', '比较 nil', '调用分支'];
function View({ config, step }: { config: Config; step: number }) {
  const r = inspect(config);
  return <div className="t24-model" data-testid="live-model" data-state={JSON.stringify({ ...config, step, slots: step > 0 ? r.slots : 'pending', call: step === 3 ? r.call : 'pending' })}>
    <ol className="t24-stages">{stages.map((s, i) => <li key={s} aria-current={step === i ? 'step' : undefined}>{i + 1}. {s}</li>)}</ol>
    <div className="t24-flow"><article><small>来源：*Problem 指针</small><strong>{config.source === 'empty' ? 'p = nil' : 'p → 对象 A'}</strong>{config.source === 'problem' && <span>A.Msg = 磁盘已满</span>}</article><span aria-hidden="true">→</span><article><small>error 的动态类型槽</small><strong>{step === 0 ? '等待返回' : r.slots.type ?? '无动态类型'}</strong></article><article><small>error 的动态值槽</small><strong>{step === 0 ? '等待返回' : r.slots.value === 'object' ? '指针 → 对象 A' : r.slots.value === 'nil' ? '(*Problem)(nil)' : '无动态值'}</strong></article></div>
    <div className="t24-result"><span>err == nil：<strong>{step < 2 ? '待比较' : String(r.isNil)}</strong></span><span>调用方：<strong>{step < 3 ? '待执行' : r.output}</strong></span></div>
    <p aria-live="polite">{step === 0 ? '尚未返回：接口槽未展示，先判断返回表达式会带来什么。' : step === 1 ? (r.isNil ? '执行 return nil：接口中没有装入具体类型和值。' : '执行 return p：从表达式静态类型 *Problem 得到类型槽；值槽来自 p。') : step === 2 ? (r.isNil ? '类型槽和值槽都为空，所以比较为 true。' : '类型槽存在，所以比较为 false；指针为空不会抹掉动态类型。') : r.explanation}</p>
  </div>;
}
function Controls({ config, change }: { config: Config; change: (next: Config) => void }) {
  return <div className="t24-controls"><label>实际检查结果<select value={config.source} onChange={e => change({ ...config, source: e.target.value as Config['source'] })}><option value="empty">没有错误：p 为 nil</option><option value="problem">真实错误：p 指向 Problem</option></select></label><label>函数返回策略<select value={config.policy} onChange={e => change({ ...config, policy: e.target.value as Config['policy'] })}><option value="pointer">直接 return p</option><option value="guard">p 为 nil 时 return nil，否则 return p</option><option value="discard">总是 return nil</option></select></label><label>Error 方法实现<select value={config.method} onChange={e => change({ ...config, method: e.target.value as Config['method'] })}><option value="constant">返回常量，不解引用 p</option><option value="dereference">读取 p.Msg，解引用 p</option></select></label></div>;
}
function Code({ config }: { config: Config }) { return <pre>{`type Problem struct { Msg string }\nfunc (p *Problem) Error() string {\n  return ${config.method === 'constant' ? '"problem"' : 'p.Msg'}\n}\nfunc check() error {\n  ${config.source === 'empty' ? 'var p *Problem' : 'p := &Problem{Msg: "磁盘已满"}'}\n  ${returnCode(config.policy)}\n}\nerr := check()\nif err != nil { _ = err.Error() }`}</pre>; }
export default function Lab() {
  const [config, setConfig] = useState<Config>(initial);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [call, setCall] = useState<CallOutcome | ''>('');
  const [reason, setReason] = useState('');
  const [baseline, setBaseline] = useState<Config | null>(null);
  const r = inspect(config);
  function clear() { setStep(0); setPrediction(''); setCall(''); setReason(''); }
  function change(next: Config) { setConfig(next); clear(); }
  return <section className="types-24" data-testid="types-lab-24"><header><p className="t24-kicker">接口里的两个槽</p><h3>指针为空，错误接口就为空吗？</h3><p>装入同一个指针，追踪返回、比较与调用。改变返回策略，再检查修复有没有吞掉真实错误。</p></header><Controls config={config} change={change} /><Code config={config} /><View config={config} step={step} />
    <fieldset disabled={step > 0}><legend>在执行前记录两个预测</legend><label>err == nil 的结果<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="true">true</option><option value="false">false</option></select></label><label>调用方最终行为<select value={call} onChange={e => setCall(e.target.value as CallOutcome)}><option value="">请选择</option><option value="skipped">跳过 Error()</option><option value="returned">Error() 正常返回</option><option value="panic">Error() 内 panic</option></select></label><label>预测理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="区分指针、接口动态类型与方法里的解引用" /></label></fieldset>
    <div className="t24-buttons"><button disabled={step === 3 || !prediction || !call || !reason.trim()} onClick={() => setStep(step + 1)}>{step === 0 ? '提交预测并执行返回' : step === 1 ? '执行 nil 比较' : '执行调用分支'}</button><button disabled={!step} onClick={() => setStep(step - 1)}>回退一步</button><button onClick={() => { change(initial); setBaseline(null); }}>重置实验</button></div>
    {step === 3 && <div className="t24-feedback" aria-live="polite"><strong>{prediction === String(r.isNil) && call === r.call ? '两项预测吻合。' : '结果与预测有差异，请对照两个槽和 Error 方法。'}</strong><p>你的理由：{reason}</p><p>{r.contract ? '返回契约成立：没有错误时接口为空，有真实错误时接口非空。' : config.source === 'problem' ? '这次虽然不 panic，却把真实错误吞掉了。需要保留非 nil 的 p。' : '没有实际错误却进入错误分支：typed nil 被装入接口。'}</p><button onClick={() => { setBaseline(config); change(repair(config)); }}>保留对照，修复返回契约后再验证</button></div>}
    {baseline && <aside className="t24-feedback"><strong>已保存的修复前快照</strong><p>原来源：{baseline.source === 'empty' ? '无错误，p 为 nil' : '真实 Problem'}；原方法：{baseline.method === 'constant' ? '不解引用' : '读取 p.Msg'}。{config.source !== baseline.source || config.method !== baseline.method ? '当前来源或方法已改变，下面同时包含这些条件的影响。' : '来源与方法保持相同，只对照返回策略。'}</p><p>原策略：{returnCode(baseline.policy)} → err == nil 为 {String(inspect(baseline).isNil)}，{inspect(baseline).output}。</p><p>当前策略：{returnCode(config.policy)}；{step === 3 ? `err == nil 为 ${r.isNil}，${r.output}` : '先完成新预测，再观察结果。'}</p></aside>}
    <p className="t24-boundary">模型边界：双槽表达接口语义，不承诺 Go 运行时内存布局。只模拟这里的 *Problem 和两种 Error 实现；nil 接收者不必然 panic。本实验和帮助都是辅助探索，不写入独立掌握成绩。</p>
  </section>;
}
function Example() {
  const [config, setConfig] = useState<Config>(initial);
  return <><h4>信封类比：有标签的空卡与空接口</h4><p>把 error 看作“类型标签＋内容”。取出内容发现空指针，不会自动清掉类型标签。</p><Controls config={config} change={setConfig} /><View config={config} step={3} /><p>改变 Error 实现，观察同一个 typed nil 可以返回常量，也可以在解引用时 panic。类比不代表接口真的分配了一只信封。</p></>;
}
function Diagram() {
  const [choice, setChoice] = useState('typed');
  const config: Config = { source: choice === 'object' ? 'problem' : 'empty', policy: choice === 'nil' ? 'guard' : 'pointer', method: 'constant' };
  return <><h4>搭建合法的双槽组合</h4><p>通过 Go 返回表达式装配接口；两个槽不能随意拼成“没有类型却有对象”。</p><div className="t24-buttons">{[['nil', '装入 nil 接口'], ['typed', '装入 (*Problem)(nil)'], ['object', '装入 &Problem{}']].map(([id, label]) => <button key={id} aria-pressed={choice === id} onClick={() => setChoice(id)}>{label}</button>)}</div><View config={config} step={3} /><p>找反例：值槽同样像“空”，哪一种仍然通过 err != nil 分支？观察类型槽是否保留。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [dereference, setDereference] = useState(false);
  const config: Config = { ...initial, method: dereference ? 'dereference' : 'constant' };
  return <><h4>单步分叉：panic 到底发生在哪？</h4><p>固定 return p 与 nil 指针，只改变方法体；先返回、再比较、最后调用。</p><label><input type="checkbox" checked={dereference} onChange={e => { setDereference(e.target.checked); setStep(0); }} />让 Error 读取 p.Msg</label><Code config={config} /><View config={config} step={step} /><div className="t24-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>重新推演</button></div></>;
}
function Transfer() {
  const [policy, setPolicy] = useState<Config['policy']>('pointer');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const config: Config = { ...initial, policy, method: 'dereference' };
  return <><h4>修复挑战：既不能误报，也不能吞错</h4><p>同一函数要通过两组输入：无错误时成功；有真实 Problem 时返回错误。选策略，说明理由，再运行两组契约检查。</p><label>选择补丁<select value={policy} onChange={e => { setPolicy(e.target.value as Config['policy']); setChecked(false); setReason(''); }}><option value="pointer">return p</option><option value="discard">总是 return nil</option><option value="guard">p == nil 时 return nil，否则 return p</option></select></label><label>为什么能兼顾两条路径？<textarea rows={2} value={reason} onChange={e => { setReason(e.target.value); setChecked(false); }} /></label><div className="t24-buttons"><button disabled={!reason.trim() || checked} onClick={() => setChecked(true)}>运行两组契约检查</button><button onClick={() => { setChecked(false); setReason(''); }}>重新判断</button></div><div data-testid="live-model" data-state={`${policy}:${checked}`} aria-live="polite">{checked && contractCases(config).map(r => <article className="t24-feedback" key={r.source}><strong>{r.source === 'empty' ? '无错误输入' : '真实错误输入'}：{r.contract ? '契约通过' : '契约失败'}</strong><p>类型槽：{r.slots.type ?? '无'}；值槽：{r.slots.value ?? '无'}；err == nil：{String(r.isNil)}。</p><p>{r.output}。{!r.contract && (r.source === 'empty' ? '修复方向：nil 指针不能直接装入 error。' : '修复方向：不要丢弃真实错误对象。')}</p></article>)}</div></>;
}
export function Help({ mode }: { mode: string }) { return <section className="types-24 t24-help" data-testid="types-help-24">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="t24-boundary">辅助探索与修复练习不计入独立掌握成绩。</p></section>; }
