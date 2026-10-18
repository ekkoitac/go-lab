import { useState } from 'react';
import { allowed, baseline, comparison, inspect, initial, replay, transferTasks, transition, type Action, type Config, type State } from './model';
import './style.css';
const names: Record<Action, string> = { cap: '限制 token 容量', copy: '复制 token 到独立数组', 'drop-buffer': '删除 buffer 引用', 'keep-alias': '保留其他别名', 'drop-alias': '删除其他别名' };
function Graph({ state }: { state: State }) {
  const s = inspect(state);
  return <div className="c17-graph"><div className="c17-roots"><span className={!s.buffer ? 'c17-off' : ''}>buffer {s.buffer ? '→ A' : '= nil'}</span><span className="c17-token">token → {s.token}<small>len={s.window} · cap={s.capacity}</small></span><span className={!s.alias ? 'c17-off' : ''}>other {s.alias ? '→ A' : '= nil / 未建立'}</span></div><div className="c17-arrays"><article className={s.aReachable ? 'c17-array' : 'c17-array c17-eligible'}><strong>A · 底层大数组 {s.bytes} 字节</strong><div className="c17-strip"><span>前 {s.window} 字节</span><span>其余 {s.bytes - s.window} 字节</span></div><p>{s.aReachable ? `仍可达：${s.roots.join('、')} → A` : '无引用到达 A：具备回收条件，未宣称已回收'}</p></article>{s.token === 'B' && <article className="c17-array"><strong>B · 独立数组 {s.window} 字节</strong><p>token → B · 已复制 {s.copiedBytes} 字节</p></article>}</div></div>;
}
function Prediction({ answer, reason, onAnswer, onReason, disabled = false }: { answer: string; reason: string; onAnswer: (v: string) => void; onReason: (v: string) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled}><legend>先判断，再查看结果</legend><label>操作后 A 是否仍可达？<select aria-label="操作后 A 是否仍可达？" value={answer} onChange={e => onAnswer(e.target.value)}><option value="">请选择</option><option value="yes">仍可达</option><option value="no">不再可达，具备回收条件</option></select></label><label>哪条引用支持你的判断？<textarea rows={2} value={reason} onChange={e => onReason(e.target.value)} /></label></fieldset>;
}
export default function Lab() {
  const [config, setConfig] = useState<Config>(baseline);
  const [history, setHistory] = useState<Action[]>([]);
  const [action, setAction] = useState<Action>('cap');
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('先选操作，沿引用图预测大数组是否仍可达。');
  const s = replay(config, history);
  const pair = comparison(config);
  const reset = (next: Config) => { setConfig(next); setHistory([]); setAction('cap'); setAnswer(''); setReason(''); setFeedback('已恢复基线。改变条件后，请重新预测。'); };
  return <section className="c17" data-testid="collections-lab-17"><header><p className="c17-eyebrow">日志缓存 · 追踪保留链</p><h3>两字节窗口，能放走整块缓冲区吗？</h3><p>建立或断开引用，观察原数组的可达性；复制要付出多少成本？</p></header><div className="c17-controls"><label>原数组字节数<select aria-label="原数组字节数" value={config.bytes} onChange={e => reset({...config, bytes: Number(e.target.value)})}><option value="1024">1024</option><option value="4096">4096</option></select></label><label>窗口字节数<select aria-label="窗口字节数" value={config.window} onChange={e => reset({...config, window: Number(e.target.value)})}><option value="2">2</option><option value="8">8</option></select></label></div><pre>{`buffer := make([]byte, ${config.bytes})\ntoken := buffer[:${config.window}]\n// 当前 token → ${s.token}，len=${s.window}，cap=${s.capacity}`}</pre><div data-testid="live-model" data-state={JSON.stringify(s)}><p className="c17-operation">第 {history.length} 步 · {s.operation}</p><Graph state={s} /><div className="c17-metrics"><span>可达数组有效载荷：{s.reachablePayloadBytes} 字节</span><span>本实验复制量：{s.copiedBytes} 字节</span></div></div><label>下一步操作<select aria-label="下一步操作" value={action} onChange={e => { setAction(e.target.value as Action); setAnswer(''); setReason(''); }}>{Object.entries(names).map(([key, name]) => <option value={key} key={key}>{name}{!allowed(s, key as Action) ? '（当前不适用）' : ''}</option>)}</select></label><Prediction answer={answer} reason={reason} onAnswer={setAnswer} onReason={setReason} /><div className="c17-actions"><button disabled={!allowed(s, action) || !answer || !reason.trim()} onClick={() => { const next = inspect(transition(s, action)); setHistory([...history, action]); setFeedback(`${(answer === 'yes') === next.aReachable ? '预测吻合' : '预测需要修正'}：${next.operation}。${next.aReachable ? `A 仍由 ${next.roots.join('、')} 保留` : 'A 已无可达引用，具备回收条件'}。你的依据：${reason}`); setAnswer(''); setReason(''); }}>执行所选操作</button><button disabled={!history.length} onClick={() => { setHistory(history.slice(0, -1)); setAnswer(''); setReason(''); setFeedback('已回退一步。可换一个操作，从这里探索另一条路径。'); }}>回退一步</button><button onClick={() => reset({...baseline})}>重置实验</button></div><p className="c17-feedback" aria-live="polite">{feedback}</p><details><summary>对照：都删除 buffer 后，限制容量与复制有何不同？</summary><div className="c17-comparison"><article><strong>只限制容量</strong><Graph state={pair.cap} /><p>复制 0 字节；可达载荷 {pair.cap.reachablePayloadBytes} 字节。</p></article><article><strong>独立复制</strong><Graph state={pair.clone} /><p>复制 {pair.clone.copiedBytes} 字节；可达载荷 {pair.clone.reachablePayloadBytes} 字节。</p></article></div><p>此对照使用初始条件，且没有 other 引用。主实验可自行增加 other，构造“已复制却仍保留 A”的反例。</p></details><p className="c17-boundary">模型边界：图中每条箭头都是仍需使用的强引用。实际编译器会分析存活性；这里不模拟 GC 时间、堆开销或分配器取整。可达载荷按数组逻辑字节数计算，不是进程内存实测；cap 是切片边界，不是整个分配对象大小。复制有成本，短生命周期不必一律复制。探索不写正式成绩。</p></section>;
}
function Example() {
  const [copy, setCopy] = useState(false);
  const [kept, setKept] = useState(true);
  const s = replay({bytes:4096,window:8,alias:kept},copy ? ['copy','drop-buffer'] : ['cap','drop-buffer']);
  return <><h4>书签还是复印页？构造保留整本书的反例</h4><p>归还原书（buffer = nil）后，缓存保存 8 字节摘要。选择存书签或复印页，再决定同事是否保留另一张书签。</p><div className="c17-actions"><button aria-pressed={!copy} onClick={() => setCopy(false)}>缓存书签：只限容量</button><button aria-pressed={copy} onClick={() => setCopy(true)}>缓存复印页：独立复制</button></div><label className="c17-check"><input type="checkbox" checked={kept} onChange={e => setKept(e.target.checked)} />同事仍保留书签 other</label><div data-testid="live-model" data-state={JSON.stringify(s)}><Graph state={s} /><p className="c17-feedback">{s.aReachable ? `整本书仍由 ${s.roots.join('、')} 保留。${copy ? '已复印仍不足以解除同事的引用，试着归还另一张书签。' : '只缩小书签可见范围，不会把书页移到新地方。'}` : '所有原书引用均已解除，原书具备回收条件；复印付出 8 字节的复制量。'}</p></div><p>类比边界：书签只表示引用；GC 不承诺“归还”瞬间释放内存。</p></>;
}
function Diagram() {
  const [buffer, setBuffer] = useState(true);
  const [alias, setAlias] = useState(true);
  const [target, setTarget] = useState<'A'|'B'>('A');
  const s = inspect({...initial({bytes:2048,window:4,alias}),buffer,token:target,capacity:4,copiedBytes:target==='B'?4:0});
  return <><h4>做一次可达性标记：哪些根能走到 A？</h4><p>构建一张假想的存活引用图，勾选存活根，把 token 连到 A 或独立 B。它不是程序执行顺序；每次修改都重新计算可达性。</p><div className="c17-controls"><label className="c17-check"><input type="checkbox" checked={buffer} onChange={e => setBuffer(e.target.checked)} />根 buffer 存活</label><label className="c17-check"><input type="checkbox" checked={alias} onChange={e => setAlias(e.target.checked)} />根 other 存活</label><label>token 连接到<select aria-label="token 连接到" value={target} onChange={e => setTarget(e.target.value as 'A'|'B')}><option value="A">A 的小窗口</option><option value="B">独立数组 B</option></select></label></div><div data-testid="live-model" data-state={JSON.stringify(s)}><Graph state={s} /></div><p className="c17-feedback">标记结果：{s.aReachable ? `${s.roots.length} 条路径到达 A，A 必须保留。` : '没有路径到达 A，A 具备回收条件。'}token 的 cap 始终为 4，改变 cap 数值不能替代断边。</p></>;
}
function Steps() {
  const actions: Action[] = ['copy','drop-buffer','drop-alias'];
  const [phase,setPhase] = useState(0);
  const s = replay({bytes:1024,window:2,alias:true},actions.slice(0,phase));
  return <><h4>拆解修复：复制之后，还要追踪谁？</h4><ol className="c17-sequence">{['基线：buffer、token、other 都指向 A','复制 token 到 B','清空 buffer','清空 other'].map((text,i)=><li key={text} aria-current={phase===i?'step':undefined}>{i===phase?'▶ ':''}{text}</li>)}</ol><div data-testid="live-model" data-state={JSON.stringify({...s,phase})}><Graph state={s} /></div><p className="c17-feedback">{s.operation}。{s.aReachable?`下一步请追踪剩下的 ${s.roots.join('、')}。`:'直到最后一条引用消失，A 才具备回收条件。'}</p><div className="c17-actions"><button disabled={phase===3} onClick={()=>setPhase(phase+1)}>执行下一步</button><button disabled={phase===0} onClick={()=>setPhase(phase-1)}>返回上一步</button><button onClick={()=>setPhase(0)}>重放修复</button></div></>;
}
function Transfer() {
  const [variant,setVariant] = useState(0);
  const [answer,setAnswer] = useState('');
  const [reason,setReason] = useState('');
  const [checked,setChecked] = useState(false);
  const task = transferTasks[variant];
  const s = replay(task,task.actions);
  return <><h4>新情境：{task.title}</h4><p>原数组 {task.bytes} 字节，小窗口 {task.window} 字节。{task.alias?'开始时另有 other 引用原数组。':'没有其他别名。'}执行下面操作后，判断原数组 A 的可达性，并说明依据。clone 表示分配适当长度并复制。</p><pre>{task.code}</pre><Prediction answer={answer} reason={reason} onAnswer={setAnswer} onReason={setReason} disabled={checked}/><div className="c17-actions"><button disabled={checked||!answer||!reason.trim()} onClick={()=>setChecked(true)}>提交并核对</button><button onClick={()=>{setVariant((variant+1)%transferTasks.length);setAnswer('');setReason('');setChecked(false);}}>换个新情境</button></div><div data-testid="live-model" data-state={JSON.stringify({variant,checked,evidence:checked?'revealed-practice':'unrevealed-attempt',...(checked?{result:s}:{})})} aria-live="polite">{checked&&<><p className="c17-feedback">{(answer==='yes')===s.aReachable?'本次预测吻合。':'本次预测需要修正。'}{s.aReachable?`A 仍由 ${s.roots.join('、')} 引用。`:'所有原数组引用已断开，A 具备回收条件，但不保证已被 GC 回收。'}复制量为 {s.copiedBytes} 字节。你的依据：{reason}</p><Graph state={s}/></>}</div><p>结果揭示后属于练习探索；不记录正式成绩。换个新情境后重新独立判断。</p></>;
}
export function Help({mode}:{mode:string}) { return <section className="c17 c17-help" data-testid="collections-help-17">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Transfer/>}</section>; }
