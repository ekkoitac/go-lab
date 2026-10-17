import { useState } from 'react';
import { canStep, createState, exampleObservation, hasCompletionPath, initialConfig, protocol, run, step, transferFeedback, validateProtocol } from './model';
import type { Config, Signal, Verdict } from './model';
import './style.css';

const verdictText: Record<Verdict, string> = {
  waiting: '等待中', early: '提前断言：结果尚未写入', unproven: '值碰巧已写入 · 没有同步证据',
  passed: '观察到完成 · 可以读取结果', timeout: '总预算超时 · 测试失败',
};
export default function Lesson193() {
  const [history, setHistory] = useState(() => [createState()]);
  const state = history[history.length - 1];
  const { config } = state;
  const configure = (next: Config) => setHistory([createState(next)]);
  const advance = () => setHistory(old => [...old, step(old[old.length - 1])]);
  const repaired = run({ ...config, omitDone: false });
  return <section className="dl193" data-testid="delivery-lab-193">
    <header><span className="dl193-kicker">193 / 时间不是完成证据</span><h3>亲手安排 worker，再决定何时断言</h3>
      <p>两种测试共享同一个调度过程。观察 sleep 到期、接收确认、结果写入与 done 关闭是否是同一件事。</p></header>
    <div className="dl193-controls">
      <label>worker 接收任务的时隙：{config.delay}<input aria-label="worker 调度延迟" type="range" min="1" max="8" value={config.delay} onChange={e => configure({ ...config, delay: Number(e.target.value) })} /></label>
      <label>sleep 等待时隙：{config.sleep}<input aria-label="sleep 等待时隙" type="range" min="1" max="10" value={config.sleep} onChange={e => configure({ ...config, sleep: Number(e.target.value) })} /></label>
      <label>总预算：{config.budget} 时隙<input aria-label="整体测试预算" type="range" min="3" max="14" value={config.budget} onChange={e => configure({ ...config, budget: Number(e.target.value) })} /></label>
      <label className="dl193-check"><input type="checkbox" checked={config.omitDone} onChange={e => configure({ ...config, omitDone: e.target.checked })} />注入故障：worker 漏关 done</label>
    </div>
    <p className="dl193-muted">改动条件会从起点重跑；每个时隙是教学调度单位，不代表毫秒。</p>
    <div className="dl193-actions">
      <button data-delivery-action="step" disabled={!canStep(state)} onClick={advance}>{state.gate ? '推进一个时隙' : '单步：释放 gate'}</button>
      <button data-delivery-action="back" disabled={history.length < 2} onClick={() => setHistory(old => old.slice(0, -1))}>回退一步</button>
      <button data-delivery-action="reset" onClick={() => configure({ ...initialConfig })}>重置实验</button>
    </div>
    <div data-testid="live-model" data-state={JSON.stringify(state)} className="dl193-live">
      <div className="dl193-clock"><strong>时隙 {state.tick} / {config.budget}</strong><span>gate：{state.gate ? '已释放' : '未释放'}</span></div>
      <ol className="dl193-stages" aria-label="worker 状态链">
        {[['接收任务', state.accepted], ['写入 result=42', state.written], ['关闭 done', state.done]].map(([label, complete]) => <li key={String(label)} data-complete={String(complete)}><span>{complete ? '●' : '○'}</span> {label}</li>)}
      </ol>
      <div className="dl193-comparison">
        <article><h4>测试 A · 只等 sleep</h4><code>sleep({config.sleep}) → 读取结果</code><p data-verdict={state.sleepVerdict}>{verdictText[state.sleepVerdict]}</p><small>经过时间不建立写入到读取的同步关系。</small></article>
        <article><h4>测试 B · 等待 done</h4><code>← done → 读取结果</code><p data-verdict={state.handshakeVerdict}>{verdictText[state.handshakeVerdict]}</p><small>完成信号来自 worker；超时只负责终止失败等待。</small></article>
      </div>
      <div className="dl193-feedback" aria-live="polite"><strong>这一步发生了什么</strong>{state.events.map(event => <p key={event}>{event}</p>)}</div>
    </div>
    {config.omitDone && <aside className="dl193-repair"><p>修复预测：保持调度与预算不变，补上 close(done)，握手测试将{repaired.handshakeVerdict === 'passed' ? '取得完成证据' : '仍然超时；预算不足以覆盖当前安排'}。</p><button onClick={() => configure({ ...config, omitDone: false })}>补上 close(done)，从起点验证</button></aside>}
    <details><summary>展开已执行的时间线</summary><ol className="dl193-log">{history.map((snapshot, i) => <li key={i}><strong>{i === 0 ? '起点' : `时隙 ${snapshot.tick}`}</strong>：{snapshot.events.join(' ')}</li>)}</ol></details>
    <p className="dl193-boundary">模拟边界：固定调度中，接收后下一时隙写入，再下一时隙关闭 done；同一时隙先处理 worker 事件再检查测试条件与预算；真实 Go select 同时就绪时不保证这个优先级。画面显示的是观察者视图，未执行存在数据竞争的 Go 读取。一个交错不能覆盖所有并发路径，还需取消/失败测试与 race 检查。</p>
  </section>;
}

