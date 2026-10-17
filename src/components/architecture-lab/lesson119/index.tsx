import { useState } from 'react';
import { acceptGap, advance, close, configure, current, defaults, initial, pause, reconnect, retention, rewind, type Config, type LabState, type Policy } from './model';
import './style.css';
const policyNames: Record<Policy, string> = { unbounded: '无界缓存', backpressure: '有界背压', disconnect: '有界断开续读' };
const statusNames = { connected: '订阅中', disconnected: '已断开', cancelled: '已取消', gap: '续读有缺口' };
function Records({ ids }: { ids: number[] }) { return <div className="arch119-records">{ids.length ? ids.map((id, i) => <span key={i}>#{id}</span>) : <em>空</em>}</div>; }
function Scene({ state, selected, select }: { state: LabState; selected?: string; select?: (node: string) => void }) {
  const s = current(state);
  return <div className="arch119-scene">{[
    { key: 'log', title: '全局可重放日志', ids: s.log.map(e => e.id), text: '保留最近 ' + retention + ' 个逻辑步；本步新增 ' + s.produced + ' 条' },
    { key: 'queue', title: '单连接待发送队列', ids: s.queue, text: '占用 ' + s.queue.length + ' / ' + (s.config.policy === 'unbounded' ? '无上限' : s.config.capacity) + '；本步订阅拉取 ' + s.fetched + ' 条' },
    { key: 'client', title: '客户端已收到', ids: s.delivered, text: '确认游标 = ' + s.cursor + '；' + (s.paused ? '暂停读取' : '读取速率 ' + s.config.consumption + ' 条/步') },
  ].map(node => <article key={node.key} data-testid={'stream-' + node.key} className={selected === node.key ? 'arch119-selected' : ''}>{select ? <button aria-pressed={selected === node.key} onClick={() => select(node.key)}>{node.title}</button> : <h4>{node.title}</h4>}<Records ids={node.ids} /><p>{node.text}</p></article>)}<div className="arch119-metrics"><span>逻辑时钟 {s.tick}</span><strong data-testid="stream-status">{statusNames[s.status]}</strong><span>活跃订阅 {s.status === 'connected' ? 1 : 0}</span><span>订阅生产任务 {s.status === 'connected' ? 1 : 0}</span><span>本步上游减速 {s.throttled} 条</span></div>{s.gap && <p className="arch119-gap" data-testid="stream-gap">已过期缺口：#{s.gap[0]}～#{s.gap[1]}，无法从当前日志无损续读。</p>}{s.acceptedGaps.length > 0 && <p className="arch119-gap">明确接受的跳过范围：{s.acceptedGaps.map(g => '#' + g[0] + '～#' + g[1]).join('；')}</p>}</div>;
}
function Explorer({ example = false, steps = false }: { example?: boolean; steps?: boolean }) {
  const fresh = () => initial(example ? { ...defaults, policy: 'backpressure', production: 2, capacity: 3 } : undefined);
  const [state, setState] = useState<LabState>(fresh), [prediction, setPrediction] = useState(''), [captured, setCaptured] = useState('');
  const s = current(state);
  const scripted = ['tick', 'tick', 'reconnect', 'close', 'tick', 'tick', 'tick', 'tick', 'tick', 'reconnect'] as const;
  const i = state.history.length - 1;
  function tick() { setState(advance(state)); setCaptured(prediction); setPrediction(''); }
  function change(patch: Partial<Config>) { setState(configure(state, patch)); setCaptured(''); setPrediction(''); }
  function step() { if (!steps) { tick(); return; } const action = scripted[i]; setState(action === 'tick' ? advance(state) : action === 'reconnect' ? reconnect(state) : close(state)); }
  const nextName = !steps ? '推进一个逻辑步' : i >= scripted.length ? '演示完成' : scripted[i] === 'tick' ? '推进一个逻辑步' : scripted[i] === 'reconnect' ? '按游标尝试续读' : '模拟连接断开';
  return <><h3>{example ? '审计导出：上游能安全暂停时' : steps ? '过载、断开、重放与过期' : '慢客户端把等待留在哪里？'}</h3><p>{example ? '一条专用导出流允许暂停生成。先暂停读取，再推进数步，观察背压怎样限制源头；改为无界缓存对照。' : '按逻辑时间操作真实编号队列。每步先消费旧队列，再生成日志并入队；扩大缓存不会改变读取速率。'}</p>
    {!steps && <><div className="arch119-controls"><label>策略<select aria-label="策略" value={s.config.policy} onChange={e => change({ policy: e.target.value as Policy })}>{Object.entries(policyNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><label>生产速率（条/步）<input type="number" min="0" max="5" value={s.config.production} onChange={e => change({ production: Number(e.target.value) })} /></label><label>读取速率（条/步）<input type="number" min="0" max="5" value={s.config.consumption} onChange={e => change({ consumption: Number(e.target.value) })} /></label><label>缓冲上限（条）<input type="number" min="1" max="12" value={s.config.capacity} onChange={e => change({ capacity: Number(e.target.value) })} /></label></div><div className="arch119-actions"><button onClick={() => { setState(pause(state)); setCaptured(''); }}>{s.paused ? '恢复读取' : '暂停读取'}</button><button disabled={s.status !== 'connected'} onClick={() => { setState(close(state)); setCaptured(''); }}>主动断开</button><button disabled={s.status !== 'connected'} onClick={() => { setState(close(state, true)); setCaptured(''); }}>取消订阅</button><button disabled={s.status === 'connected'} onClick={() => { setState(reconnect(state)); setCaptured(''); }}>按游标新建订阅</button></div><label>可选预测：下一步连接状态<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">直接探索</option><option value="connected">仍订阅中</option><option value="disconnected">已断开</option><option value="gap">出现缺口</option><option value="cancelled">仍已取消</option></select></label></>}
    <div data-testid="live-model" data-state={JSON.stringify(state)}><Scene state={state} /></div>
    <div className="arch119-actions"><button data-arch-action="back" disabled={i === 0} onClick={() => { setState(rewind(state)); setCaptured(''); setPrediction(''); }}>回退一步</button><button data-arch-action="step" disabled={steps && i >= scripted.length} onClick={step}>{nextName}</button><button data-arch-action="reset" onClick={() => { setState(fresh()); setCaptured(''); setPrediction(''); }}>重置实验</button>{s.gap && <button onClick={() => { setState(acceptGap(state)); setCaptured(''); }}>接受跳过，改从最新位置订阅</button>}</div>
    <div className="arch119-feedback" aria-live="polite"><p>{s.event}</p>{captured && <p>预测：{statusNames[captured as keyof typeof statusNames]}；实际：{statusNames[s.status]}。结合队列余量、读取量与上游产量检查差异。</p>}</div>
    <p className="arch119-note">边界：背压假设这个上游能安全减速；不可减速的共享日志应选可重放隔离方案。取消停止本订阅的拉取任务并释放队列，全局日志源独立运行。保留期为 {retention} 个逻辑步，容量只计条数，不是内存或性能实测。缩小有界容量若容纳不了现有队列，会立即断开以维持上限。</p></>;
}
export default function Lesson119() { return <section className="arch119" data-testid="architecture-lab-119"><Explorer /></section>; }
export function Help({ mode }: { mode: string }) { return <aside className="arch119 arch119-help" data-testid="architecture-help-119"><p>辅助理解 · 不计入独立掌握</p>{mode === 'example' ? <Explorer key="example" example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Explorer key="steps" steps /> : <Challenge />}</aside>; }
function Diagram() {
  const [policy, setPolicy] = useState<Policy>('disconnect'), [selected, setSelected] = useState('queue'), [count, setCount] = useState(2);
  let state = initial({ production: 3, consumption: 0, capacity: 4, policy });
  for (let j = 0; j < count; j++) state = advance(state);
  return <><h3>全局日志 → 连接队列 → 客户端</h3><label>对照策略<select value={policy} onChange={e => setPolicy(e.target.value as Policy)}>{Object.entries(policyNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><label>客户端不读，推进几步<input type="range" min="1" max="7" value={count} onChange={e => setCount(Number(e.target.value))} /></label><Scene state={state} selected={selected} select={setSelected} /><p className="arch119-feedback" aria-live="polite">{selected === 'log' ? '日志保存可重放记录，但只保留最近四步。断开不停止独立日志源；背压仅在允许减速的上游成立。' : selected === 'queue' ? '连接队列是额外内存：无界时随不读取持续增长；背压暂停源头；断开策略释放整个连接队列。' : '客户端只有真正收到的记录才能推进确认游标。队列里的记录不等于已收到，续读需要从确认位置之后开始。'}</p></>;
}
function Challenge() {
  const [variant, setVariant] = useState(0), [answer, setAnswer] = useState(''), [reason, setReason] = useState(''), [submitted, setSubmitted] = useState(false);
  const cases = [
    { text: '专用文件导出源能安全暂停，每条内容都必须交付；客户端暂时不读取。应优先怎样控制单连接资源？', options: ['无限扩大队列', '有界缓冲，并让上游等待', '没有可靠交接就丢弃待发送内容'], expected: '1', feedback: '能减速且不可丢的数据适合有界背压。缓冲耗尽后等待会传到上游，恢复读取后再继续；扩大缓冲只延后满载。' },
    { text: '遥测日志保留 4 步，客户端游标是 2，重新连接时最早可读 ID 已是 10。可以承诺什么？', options: ['游标会自动恢复 3 到 9', '检测缺口 3 到 9，选择补充来源或明确接受缺口', '把游标改成 9 并声称无损'], expected: '1', feedback: '续读位置早于最早保留记录，3 到 9 已无法从当前日志获得。应报告缺口，另找持久来源或明确接受跳过，不能静默推进游标。' },
  ]; const item = cases[variant];
  function reset(next = variant) { setVariant(next); setAnswer(''); setReason(''); setSubmitted(false); }
  return <><h3>先判断，再查看资源后果</h3><p>{item.text}</p><label>你的判断<select value={answer} disabled={submitted} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option>{item.options.map((text, i) => <option key={text} value={i}>{text}</option>)}</select></label><label>判断理由<textarea value={reason} disabled={submitted} onChange={e => setReason(e.target.value)} placeholder="指出上游约束、可重放性或保留期证据" /></label><button disabled={!answer || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交并看反馈</button>{submitted && <div className="arch119-feedback" data-testid="challenge-feedback" aria-live="polite"><strong>{answer === item.expected ? '选择符合约束' : '选择与可靠性要求不符'}</strong><p>{item.feedback}</p><p>你的理由：{reason}</p><p>只核对选项；请自行检查理由是否覆盖这些约束，不自动评分。</p></div>}<div className="arch119-actions"><button onClick={() => reset()}>重试本题</button><button onClick={() => reset((variant + 1) % cases.length)}>换一个情境</button></div></>;
}

