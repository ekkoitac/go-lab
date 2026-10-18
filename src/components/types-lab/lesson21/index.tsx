import { useState } from 'react';
import { inspect, methodSet, repair, sources, type Config, type Outcome } from './model';
import './style.css';
const initial: Config = { source: 'local', route: 'direct' };
function View({ config, revealed }: { config: Config; revealed: boolean }) {
  const r = inspect(config);
  return <div className="t21-model" data-testid="live-model" data-state={`${config.source}:${config.route}:${revealed}:${revealed ? r.after : 'pending'}`}>
    <div className="t21-flow"><article><small>① 表达式与静态类型</small><strong>{r.expression} : {r.type}</strong><span>{r.addressable ? '可寻址的值' : r.type === '*Counter' ? '已有指针，无需取址' : '不可寻址的值'}</span></article><span aria-hidden="true">→</span><article><small>② 检查入口</small><strong>{config.route === 'direct' ? '直接调用' : 'Incrementer 接口赋值'}</strong><span>{revealed ? r.implicitAddress ? '调用语法隐式取址' : r.allowed ? '使用 *Counter 方法集' : '缺少可用的 Inc' : '等待检验'}</span></article><span aria-hidden="true">→</span><article><small>③ {r.target}</small><strong>N = {revealed ? r.after : 0}</strong><span>{revealed ? r.allowed ? '执行一次 Inc' : '编译失败，未执行' : '尚未执行'}</span></article></div>
    <div className="t21-sets"><div><strong>Counter 方法集</strong>{methodSet(false).map(m => <code key={m}>{m}()</code>)}</div><div><strong>*Counter 方法集</strong>{methodSet(true).map(m => <code key={m}>{m}()</code>)}</div></div>
  </div>;
}
export default function Lab() {
  const [config, setConfig] = useState<Config>(initial);
  const [history, setHistory] = useState<Config[]>([]);
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [baseline, setBaseline] = useState<Config | null>(null);
  const r = inspect(config);
  function clear() { setPrediction(''); setReason(''); setRevealed(false); }
  function change(next: Config) { setHistory([...history, config]); setConfig(next); clear(); }
  return <section className="types-21" data-testid="types-lab-21">
    <header><p className="t21-kicker">方法调用 ≠ 接口满足</p><h3>让同一个 Inc 走过两道检查门</h3><p>先试 c.Inc()，再只切换成 apply(c)：可寻址性会替接口补上方法吗？</p></header>
    <pre>{'type Counter struct { N int }\nfunc (c Counter) Read() int { return c.N }\nfunc (c *Counter) Inc() { c.N++ }\ntype Incrementer interface { Inc() }\nfunc apply(i Incrementer) { i.Inc() }'}</pre>
    <div className="t21-controls"><label>接收者来源<select value={config.source} onChange={e => change({ ...config, source: e.target.value as Config['source'] })}>{sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>操作入口<select value={config.route} onChange={e => change({ ...config, route: e.target.value as Config['route'] })}><option value="direct">直接调用 .Inc()</option><option value="interface">传给 apply(Incrementer)</option></select></label></div>
    <pre aria-label="本次执行代码">{r.code}</pre><View config={config} revealed={revealed} />
    <fieldset disabled={revealed}><legend>先记录预测与理由</legend><label>本次结果<select value={prediction} onChange={e => setPrediction(e.target.value as Outcome)}><option value="">请选择</option><option value="increment">编译成功，目标 N 变为 1</option><option value="compile-error">编译失败，目标 N 仍为 0</option></select></label><label>为什么？<textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="区分静态方法集、表达式可寻址性和当前入口" /></label></fieldset>
    <div className="t21-buttons"><button disabled={!prediction || !reason.trim() || revealed} onClick={() => setRevealed(true)}>验证预测</button><button disabled={!revealed} onClick={() => { setBaseline(config); }}>保留本次作为对照</button><button disabled={!history.length && !revealed} onClick={() => { if (revealed) { setRevealed(false); } else { setConfig(history[history.length - 1]); setHistory(history.slice(0, -1)); clear(); } }}>回退一步</button><button onClick={() => { setConfig(initial); setHistory([]); setBaseline(null); clear(); }}>重置实验</button></div>
    {revealed && <div className="t21-feedback" aria-live="polite"><strong>{prediction === r.outcome ? '预测吻合。' : '预测与结果不同。'}</strong><p>你记录的理由：{reason}</p><p>{r.reason}</p>{!r.allowed && <button onClick={() => { setBaseline(config); change(repair(config)); }}>修复为指针，再预测验证</button>}<p>下一步：{config.route === 'direct' ? '保持来源不变，切换接口入口，检验调用语法与接口满足是否相同。' : '换成 map 的结构体元素，比较直接调用与接口检查的边界。'}</p></div>}
    {baseline && <aside className="t21-feedback"><strong>已保留对照：{inspect(baseline).code}</strong><p>{inspect(baseline).allowed ? '编译成功，N：0 → 1' : '编译失败，N：0 → 0'}；当前方案{revealed ? `：${r.allowed ? '编译成功' : '编译失败'}，N：0 → ${r.after}` : '等待新预测与验证'}。</p></aside>}
    <p className="t21-boundary">模型边界：每次从 N=0 开始；m 是 map[string]Counter，mp 是 map[string]*Counter，键 x 存在且指针非 nil。这里只模拟这些固定表达式的静态规则，不执行任意 Go 代码。本实验与帮助均为辅助探索，不写入独立掌握成绩。</p>
  </section>;
}
function Example() {
  const [pointer, setPointer] = useState(false);
  return <><h4>通行证类比：登记类型，还是临时指路？</h4><p>把方法集看成登记在类型上的能力清单。直接调用时可以为手边的可寻址值“提供地址”；接口登记不会替你做这一步。</p><div className="t21-buttons"><button aria-pressed={!pointer} onClick={() => setPointer(false)}>拿 Counter 清单登记</button><button aria-pressed={pointer} onClick={() => setPointer(true)}>拿 *Counter 清单登记</button></div><div className="t21-flow" data-testid="live-model" data-state={String(pointer)}><article><strong>{pointer ? '*Counter' : 'Counter'}</strong><span>清单：{methodSet(pointer).join('、')}</span></article><span>→</span><article><strong>要求 Inc</strong><span>{pointer ? '满足 → 可登记为 Incrementer' : '缺少 → 不满足接口'}</span></article></div><p>类比边界：这是编译期方法集检查，不是运行时权限或证件系统。</p></>;
}
function Diagram() {
  const [config, setConfig] = useState<Config>({ source: 'local', route: 'direct' });
  return <><h4>双路径图：地址便利在哪条路上？</h4><p>改变一项条件，追踪“来源 → 检查入口 → 目标值”的因果路径。</p><div className="t21-controls"><label>来源<select value={config.source} onChange={e => setConfig({ ...config, source: e.target.value as Config['source'] })}>{sources.slice(0, 4).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>路径<select value={config.route} onChange={e => setConfig({ ...config, route: e.target.value as Config['route'] })}><option value="direct">直接调用</option><option value="interface">接口赋值后调用</option></select></label></div><View config={config} revealed /><p>{inspect(config).reason}</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const stages = [ ['读取 map 元素', 'tmp := m["x"]', 0, 0], ['修改可寻址副本', 'tmp.Inc() // 等价于 (&tmp).Inc()', 1, 0], ['显式写回 map', 'm["x"] = tmp', 1, 1] ] as const;
  return <><h4>分步修复：保留 map[string]Counter</h4><p>不能取址 map 元素时，还能取出副本、修改、再写回。单步观察哪一行真正改变 map。</p><div className="t21-model" data-testid="live-model" data-state={step}><strong>{stages[step][0]}</strong><pre>{stages[step][1]}</pre><div className="t21-sets"><article>局部 tmp.N = <strong>{stages[step][2]}</strong></article><article>map 元素 N = <strong>{stages[step][3]}</strong></article></div><p>{step === 0 ? '赋值复制 Counter；tmp 是局部变量，可寻址。' : step === 1 ? 'Inc 只修改 tmp；map 仍为 0。遗漏写回将丢失这次更新。' : '最后的 map 赋值把新值保存进去；没有尝试获取 map 元素地址。'}</p></div><div className="t21-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 2} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>重新推导</button></div><p>范围：单线程、键存在；并发更新的同步不属于本模型。</p></>;
}
function Transfer() {
  const [pointer, setPointer] = useState(false);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  return <><h4>换情境：Reset 接口的反例挑战</h4><p>Meter 有值接收者 Read() 和指针接收者 Reset()。局部变量 x 可寻址，x.Reset() 合法。预测下列接口赋值。</p><pre>{`type Resetter interface { Reset() }\nvar r Resetter = ${pointer ? '&x' : 'x'}`}</pre><label>提交的表达式<select value={String(pointer)} onChange={e => { setPointer(e.target.value === 'true'); setAnswer(''); setReason(''); setChecked(false); }}><option value="false">x：Meter</option><option value="true">&x：*Meter</option></select></label><fieldset disabled={checked}><legend>先提交判断</legend><label>能否编译<select value={answer} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="yes">可以</option><option value="no">不可以</option></select></label><label>解释方法集与取址规则<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="t21-buttons"><button disabled={!answer || !reason.trim() || checked} onClick={() => setChecked(true)}>核对迁移判断</button><button onClick={() => { setAnswer(''); setReason(''); setChecked(false); }}>重新作答</button></div><div data-testid="live-model" data-state={`${pointer}:${checked}`} aria-live="polite">{checked && <div className="t21-feedback"><strong>{(answer === 'yes') === pointer ? '判断吻合。' : '请分开检查调用和接口赋值。'}</strong><p>你的理由：{reason}</p><p>{pointer ? '*Meter 方法集含 Reset，因此满足 Resetter。' : 'Meter 方法集只有 Read；x 可寻址也不会让接口赋值自动取址。'} x.Reset() 的便利不改变 Meter 的方法集。</p></div>}</div></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="types-21 t21-help" data-testid="types-help-21">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="t21-boundary">帮助与迁移题提供辅助反馈，不计入独立掌握成绩。</p></section>;
}
