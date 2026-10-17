import { useState } from 'react';
import { at, defaults, finished, run, type Config, type State } from './model';
import './style.css';

const statusText = { queued: '排队', running: '执行中', ok: '成功', timeout: '超时', cancelled: '取消' };
const responseText = { waiting: '等待依赖 / 组装', ok: '成功响应', failed: '核心依赖失败', deadline: '客户端已超时' };

function Board({ state }: { state: State }) {
  const scale = 1000;
  return <article className="fan122-board">
    <h4>{state.policy === 'shared' ? 'A · 继承根预算 + 推荐限时' : 'B · 每次调用重给 300ms'}</h4>
    <div className="fan122-metrics">
      <span>已用 <b>{state.now}ms</b></span><span>根剩余 <b>{Math.max(0, 300 - state.now)}ms</b></span>
      <span>运行 / 额度 <b>{state.calls.filter(c => c.status === 'running').length} / {state.config.slots}</b></span><span>峰值并发 <b>{state.peak}</b></span>
    </div>
    <div className="fan122-axis"><span>0ms</span><span>500ms</span><span>1000ms</span></div>
    {state.calls.map(call => {
      const spans = [...call.spans, ...(call.status === 'running' && call.start !== null ? [{ start: call.start, end: state.now, retry: call.attempt > 1 }] : [])];
      return <div className="fan122-call" key={call.id}>
        <div className="fan122-callhead"><strong>{call.label} · {call.required ? '必需' : '可降级'}</strong><span data-status={call.status}>{statusText[call.status]}{call.attempt > 1 ? ' · 重试' : ''}</span></div>
        <div className="fan122-track" aria-label={call.label + '调用时间线'}>
          <div className="fan122-queue" style={{ width: (call.spans[0]?.start ?? call.start ?? Math.min(state.now, state.config.queue)) / scale * 100 + '%' }} />
          {spans.map((span, i) => <div className={'fan122-span' + (span.retry ? ' is-retry' : '')} key={i} style={{ left: span.start / scale * 100 + '%', width: Math.max(1, (span.end - span.start) / scale * 100) + '%' }} />)}
          <span className="fan122-rootline" style={{ left: '30%' }} /><span className="fan122-cursor" style={{ left: Math.min(100, state.now / scale * 100) + '%' }} />
        </div>
        <small>第 {call.attempt} 次 · 开始 {call.start ?? '—'}ms · 截止 {call.deadline ?? '—'}ms · 结束 {call.end ?? '—'}ms</small>
      </div>;
    })}
    <p className="fan122-result"><strong>{responseText[state.response]}</strong>{state.responseAt !== null && ' @ ' + state.responseAt + 'ms'}{state.response === 'deadline' && state.calls.some(c => c.status === 'running') && '；下游仍占用额度'}</p>
    <ul className="fan122-notes">{state.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
  </article>;
}

export default function Lab() {
  const [config, setConfig] = useState<Config>(defaults);
  const [steps, setSteps] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const shared = at(config, 'shared', steps);
  const renewed = at(config, 'renewed', steps);
  const done = finished(shared) && finished(renewed);
  const change = (patch: Partial<Config>) => { setConfig(c => ({ ...c, ...patch })); setSteps(0); setPrediction(''); setReason(''); };
  return <section className="fan122" data-testid="concurrency-lab-122">
    <header><h3>给扇出请求分配同一只时钟</h3><p>让价格、库存、推荐争用并发额度。观察排队和重试如何花掉 300ms，而不是把并行耗时直接相加。</p></header>
    <fieldset className="fan122-controls"><legend>实验条件 · 两侧使用完全相同的负载</legend>
      <label>入口排队 {config.queue}ms<input aria-label="入口排队时间" type="range" min="0" max="320" step="20" value={config.queue} onChange={e => change({ queue: Number(e.target.value) })} /></label>
      <label>并发额度<select aria-label="并发额度" value={config.slots} onChange={e => change({ slots: Number(e.target.value) })}><option value={1}>1 个</option><option value={2}>2 个</option><option value={3}>3 个</option></select></label>
      <label className="fan122-check"><input type="checkbox" checked={config.retry} onChange={e => change({ retry: e.target.checked })} />价格首次运行 60ms 后失败并重试一次</label>
    </fieldset>
    <p className="fan122-boundary">固定负载：价格 100ms、库存 120ms、推荐 260ms；组装 20ms。A 的推荐仅获 80ms，所有下游最晚 280ms 停止；B 使用脱离父请求的局部 300ms。两侧均优先调度价格、库存。</p>
    <fieldset className="fan122-predict"><legend>先预测：A 能在总预算内提供核心结果吗？</legend>
      <label><input name="fan122-prediction" type="radio" value="ok" checked={prediction === 'ok'} disabled={steps > 0} onChange={e => setPrediction(e.target.value)} />能，推荐可以缺省</label>
      <label><input name="fan122-prediction" type="radio" value="failed" checked={prediction === 'failed'} disabled={steps > 0} onChange={e => setPrediction(e.target.value)} />不能，核心依赖也来不及</label>
      <label>依据（可选）<input placeholder="考虑排队、并发和组装时间…" value={reason} disabled={steps > 0} onChange={e => setReason(e.target.value)} /></label>
    </fieldset>
    <div className="fan122-actions"><button data-concurrency-action="step" disabled={!prediction || done} onClick={() => setSteps(n => n + 1)}>单步 +20ms</button><button data-concurrency-action="back" disabled={steps === 0} onClick={() => setSteps(n => n - 1)}>回退</button><button disabled={!prediction || done} onClick={() => setSteps(50)}>揭晓结局</button><button data-concurrency-action="reset" onClick={() => { setSteps(0); setPrediction(''); setReason(''); }}>重置实验</button></div>
    {!prediction && <p>先选一个预测，再推进时间；调参会开启一轮新实验。</p>}
    <div data-testid="live-model" data-state={JSON.stringify({ shared, renewed })} className="fan122-comparison"><Board state={shared} /><Board state={renewed} /></div>
    <p className="fan122-legend">时间线：灰色为首次启动前等待，青色为调用占用额度，紫色为重试；红线为请求 300ms 截止，黑线为当前时刻。</p>
    <div aria-live="polite" className="fan122-feedback">{shared.response !== 'waiting' && <p><strong>{prediction === shared.response ? '预测与结果一致。' : '预测需要修正。'}</strong>A 在 {shared.responseAt}ms {responseText[shared.response]}。{shared.response === 'ok' ? '价格与库存已完成，推荐超时可以降级。' : '保住截止边界不等于必需结果一定成功；试着减少入口等待或增加额度。'}{reason && ' 你的依据：' + reason}</p>}</div>
    <p className="fan122-boundary">找边界：把排队改为 280ms，A 还会启动调用吗？把额度改为 1，再打开重试观察价格是否挤占库存预算。此模型使用 20ms 离散时钟，子调用同刻完成与超时按超时处理；真实调度、网络取消延迟与生产性能需另行测量。练习不会写入掌握记录。</p>
  </section>;
}

function HelpExample() {
  const [queue, setQueue] = useState(80);
  return <div><h4>例子：一张 300ms 的取餐凭证</h4><p>排队先花时间，打包还要留 20ms。换窗口重试不能换出一张全新的凭证。</p><label>已经排队多少时间<select value={queue} onChange={e => setQueue(Number(e.target.value))}><option value={0}>0ms</option><option value={80}>80ms</option><option value={220}>220ms</option><option value={280}>280ms</option></select></label><div className="fan122-budget"><span style={{ flex: queue || 1 }}>排队 {queue}</span><strong style={{ flex: Math.max(1, 280 - queue) }}>下游 {Math.max(0, 280 - queue)}</strong><span style={{ flex: 20 }}>组装 20</span></div><p>下游最多可用：300 − {queue} − 20 = <b>{Math.max(0, 280 - queue)}ms</b>。三个窗口并行时，耗时取决于最长路径；同时占用的窗口数仍然相加。</p></div>;
}
function HelpDiagram() {
  const [focus, setFocus] = useState<'price' | 'stock' | 'recommend'>('recommend');
  return <div><h4>沿依赖关系追踪 deadline</h4><div className="fan122-node">根请求：deadline = 300ms</div><p className="fan122-arrow">↓ 入口排队 80ms，预留组装 20ms ↓</p><div className="fan122-branches">{(['price', 'stock', 'recommend'] as const).map(id => <button key={id} aria-pressed={focus === id} onClick={() => setFocus(id)}>{id === 'price' ? '价格 · 必需' : id === 'stock' ? '库存 · 必需' : '推荐 · 可选'}<br />{id === 'recommend' ? '另限 80ms' : '最晚 280ms'}</button>)}</div><p className="fan122-arrow">↓ 汇合、组装 20ms ↓</p><div className="fan122-node">300ms 前响应核心结果</div><p aria-live="polite">{focus === 'recommend' ? '选中推荐：若 80ms 时启动，截止是 min(280, 80+80)=160ms；超时只移除推荐，不把整个页面判成功或失败。核心结果仍须检查。' : '选中' + (focus === 'price' ? '价格' : '库存') + '：即使调用更晚才拿到额度，最晚完成边界仍为 280ms；其失败意味着无法提供本题所需核心结果。'}</p></div>;
}
function HelpSteps() {
  const [step, setStep] = useState(0);
  const descriptions = ['0ms：总时钟启动，排队也计入预算。', '80ms：价格与库存各拿一个额度；价格截止 280ms，库存也为 280ms。', '180ms：价格完成，推荐拿到释放的额度；它的截止是 min(280,180+80)=260ms。', '200ms：库存完成；必需结果已齐，继续等待推荐的有限预算。', '260ms：推荐超时并降级；组装响应。', '280ms：成功响应，保留 20ms 余量。'];
  const times = [0, 80, 180, 200, 260, 280];
  return <div><h4>逐段核算同一笔预算</h4><ol className="fan122-step-list">{descriptions.map((line, i) => <li key={line} aria-current={i === step ? 'step' : undefined} className={i === step ? 'is-current' : ''}>{i <= step ? line : '下一段尚未展开'}</li>)}</ol><label>预算消耗<progress max={300} value={times[step]} /></label><p>已用 {times[step]}ms / 剩余 {300 - times[step]}ms</p><div className="fan122-actions"><button disabled={step === 0} onClick={() => setStep(n => n - 1)}>上一段</button><button disabled={step === 5} onClick={() => setStep(n => n + 1)}>下一段</button></div></div>;
}
function HelpTry() {
  const [queue, setQueue] = useState(120);
  const [slots, setSlots] = useState(1);
  const [guess, setGuess] = useState('');
  const [revealed, setRevealed] = useState(false);
  const result = run({ queue, slots, retry: false }, 'shared');
  return <div><h4>小练习：让核心结果赶上截止</h4><p>固定价格 100ms、库存 120ms；推荐可缺省。只改变队列和额度，先判断再验证。此处为独立练习状态。</p><div className="fan122-controls"><label>排队<select value={queue} onChange={e => { setQueue(Number(e.target.value)); setRevealed(false); setGuess(''); }}><option value={0}>0ms</option><option value={120}>120ms</option><option value={220}>220ms</option></select></label><label>额度<select value={slots} onChange={e => { setSlots(Number(e.target.value)); setRevealed(false); setGuess(''); }}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label><label>我的判断<select value={guess} onChange={e => { setGuess(e.target.value); setRevealed(false); }}><option value="">先选预测</option><option value="ok">可提供核心结果</option><option value="failed">核心依赖来不及</option></select></label></div><button disabled={!guess} onClick={() => setRevealed(true)}>验证这组条件</button>{revealed && <div aria-live="polite"><p>{guess === result.response ? '预测一致。' : '观察后修正预测：'}{responseText[result.response]} @ {result.responseAt}ms。</p><ul>{result.calls.map(c => <li key={c.id}>{c.label}：{c.start === null ? '未启动' : c.start + 'ms 启动'} → {statusText[c.status]}（{c.end}ms）</li>)}</ul><p>若必需调用无法完成，降低排队耗时或增加额度后重新预测；可选推荐成功不是本题成功条件。</p></div>}</div>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="fan122 fan122-help" data-testid="concurrency-help-122">{mode === 'example' ? <HelpExample /> : mode === 'diagram' ? <HelpDiagram /> : mode === 'steps' ? <HelpSteps /> : <HelpTry />}</section>;
}


