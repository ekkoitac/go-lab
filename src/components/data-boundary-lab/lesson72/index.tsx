import { useState } from 'react';
import { apply, decode, format, initialConfig, inputs, intended, request, resultKey, strategies, targetLabels, trace, type Config, type Frame, type Input, type Strategy, type Target } from './model';
import './style.css';
const choices = { keep: '保留旧额度', clear: '清除额度（不是 0）', zero: '设置为 0', value: '设置为 25' };
function Graph({ state, old }: { state: Frame; old: number }) {
  return <div className="db72-flow" data-testid="live-model" data-state={JSON.stringify(state)} aria-label="PATCH 请求到额度的状态流">
    <article data-active={state.phase === 0}><small>① 请求</small><strong>{state.request}</strong><span>用户提供的原文</span></article>
    <span className="db72-arrow" aria-hidden="true">↓ 解码</span>
    <article data-active={state.phase === 1 || state.phase === 2}><small>② 接收字段</small><strong>{state.decoded ? state.decoded.present !== null ? `present=${state.decoded.present} · null=${state.decoded.explicitNull}` : state.decoded.value === null ? 'Limit = nil' : `Limit = ${state.decoded.value}` : '等待初始化'}</strong><span>{state.decoded?.present ? `数字值：${state.decoded.value ?? '无'}` : '字段值和存在性是不同的信息'}</span></article>
    <span className="db72-arrow" aria-hidden="true">↓ 应用业务规则</span>
    <article data-active={state.phase === 3} data-result={state.applied ? String(state.result) : 'pending'}><small>③ 持久数据（模拟）</small><div className="db72-before-after"><span>旧值<b>{old}</b></span><span>当前<b>{format(state.result)}</b></span></div><span>{state.applied ? '更新规则已执行' : '尚未应用更新'}</span></article>
  </div>;
}
function Options({ config, change }: { config: Config; change: (c: Config) => void }) {
  return <div className="db72-options"><label>请求字段<select value={config.input} onChange={e => change({ ...config, input: e.target.value as Input })}>{Object.entries(inputs).map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label><label>接收与更新策略<select value={config.strategy} onChange={e => change({ ...config, strategy: e.target.value as Strategy })}>{Object.entries(strategies).map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label><label>解码目标初始化<select disabled={config.strategy === 'presence'} value={config.target} onChange={e => change({ ...config, target: e.target.value as Target })}>{Object.entries(targetLabels).map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label></div>;
}
function Boundary() { return <p className="db72-boundary">模型范围：encoding/json 的有效单字段整数请求；额度用“无额度”表示清除。null 的清除含义由本课业务约定，Go 不会自动执行。RawMessage map 每个请求新建；普通字段和指针支持预填旧值对照。错误输入与并发更新不在本实验范围内。</p>; }
export default function Lesson72() {
  const [config, setConfig] = useState<Config>(initialConfig), [step, setStep] = useState(0), [free, setFree] = useState(false);
  const [prediction, setPrediction] = useState(''), [reason, setReason] = useState(''), [locked, setLocked] = useState(false), [revision, setRevision] = useState('');
  const [baseline, setBaseline] = useState<{ config: Config; value: number | null } | null>(null);
  const frames = trace(config), state = frames[step];
  const change = (c: Config) => { setConfig(c); setStep(0); setPrediction(''); setReason(''); setLocked(false); setRevision(''); };
  const advance = () => { setLocked(true); setStep(Math.min(3, step + 1)); };
  return <section className="db72" data-testid="data-boundary-lab-72"><h3>PATCH 意图台：没填写，也要覆盖吗？</h3><p>旧额度为 100。比较请求、解码目标与更新规则：什么时候会保留、设为零或清除？</p>
    <div className="db72-actions"><button aria-pressed={!free} onClick={() => { setFree(false); change(config); }}>引导任务</button><button aria-pressed={free} onClick={() => { setFree(true); change(config); }}>自由实验</button></div>
    <Options config={config} change={change} />
    {!free && <fieldset disabled={locked}><legend>先预测当前策略实际会怎么做</legend><label>预测最终额度<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option>{Object.entries(choices).map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label><label>预测理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="字段是否出现？解码后还保留了哪些信息？" /></label></fieldset>}
    <div className="db72-actions"><button data-action="step" disabled={step === 3 || (!free && !locked && (!prediction || !reason.trim()))} onClick={advance}>{step === 0 && !free && !locked ? '记录预测并开始' : '单步执行'}</button><button data-action="back" disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button data-action="reset" onClick={() => { change(initialConfig); setBaseline(null); }}>重置实验</button><button disabled={!state.applied} onClick={() => setBaseline({ config: { ...config }, value: state.result })}>保存当前结果为基线</button></div>
    <p className="db72-status" role="status">步骤 {step}/3 · {state.stage}：{state.reason}</p><pre className="db72-code" aria-label="当前执行代码">{state.code}</pre><Graph state={state} old={config.old} />
    {baseline && <aside className="db72-baseline"><b>保留的基线</b><p>{request(baseline.config)} · {strategies[baseline.config.strategy]} · {targetLabels[baseline.config.target]}</p><p>基线结果：{format(baseline.value)} ｜ 本轮：{state.applied ? format(state.result) : '等待执行'}</p></aside>}
    {state.applied && <div className="db72-feedback"><strong>{free ? '实验结果' : prediction === resultKey(config) ? '预测吻合' : '预测需要修正'}：{format(state.result)}</strong><p>业务意图应为：{format(intended(config))}。{apply(config) === intended(config) ? '本次符合约定；请换一个输入检查边界。' : '本次未保留用户意图，请更换策略再验证。'}</p>{!free && <p>最初理由：{reason}</p>}<label>根据证据修正解释<textarea value={revision} onChange={e => setRevision(e.target.value)} placeholder="写出哪一步丢失了存在性，或为什么本次符合约定。" /></label>{revision.trim() && <p>本轮修正已记录在实验中；不计入正式测验成绩。</p>}</div>}<Boundary />
  </section>;
}
function IntentDiagram() {
  const [input, setInput] = useState<Input>('missing'), [intent, setIntent] = useState(''), [revealed, setRevealed] = useState(false);
  const expected = input === 'missing' ? 'keep' : input === 'null' ? 'clear' : 'set';
  const c = { ...initialConfig, input, strategy: 'presence' as const };
  return <><h4>三种更新指令</h4><p>先把请求连接到业务指令，再检查连接。零和非零都属于明确设置。</p><label>选择请求<select value={input} onChange={e => { setInput(e.target.value as Input); setRevealed(false); setIntent(''); }}>{Object.entries(inputs).map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label><div className="db72-intents">{Object.entries({ keep: '保留', clear: '清除', set: '设置' }).map(([v, s]) => <button key={v} aria-pressed={intent === v} onClick={() => { setIntent(v); setRevealed(false); }}>{s}</button>)}</div><button disabled={!intent} onClick={() => setRevealed(true)}>核对连接</button>{revealed && <><p role="status">{intent === expected ? '连接正确' : '请修正连接'}：{request(c)} → {expected === 'keep' ? '保留' : expected === 'clear' ? '清除' : '设置'}。</p><Graph state={trace(c)[3]} old={c.old} /></>}</>;
}
function FollowUpdate() {
  const [input, setInput] = useState<Input>('null'), [target, setTarget] = useState<Target>('fresh'), [phase, setPhase] = useState(0);
  return <><h4>追踪一次更新</h4><p>同一请求经过三种接收方式。将目标改为已有 100，观察 null 与缺失的区别。</p><label>共同请求<select value={input} onChange={e => { setInput(e.target.value as Input); setPhase(0); }}>{Object.entries(inputs).map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label><label>共同初始化<select value={target} onChange={e => { setTarget(e.target.value as Target); setPhase(0); }}>{Object.entries(targetLabels).map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label><div className="db72-actions"><button disabled={phase === 3} onClick={() => setPhase(phase + 1)}>推进共同步骤</button><button disabled={!phase} onClick={() => setPhase(phase - 1)}>回退共同步骤</button><button onClick={() => setPhase(0)}>重放</button></div><p role="status">共同步骤 {phase}/3；存在性 map 始终为新请求创建。</p><div className="db72-comparison">{(['plain', 'pointer', 'presence'] as Strategy[]).map(strategy => { const c = { ...initialConfig, input, target, strategy }, s = trace(c)[phase]; return <article key={strategy}><h5>{strategies[strategy]}</h5><Graph state={s} old={c.old} /><pre className="db72-code">{s.code}</pre><p>{s.reason}</p></article>; })}</div></>;
}
function Transfer() {
  const [strategy, setStrategy] = useState<Strategy>('plain'), [reason, setReason] = useState(''), [revealed, setRevealed] = useState(false), [hint, setHint] = useState(false), [attempts, setAttempts] = useState(0);
  const [first, setFirst] = useState<string | null>(null);
  const cases: Input[] = ['missing', 'null', 'zero'];
  return <><h4>保住未修改字段</h4><p>新场景：用户原额度 240。三个独立请求分别是 {'{}'}、{'{"Limit":null}'}、{'{"Limit":0}'}。选择一套策略，让它们分别保留、清除和设零。结果提交后才揭晓。</p><label>修复策略<select value={strategy} onChange={e => { setStrategy(e.target.value as Strategy); setRevealed(false); }}>{Object.entries(strategies).map(([v, s]) => <option key={v} value={v}>{s}</option>)}</select></label><label>修复依据<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="解释如何同时识别三个意图。" /></label><div className="db72-actions"><button disabled={!reason.trim() || revealed} onClick={() => { const ok = strategy === 'presence'; if (first === null) setFirst(`${hint ? '提示后首次提交' : '首次未提示提交'}：${ok ? '通过' : '需修正'}`); setAttempts(attempts + 1); setRevealed(true); }}>验证三个请求</button><button onClick={() => setHint(true)}>查看提示</button></div>{hint && <p className="db72-status">提示：在新目标里，int 的缺失与 0 合并；*int 的缺失与 null 合并。需要哪一条额外证据？</p>}{first && <p>{first} · 当前第 {attempts} 次尝试{hint ? '（已看提示）' : ''}。这是帮助内练习，不计正式掌握。</p>}{revealed && <><p role="status">{strategy === 'presence' ? '三个请求全部符合约定。' : '仍有请求丢失意图；根据下方证据更换策略后复验。'}</p><div className="db72-trial-results">{cases.map(input => { const c = { ...initialConfig, old: 240, input, strategy }, s = trace(c)[3]; return <article key={input}><Graph state={s} old={240} /><p>应得：{format(intended(c))} · {apply(c) === intended(c) ? '符合' : '不符合'}</p></article>; })}</div></>}</>;
}
export function Help({ mode }: { mode: string }) { return <section className="db72 db72-help" data-testid="data-boundary-help-72">{mode === 'diagram' ? <IntentDiagram /> : mode === 'steps' ? <FollowUpdate /> : <Transfer />}<Boundary /></section>; }
