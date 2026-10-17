import { useState } from 'react';
import { advance, configureReader, configureWriter, counts, evaluate, initial, modes, publish, retry, rewind, type LabState, type ReaderMode } from './model';
import './style.css';
const statusNames = { queued: '待投递', retry: '重试积压', held: '隔离待处理', done: '已按语义处理' };
function Board({ state, selected, onSelect }: { state: LabState; selected?: string; onSelect?: (id: string) => void }) {
  const current = state.current, stats = counts(state);
  const probe = { id: 'next', status: current.newState ? 'reviewing' as const : 'paid' as const, extraField: current.extraField };
  return <div className="arch114-board">
    <div className="arch114-writer"><strong>写者下一条事件</strong><code>{JSON.stringify({ status: probe.status, ...(probe.extraField ? { description: '可选说明' } : {}) })}</code></div>
    <div className="arch114-readers">{current.readers.map(reader => { const result = evaluate(reader, probe); return <button type="button" key={reader.id} disabled={!onSelect} className={selected === reader.id || current.selectedReader === reader.id && !selected ? 'selected' : ''} onClick={() => onSelect?.(reader.id)} aria-pressed={onSelect ? selected === reader.id : undefined}><strong>{reader.name}读者</strong><span>{modes[reader.mode]}</span><small>下一条：{statusNames[result.status]}</small></button>; })}</div>
    <div className="arch114-matrix-wrap"><table aria-label="下一条事件兼容矩阵"><thead><tr><th>读者</th><th>结构解码</th><th>业务行为</th></tr></thead><tbody>{current.readers.map(reader => { const outcome = evaluate(reader, probe); return <tr key={reader.id} className={selected === reader.id ? 'selected' : ''}><th>{reader.name}</th><td>{outcome.parses ? '可解析' : '字段被拒绝'}</td><td>{outcome.action}</td></tr>; })}</tbody></table></div>
    <div className="arch114-counts" aria-label="实际消费统计"><span>待投递 <b>{stats.queued}</b></span><span>重试积压 <b>{stats.retry}</b></span><span>隔离待处理 <b>{stats.held}</b></span><span>按语义处理 <b>{stats.done}</b></span></div>
    <ol className="arch114-deliveries" aria-label="实际事件副本">{current.deliveries.filter(item => !selected || item.readerId === selected).map(item => <li key={`${item.eventId}-${item.readerId}`} data-status={item.status}><strong>{item.eventId} → {current.readers.find(reader => reader.id === item.readerId)!.name}：{statusNames[item.status]}</strong><span>原始状态 {current.events.find(event => event.id === item.eventId)!.status} · 尝试 {item.attempts} 次</span><span>{item.action}</span><small>{item.detail}</small></li>)}</ol>
    {current.events.length === 0 && <p>实际队列为空。上方矩阵是当前配置下的契约预检，发布后再看真实投递结果。</p>}
    {selected && <p className="arch114-selection">已选择 {current.readers.find(reader => reader.id === selected)!.name}：只展开此订阅者的事件副本；其他读者不会随它一起升级。</p>}
  </div>;
}
function Actions({ state, setState, reset }: { state: LabState; setState: (next: LabState) => void; reset: () => void }) { return <div className="arch114-actions"><button type="button" data-arch-action="back" disabled={!state.history.length} onClick={() => setState(rewind(state))}>回退一步</button><button type="button" data-arch-action="step" onClick={() => setState(advance(state))}>{counts(state).queued ? '投递下一副本' : '发布一个订单事件'}</button><button type="button" data-arch-action="reset" onClick={reset}>重置实验</button></div>; }
function ReaderControls({ state, setState, only }: { state: LabState; setState: (next: LabState) => void; only?: string }) { return <div className="arch114-controls">{state.current.readers.filter(reader => !only || only === reader.id).map(reader => <fieldset key={reader.id}><legend>{reader.name}读者独立部署</legend><label>{reader.name}读者版本<select value={reader.mode} onChange={event => setState(configureReader(state, reader.id, event.target.value as ReaderMode))}>{Object.entries(modes).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label className="arch114-check"><input type="checkbox" checked={reader.strictFields} onChange={event => setState(configureReader(state, reader.id, reader.mode, event.target.checked))} />{reader.name}拒绝未知字段</label><button type="button" disabled={!state.current.deliveries.some(item => item.readerId === reader.id && (item.status === 'held' || item.status === 'retry'))} onClick={() => setState(retry(state, reader.id))}>重试{reader.name}最早待处理项</button></fieldset>)}</div>; }
export default function Lesson114() {
  const [state, setState] = useState(() => initial());
  const [prediction, setPrediction] = useState(''); const [reason, setReason] = useState('');
  const first = state.current.deliveries.find(item => item.attempts > 0);
  function changed(next: LabState) { setState(next); setPrediction(''); setReason(''); }
  return <section className="arch114" data-testid="architecture-lab-114"><header><p className="arch114-kicker">契约演进实验室 / 114</p><h3>JSON 能读进去，业务就能继续吗？</h3><p>让写者与三个读者分别发布版本，观察哪一份事件被处理、重试或隔离。每次重试保留同一个事件内容。</p></header>
    <div className="arch114-writer-controls"><label className="arch114-check"><input type="checkbox" checked={state.current.newState} onChange={event => changed(configureWriter(state, { newState: event.target.checked }))} />写者启用新状态 reviewing</label><label className="arch114-check"><input type="checkbox" checked={state.current.extraField} onChange={event => changed(configureWriter(state, { extraField: event.target.checked }))} />写者增加可选 description 字段</label></div>
    <ReaderControls state={state} setState={changed} />
    <fieldset disabled={!!first}><legend>可选：预测第一次实际投递</legend><label>你的预测<select aria-label="你的预测" value={prediction} onChange={event => setPrediction(event.target.value)}><option value="">直接探索</option><option value="retry">进入重试积压</option><option value="held">隔离待处理</option><option value="done">按明确语义处理</option></select></label><label>预测理由<input value={reason} onChange={event => setReason(event.target.value)} placeholder="区分字段解码和状态分支" /></label></fieldset>
    <div data-testid="live-model" data-state={JSON.stringify(state)}><Board state={state} /></div><Actions state={state} setState={setState} reset={() => { setState(initial()); setPrediction(''); setReason(''); }} />
    <button type="button" onClick={() => setState(publish(state))}>再发布一条事件，观察积压</button>
    <div className="arch114-feedback" aria-live="polite"><strong>本次动作的后果</strong><p>{state.current.notice}</p>{first && prediction && <p>你的预测：{statusNames[prediction as keyof typeof statusNames]}；当前首份副本：{statusNames[first.status]}。{prediction === first.status ? '预测与观察一致。' : '请依据解码规则和业务状态分支修正判断。'} 你的理由：{reason || '未填写'}。</p>}</div>
    <p className="arch114-note">教学边界：每条事件给三个读者各一份副本，顺序单步消费，未模拟网络失败与重试退避。paid 允许结算和履约，reviewing 暂缓它们；v2 统计可记录审核中。安全未知态保留事件并暂停业务，不等于理解新语义或业务成功。矩阵预检不代替真实契约测试。改变写者不改旧事件；升级读者不自动重放，需显式重试。若外部读者无法升级，应评估独立版本或事件类型。</p>
  </section>;
}
export function Help({ mode }: { mode: string }) { return <aside className="arch114 arch114-help" data-testid="architecture-help-114"><p className="arch114-kicker">辅助理解 · 不计入独立掌握</p>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}</aside>; }
function Example() {
  const baseline = () => configureWriter(initial(), { newState: false, extraField: true });
  const [state, setState] = useState(baseline);
  return <><h4>采购单增加备注，与增加“复核中”状态</h4><p>把 description 当作采购备注，把 reviewing 当作复核中。旧财务可以忽略备注，但不能把复核中当作已付款。</p><label>本次扩展<select value={state.current.newState ? 'state' : 'field'} onChange={event => setState(configureWriter(initial(), { newState: event.target.value === 'state', extraField: event.target.value === 'field' }))}><option value="field">只加可选备注字段</option><option value="state">增加复核中状态</option></select></label><ReaderControls state={state} setState={setState} only="billing" /><Board state={state} selected="billing" /><Actions state={state} setState={setState} reset={() => setState(baseline())} /><p className="arch114-feedback" aria-live="polite">{state.current.notice}</p><p className="arch114-note">类比限于契约与业务分支；允许忽略字段必须有读者行为证据，严格字段解码仍可能拒绝新增字段。</p></>;
}
function Diagram() {
  const [state, setState] = useState(() => initial()); const [selected, setSelected] = useState('billing');
  return <><h4>同一个事件，三条独立消费路径</h4><p>点选读者，联动查看其版本、兼容矩阵和事件副本。升级一个读者不会替其他订阅者消除积压。</p><Board state={state} selected={selected} onSelect={setSelected} /><ReaderControls state={state} setState={setState} only={selected} /><Actions state={state} setState={setState} reset={() => { setState(initial()); setSelected('billing'); }} /><p className="arch114-feedback" aria-live="polite">{state.current.notice}</p></>;
}
const guidedActions = ['保持旧状态，准备发布', '结算读者升级 v2', '履约读者升级 v2', '统计读者升级 v2', '写者启用 reviewing', '发布新状态事件', '投递结算副本', '投递履约副本', '投递统计副本'];
function guided(phase: number): LabState {
  let state = initial();
  for (let i = 0; i < phase; i++) {
    if (i === 0) state = configureWriter(state, { newState: false });
    else if (i < 4) state = configureReader(state, state.current.readers[i - 1].id, 'v2');
    else if (i === 4) state = configureWriter(state, { newState: true });
    else state = advance(state);
  }
  return state;
}
function Steps() {
  const [phase, setPhase] = useState(0); const state = guided(phase);
  return <><h4>先让每个读者理解，再启用写者</h4><p>第 {phase} / {guidedActions.length} 步。下一动作：{guidedActions[phase] ?? '检查三条消费路径均按明确语义处理'}。</p><Board state={state} /><div className="arch114-actions"><button type="button" disabled={!phase} onClick={() => setPhase(phase - 1)}>上一步</button><button type="button" disabled={phase === guidedActions.length} onClick={() => setPhase(phase + 1)}>下一步</button><button type="button" onClick={() => setPhase(0)}>重来</button></div><p className="arch114-feedback" aria-live="polite">{state.current.notice}</p><p>检查依据：所有订阅者都必须有已定义的新状态行为；本例逐项核对三条路径。生产环境还应加入契约测试、灰度与积压监控。</p></>;
}
const challenges = [
  { prompt: '物流要新增 returned 状态。仓库读者支持它，财务读者只认识 shipped；JSON 都能解析。此时怎样发布？', expected: 'readers', choices: [['readers', '先扩展财务读者并验证，再启用新状态'], ['writer', '马上发 returned，因为 JSON 可解析'], ['ignore', '财务对未知状态直接报告成功']], feedback: '财务缺少 returned 的业务分支。先验证退款、冲销等预期行为，再启用新状态；若只能安全隔离，还需明确谁处理积压。仅解析成功或吞掉事件都不证明兼容。' },
  { prompt: '设备事件只增加可选 displayLabel，不改变已有状态；所有现存读者的契约测试都证实会忽略这个字段。怎样安排？', expected: 'field', choices: [['field', '按已验证兼容性渐进发布并观察消费'], ['all', '必须为这个字段重写所有读者'], ['blind', '推断以后所有枚举新增也兼容']], feedback: '可选字段且所有读者已验证忽略，支持较简单的渐进发布；继续观察错误与积压。证据仅覆盖此字段变更，不能推广成未知状态也安全。若有严格字段解码读者，应先调整它的兼容行为。' },
];
function Try() {
  const [variant, setVariant] = useState(0); const [answer, setAnswer] = useState(''); const [reason, setReason] = useState(''); const [submitted, setSubmitted] = useState(false);
  const question = challenges[variant]; const reset = () => { setAnswer(''); setReason(''); setSubmitted(false); };
  return <><h4>让我试试：找出发布证据</h4><p>情境 {variant + 1} / 2：{question.prompt}</p><label>你的方案<select value={answer} disabled={submitted} onChange={event => setAnswer(event.target.value)}><option value="">请选择</option>{question.choices.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label>方案理由<textarea disabled={submitted} value={reason} onChange={event => setReason(event.target.value)} placeholder="说明读者目前支持什么，哪些证据仍缺失" /></label><button type="button" disabled={!answer || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交并看反馈</button>{submitted && <div className="arch114-feedback" data-testid="challenge-feedback" aria-live="polite"><strong>{answer === question.expected ? '方案与现有证据相符' : '请检查兼容证据覆盖的范围'}</strong><p>{question.feedback}</p><p>你的理由：{reason}</p><p>反馈仅核对所选方案；自由文本理由留给你对照因果自查，不作自动语义评分。</p></div>}<div className="arch114-actions"><button type="button" onClick={reset}>重试本题</button><button type="button" onClick={() => { setVariant(1 - variant); reset(); }}>换一个情境</button></div></>;
}