function Example() {
  const [phase, setPhase] = useState(0);
  const [signal, setSignal] = useState<Signal>('accepted');
  const observation = exampleObservation(phase, signal);
  const stages = ['任务还在排队', 'worker 确认接收任务', 'worker 已生成账单', 'worker 关闭完成通道'];
  return <><h4>账单任务：收到订单，等于账单已经生成吗？</h4><p>扮演调用方，选择你愿意等待的信号，再让服务处理一个阶段。</p>
    <div className="dl193-actions">{(['accepted', 'done'] as const).map(value => <button key={value} aria-pressed={signal === value} onClick={() => setSignal(value)}>{value === 'accepted' ? '等待接收确认 accepted' : '等待完成确认 done'}</button>)}</div>
    <div className="dl193-comparison"><article><h4>账单服务</h4><p>阶段 {phase}：{stages[phase]}</p><p>账单：{observation.resultWritten ? '已写入' : '尚未生成'}</p></article><article><h4>调用方</h4><p>{observation.received ? `已收到 ${signal}` : `正在等待 ${signal}`}</p><p>{observation.safeRead ? '现在可以安全读取账单' : observation.received ? '确认接收不保证账单完成，不能据此读取' : '保持等待，尚无读取依据'}</p></article></div>
    <div className="dl193-actions"><button disabled={phase === 3} onClick={() => setPhase(p => p + 1)}>服务处理下一阶段</button><button disabled={!phase} onClick={() => setPhase(p => p - 1)}>回到上一阶段</button><button onClick={() => { setPhase(0); setSignal('accepted'); }}>重置账单情境</button></div>
    <p className="dl193-muted">对照任务：停在阶段 1，分别等待 accepted 与 done。哪个信号会让调用方过早离开等待？</p></>;
}

function Diagram() {
  const [edges, setEdges] = useState([true, true, true]);
  const [selected, setSelected] = useState(0);
  const nodes = ['写入 result', '关闭 done', '测试观察 done', '测试读取 result'];
  const labels = ['worker 程序顺序', 'channel 同步关系', '测试程序顺序'];
  const reachable = (index: number) => index >= selected && edges.slice(selected, index).every(Boolean);
  const safe = hasCompletionPath(edges);
  return <><h4>沿同步路径追踪：哪条边让写入对读取可见？</h4><p>选择一个节点，看它能沿当前关系到达哪里；断开一条边，再检查证明是否成立。</p>
    <svg className="dl193-graph" viewBox="0 0 320 350" role="img" aria-label="写入经关闭 done、观察 done 到读取结果的同步关系图">
      {nodes.map((label, i) => <g key={label}>{i < 3 && <><line x1="160" y1={55 + i * 85} x2="160" y2={98 + i * 85} stroke={edges[i] && reachable(i) ? '#70e2bf' : '#7b8494'} strokeWidth="3" strokeDasharray={edges[i] ? undefined : '5 5'} /><path d={`M 155 ${92 + i * 85} L 160 ${99 + i * 85} L 165 ${92 + i * 85}`} fill="none" stroke={edges[i] ? '#70e2bf' : '#7b8494'} /><text x="172" y={79 + i * 85} fontSize="11" fill="#aab7c8">{edges[i] ? labels[i] : '关系已断开'}</text></>}<rect x="60" y={12 + i * 85} width="200" height="43" rx="9" fill={reachable(i) ? '#214b43' : '#202839'} stroke={selected === i ? '#f7d88a' : '#536577'} /><text x="160" y={39 + i * 85} textAnchor="middle" fill="#edf7f5" fontSize="14">{label}</text></g>)}
    </svg>
    <div className="dl193-actions">{nodes.map((label, i) => <button key={label} aria-pressed={selected === i} onClick={() => setSelected(i)}>追踪：{label}</button>)}</div>
    <div className="dl193-edge-controls">{labels.map((label, i) => <label key={label}><input type="checkbox" checked={edges[i]} onChange={() => setEdges(old => old.map((value, index) => index === i ? !value : value))} />保留 {label}</label>)}</div>
    <p className="dl193-feedback" aria-live="polite">{safe ? '证明链完整：写入先于关闭，关闭与接收关闭建立同步，读取在观察之后。' : '证明链断开：无法从写入推导到读取。把 sleep 插入缺口也不会创建这条同步边。'}</p><p className="dl193-muted">这里编辑的是证明前提；关闭与观察之间画的是同步关系，不是网络传输时间。</p></>;
}

