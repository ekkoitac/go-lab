import { useState } from 'react';
import { initial, names, ownership, transition, type Action, type Model, type Policy, type Result } from './model';
import './style.css';
const policies: [Policy, string][] = [['fake', '错误实现：满额仍报成功'], ['reject', '修复：立即明确拒绝'], ['wait', '有界等待容量'], ['drop', '明确丢弃（需业务允许）']];
function Board({ model }: { model: Model }) {
  return <div className="q126-board" data-testid="live-model" data-state={JSON.stringify(model)}><div className="q126-lanes"><section><h4>调用方</h4><b>任务 B</b><p>{names[model.result]}</p></section><span aria-hidden="true">→</span><section><h4>内存队列 · 容量 1</h4><div className="q126-slot">{model.queue.join('、') || '空位'}</div><p>已完成：{model.completed.join('、') || '无'}</p></section></div><p><strong>责任账本：</strong>{ownership(model)}</p><p>等待预算：{model.time} / {model.budget} 步</p><p role="status">{model.log.at(-1)}</p></div>;
}
export default function Lab() {
  const [history, setHistory] = useState<Model[]>([initial()]);
  const [prediction, setPrediction] = useState<Result | ''>('');
  const [feedback, setFeedback] = useState('');
  const model = history.at(-1)!;
  function act(action: Action) {
    const next = transition(model, action);
    if (next === model) return;
    setHistory([...history, next]);
    if (action === 'offer') setFeedback(`你的预测：${prediction ? names[prediction] : '未填写'}。实际：${names[next.result]}。${next.log.at(-1)}`);
    else setFeedback('');
    setPrediction('');
  }
  function configure(policy = model.policy, lossy = model.lossy, budget = model.budget) {
    setHistory([initial(policy, lossy, budget)]); setPrediction(''); setFeedback('');
  }
  return <div className="q126" data-testid="concurrency-lab-126"><h3>满队列：核对承诺与责任</h3><p>先预测 B 是否真正被接收，再释放空位、重试或取消等待。目标：让返回结果与责任交接一致。</p><div className="q126-controls"><label>接收策略<select value={model.policy} onChange={e => configure(e.target.value as Policy)}>{policies.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label><label>业务语义<select value={model.lossy ? 'sample' : 'task'} onChange={e => configure(model.policy, e.target.value === 'sample')}><option value="task">业务任务：不允许丢失</option><option value="sample">监控采样：允许明确丢弃</option></select></label><label>等待预算（模拟步）<input type="number" min={1} max={5} value={model.budget} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 5) configure(model.policy, model.lossy, n); }} /></label></div><p className="q126-note">更改条件会重置本轮。每步只是事件顺序，不代表真实毫秒。</p><Board model={model} /><label>提交前预测 B 的结果<select aria-label="提交前预测 B 的结果" value={prediction} onChange={e => setPrediction(e.target.value as Result)} disabled={model.result !== 'ready'}><option value="">请选择预测</option>{(['accepted', 'rejected', 'waiting', 'false-success', 'dropped', 'forbidden'] as Result[]).map(r => <option key={r} value={r}>{names[r]}</option>)}</select></label><div className="q126-actions"><button data-concurrency-action="step" disabled={model.result === 'ready' ? !prediction : model.result !== 'waiting'} onClick={() => act(model.result === 'ready' ? 'offer' : 'tick')}>{model.result === 'waiting' ? '单步：等待 1 步' : '单步：提交并验证'}</button><button disabled={!model.queue.length} onClick={() => act('release')}>消费者完成一个任务</button><button disabled={!['ready', 'waiting'].includes(model.result)} onClick={() => act('cancel')}>取消 B 请求</button><button disabled={!['rejected', 'expired', 'cancelled', 'forbidden'].includes(model.result)} onClick={() => act('retry')}>调用方重新尝试</button><button data-concurrency-action="back" disabled={history.length < 2} onClick={() => { setHistory(history.slice(0, -1)); setFeedback(''); setPrediction(''); }}>回退</button><button data-concurrency-action="reset" onClick={() => configure()}>重置</button></div>{feedback && <p className="q126-feedback" role="status">{feedback}</p>}{model.result === 'false-success' && <div className="q126-feedback"><p>B 不在队列中，返回值却声称接收。把满额分支改为拒绝，再验证释放空位后重试。</p><button onClick={() => configure('reject')}>修复满额分支并重开对照</button></div>}<details><summary>查看事件证据（{model.log.length} 条）</summary><ol>{model.log.map((line, i) => <li key={i}>{line}</li>)}</ol></details><p className="q126-note">模型边界：单消费者、单次提交、事件按点击顺序发生。容量释放与取消同时就绪时，Go select 不保证取消优先。本模型不模拟竞争概率；内存接收也不保证进程崩溃后持久交付。本区是探索练习，不计独立掌握。</p></div>;
}
function Example() {
  const [policy, setPolicy] = useState<Policy>('fake'); const m = transition(initial(policy), 'offer');
  return <><h4>例子：快递柜满了还能发“已存入”吗？</h4><div className="q126-actions">{policies.slice(0, 3).map(([p, label]) => <button aria-pressed={policy === p} key={p} onClick={() => setPolicy(p)}>{label}</button>)}</div><div className="q126-example"><p>柜格内：包裹 A。柜外：包裹 B。</p><p>通知收件人：<strong>{names[m.result]}</strong></p><p>责任核对：{ownership(m)}</p></div><p>换策略，柜格仍然满；改变的是是否等待，以及有没有说实话。“接收”也只是交接，不代表已经完成配送。</p></>;
}
function Diagram() {
  const [full, setFull] = useState(true); const [wait, setWait] = useState(false);
  return <><h4>分支图：同一容量，如何走到不同出口</h4><div className="q126-actions"><button aria-pressed={full} onClick={() => setFull(!full)}>{full ? '释放一个空位' : '填满队列'}</button><button aria-pressed={wait} onClick={() => setWait(!wait)}>{wait ? '改为立即拒绝' : '改为有界等待'}</button></div><ol className="q126-path"><li>提交 B</li><li>容量判断：{full ? '已满' : '有空位'}</li><li>{!full ? 'B 入队 → 确认接收 → 服务负责' : wait ? '等待空位 / 取消 / 期限 → 等待期间不确认接收' : '返回忙碌 → 调用方保留恢复责任'}</li></ol><p>箭头表示条件选择。取消与容量同时就绪时需考虑竞争，本图不赋予取消优先级。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const states = [initial('reject'), transition(initial('reject'), 'offer')]; states.push(transition(states[1], 'release')); states.push(transition(states[2], 'retry')); states.push(transition(states[3], 'offer'));
  const labels = ['核对约束：业务任务不能静默丢失', '满额提交：明确返回未接收', '消费者完成 A：容量恢复', '调用方决定重试：开启新尝试', 'B 入队后：才确认接收'];
  return <><h4>分步修复：沿着责任追踪 B</h4><p>{step + 1} / 5 · {labels[step]}</p><div className="q126-example"><p>队列：{states[step].queue.join('、') || '空'}</p><p>返回结果：{names[states[step].result]}</p><p>{ownership(states[step])}</p></div><div className="q126-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 4} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>从头追踪</button></div></>;
}
function Try() {
  const [m, setM] = useState(initial('wait', false, 1)); const [guess, setGuess] = useState(''); const [answer, setAnswer] = useState('');
  function apply(a: Action) { const n = transition(m, a); setM(n); if (a === 'tick' || a === 'release') setAnswer(`预测：${guess}；实际：${names[n.result]}。${n.log.at(-1)}`); }
  return <><h4>辅助练习：只剩 1 步预算</h4><p>任务 B 在满队列等待。先选择事件，再预判结果；帮助内的练习不计独立掌握。</p><div className="q126-example"><p>队列：{m.queue.join('、') || '空'}</p><p>结果：{names[m.result]}；等待 {m.time} / {m.budget}</p></div><label>事件发生后的预测<select value={guess} onChange={e => setGuess(e.target.value)}><option value="">请选择</option><option>已接收 B</option><option>期限到，未接收</option><option>已取消，未接收</option></select></label><div className="q126-actions"><button disabled={m.result !== 'ready'} onClick={() => apply('offer')}>开始等待</button><button disabled={!guess || m.result !== 'waiting'} onClick={() => apply('release')}>先释放空位</button><button disabled={!guess || m.result !== 'waiting'} onClick={() => apply('tick')}>先耗尽预算</button><button disabled={!guess || m.result !== 'waiting'} onClick={() => { const n = transition(m, 'cancel'); setM(n); setAnswer(`预测：${guess}；实际：${names[n.result]}。B 没有入队。`); }}>先取消请求</button><button onClick={() => { setM(initial('wait', false, 1)); setGuess(''); setAnswer(''); }}>重试辅助练习</button></div>{answer && <p role="status">{answer}</p>}</>;
}
export function Help({ mode }: { mode: string }) { return <div className="q126" data-testid="concurrency-help-126">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}</div>; }