function Steps() {
  const [order, setOrder] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const result = validateProtocol(order);
  const choices = [protocol[3], protocol[0], protocol[5], protocol[2], protocol[4], protocol[1]];
  return <><h4>给测试与 worker 排一份可执行的协议</h4><p>每次安排一个事件，逐步建出“释放 → 处理 → 通知 → 读取”的顺序。顺序错误会破坏完成证明。</p>
    <ol className="dl193-order">{order.map((name, i) => <li key={name}><span>{i + 1}</span>{name}<small>{name.startsWith('worker') || name === '写入 result' || name === '关闭 done' ? 'worker' : '测试'}</small></li>)}</ol>
    {!order.length && <p className="dl193-muted">协议尚未安排。先让被 gate 阻塞的 worker 有机会运行。</p>}
    <div className="dl193-actions">{choices.filter(name => !order.includes(name)).map(name => <button key={name} onClick={() => { setOrder(old => [...old, name]); setChecked(false); }}>{name}</button>)}</div>
    <div className="dl193-actions"><button disabled={!order.length} onClick={() => { setOrder(old => old.slice(0, -1)); setChecked(false); }}>撤回上一步</button><button disabled={order.length !== protocol.length} onClick={() => setChecked(true)}>检验完整协议</button><button onClick={() => { setOrder([]); setChecked(false); }}>重新安排</button></div>
    {checked && <p className="dl193-feedback" aria-live="polite">{result.valid ? '协议成立：worker 先完成写入再关闭 done；测试先观察关闭再读取。通道关闭只由 worker 负责一次。' : `第 ${result.mismatch + 1} 步缺少必要前提，应先「${protocol[result.mismatch]}」。从末尾撤回并修正；仅调整等待时长无法修补顺序。`}</p>}
  </>;
}

function Try() {
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return <><h4>迁移挑战：取消请求之后，何时可以检查资源已释放？</h4><p>新情境：worker 正在生成文件；测试关闭 cancel 通道，请求它退出。worker 需要先清理临时文件，再关闭 exited。你准备断言“文件已经删除”。应该怎样安排？</p>
    <fieldset disabled={submitted}><legend>先做判断，提交后再看解释</legend>{[
      ['cancel', '关闭 cancel 后立即检查文件'], ['sleep', '关闭 cancel 后 sleep 500ms，再检查文件'], ['join', '关闭 cancel，等待 exited 或总超时；收到退出确认后再检查'],
    ].map(([value, label]) => <label className="dl193-option" key={value}><input type="radio" name="dl193-transfer" value={value} checked={choice === value} onChange={() => setChoice(value)} />{label}</label>)}
      <label>理由：哪个事件证明清理已经完成？<textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="说明取消请求、清理和退出确认之间的先后关系" /></label></fieldset>
    <button disabled={!choice || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交判断与理由</button>
    {submitted && <div className="dl193-feedback" aria-live="polite"><p>{transferFeedback(choice)}</p><p>你的理由：{reason}</p><p>自查理由是否包含“清理在关闭 exited 之前、检查在观察 exited 之后”。本练习核对选择并展示理由供自查，不自动判定文字推理。</p><button onClick={() => { setChoice(''); setReason(''); setSubmitted(false); }}>重新作答（已看过反馈）</button></div>}
    <p className="dl193-muted">本地迁移练习；不会把看过提示或答案后的操作写入独立掌握记录。</p></>;
}

export function Help({ mode }: { mode: string }) {
  return <section className="dl193 dl193-help" data-testid="delivery-help-193" data-mode={mode}>
    {mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}
  </section>;
}

