import { useState } from 'react';
import { scopeTrace, transferResult, type ScopeConfig, type ScopeFrame, type Operator } from './model';
import './style.css';

const initial: ScopeConfig = { original: 100, replacement: 80, operator: ':=', branch: true };
function ScopeView({ frame }: { frame: ScopeFrame }) {
  return <div className="fl1-scope"><strong>外层块</strong><div className={`fl1-binding ${frame.read === 'outer' ? 'fl1-active' : ''}`}>绑定 A · price = <b>{frame.outer}</b>{frame.read === 'outer' && <span> ← 本次读取</span>}</div><div className={`fl1-inner ${frame.inBlock ? 'fl1-entered' : ''}`}><strong>if 内层块 · {frame.inBlock ? '正在此处执行' : '当前不在此处'}</strong><div className={`fl1-binding ${frame.read === 'inner' ? 'fl1-active' : ''}`}>{frame.inner === null ? '绑定 B：不存在 / 已离开作用域' : <>绑定 B · price = <b>{frame.inner}</b>{frame.read === 'inner' && <span> ← 本次读取</span>}</>}</div></div><p>返回值：<output>{frame.output === null ? '尚未执行 return' : frame.output}</output></p></div>;
}
function Code({ config, line }: { config: ScopeConfig; line: number }) {
  const rows = [`price := ${config.original}`, `if ${config.branch} {`, `  price ${config.operator} ${config.replacement}`, '  _ = price', '}', 'return price'];
  return <ol className="fl1-code" aria-label="已执行语句">{rows.map((row, i) => <li key={i} aria-current={i === line ? 'step' : undefined}><code>{row}</code>{i === line && <span className="fl1-marker"> ← 当前</span>}</li>)}</ol>;
}
export default function Lab() {
  const [config, setConfig] = useState<ScopeConfig>(initial);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const [compare, setCompare] = useState(false);
  const frames = scopeTrace(config);
  const frame = frames[step];
  const restart = () => { setStep(0); setPrediction(''); setReason(''); setLocked(false); setCompare(false); };
  const change = (next: Partial<ScopeConfig>) => { setConfig({ ...config, ...next }); restart(); };
  return <section className="fl1" data-testid="foundations-lab-1"><header><p className="fl1-kicker">操作的是哪一个 price？</p><h3>把同名变量拆成两张身份卡</h3><p>先预测结账金额，再逐句追踪绑定 A / B。只改一个运算符，观察写入目标如何变化。</p></header>
    <div className="fl1-controls">{(['original', 'replacement'] as const).map(key => <label key={key}>{key === 'original' ? '原价' : '分支内价格'}<input type="number" min="0" max="999" step="1" value={config[key]} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 999) change({ [key]: n }); }} /></label>)}<label>分支中的运算符<select value={config.operator} onChange={e => change({ operator: e.target.value as Operator })}><option value=":=">:= 声明</option><option value="=">= 赋值</option></select></label><label>分支条件<select value={String(config.branch)} onChange={e => change({ branch: e.target.value === 'true' })}><option value="true">true · 进入分支</option><option value="false">false · 跳过分支</option></select></label></div>
    <fieldset disabled={locked}><legend>先写下预测</legend><label>最终 return price 是多少？<input type="number" value={prediction} onChange={e => setPrediction(e.target.value)} /></label><label>为什么会读到这个变量？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="说清楚写入了哪张身份卡，以及离开 if 后读取谁。" /></label></fieldset>
    <div className="fl1-actions"><button disabled={locked || prediction === '' || !reason.trim()} onClick={() => { setLocked(true); setStep(1); }}>记录预测并开始追踪</button><button disabled={!locked || step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button disabled={!locked || step === 5} onClick={() => setStep(step + 1)}>单步执行</button><button onClick={() => { setConfig(initial); restart(); }}>重置实验</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({ config, step, locked, compare })}><div className="fl1-grid"><Code config={config} line={step} /><ScopeView frame={frame} /></div><div className="fl1-feedback" aria-live="polite"><strong>{step + 1}/6 · {frame.phase}</strong><p>{frame.change}</p>{step < 5 && <small>下一步：{frames[step + 1].phase}</small>}{step === 5 && <><p>{Number(prediction) === frame.output ? '数值预测吻合。请同时核对绑定身份。' : `预测为 ${prediction}，实际为 ${frame.output}。请沿上面的 A / B 检查差异。`}</p><p>已记录理由：{reason}</p><button onClick={() => setCompare(!compare)}>{compare ? '收起对照' : '对照同一输入下的 := 与 ='}</button></>}{compare && step === 5 && <div className="fl1-compare">{([':=', '='] as const).map(operator => { const trace = scopeTrace({ ...config, operator }); return <article key={operator}><strong>只把运算符设为 {operator}</strong><p>{trace[2].change}</p><p>return = {trace[5].output}</p></article>; })}<p>{config.original === config.replacement ? '本次两值相同，输出不能区分是否遮蔽；把分支内价格改成不同值再试。' : !config.branch ? '分支未执行，两种运算符都没有生效。把条件改为 true 后重新预测。' : '保持输入和条件一致，差别来自声明新绑定还是更新已有绑定。'}</p></div>}</div></div><p className="fl1-boundary">模型边界：0–999 整数，单个嵌套块，展示词法绑定而非物理内存。内层离开作用域不表示必须立即回收存储。同一块单独重复 price := 值 会因没有新变量而报错；本实验的 := 在内层块中。辅助实验不计入正式掌握。</p>
  </section>;
}

function Example() {
  const [target, setTarget] = useState<'A' | 'B'>('B');
  const [sent, setSent] = useState(false);
  return <><h4>举例子：两间办公室都有小李</h4><p>总办小李 A 的工号是 100。分办新来一位同名小李 B，工号是 80。你要把总办工号改成 60，应把通知送给谁？</p><label>送达对象<select value={target} onChange={e => { setTarget(e.target.value as 'A' | 'B'); setSent(false); }}><option value="B">分办的小李 B</option><option value="A">总办的小李 A</option></select></label><div className="fl1-actions"><button onClick={() => setSent(true)}>送达改号通知</button><button onClick={() => { setTarget('B'); setSent(false); }}>重置通知</button></div><div className="fl1-grid" data-testid="live-model" data-state={`${target}:${sent}`}><article className={sent && target === 'A' ? 'fl1-active' : ''}>总办 A · 工号 {sent && target === 'A' ? 60 : 100}</article><article className={sent && target === 'B' ? 'fl1-active' : ''}>分办 B · 工号 {sent && target === 'B' ? 60 : 80}</article></div>{sent && <p aria-live="polite">{target === 'B' ? '通知执行成功，但总办 A 仍是 100。名字相同并不让修改同步。' : 'A 变为 60，B 仍是 80。修改必须命中正确身份。'}</p>}<p className="fl1-boundary">类比边界：程序按词法作用域解析名称，不能在内层有同名绑定时随意指定“外层 price”。要更新外层，需要避免创建 B，或换一个内层名字。</p></>;
}
function Diagram() {
  const [operator, setOperator] = useState<Operator>(':=');
  const [location, setLocation] = useState<'inside' | 'outside'>('inside');
  const trace = scopeTrace({ ...initial, operator });
  const frame = trace[location === 'inside' ? 3 : 5];
  return <><h4>画图：让读取点找到自己的绑定</h4><p>切换读取点，追踪“从当前块向外查找最近同名变量”的路径。</p><label>构造分支<select value={operator} onChange={e => setOperator(e.target.value as Operator)}><option value=":=">price := 80</option><option value="=">price = 80</option></select></label><div className="fl1-actions"><button aria-pressed={location === 'inside'} onClick={() => setLocation('inside')}>点选块内 _ = price</button><button aria-pressed={location === 'outside'} onClick={() => setLocation('outside')}>点选块外 return price</button></div><div data-testid="live-model" data-state={`${operator}:${location}`}><div className="fl1-path">读取点：{location === 'inside' ? 'if 内' : 'if 外'} → {frame.read === 'inner' ? '当前块有 B → 停止查找' : location === 'inside' ? '当前块无 B → 向外找到 A' : '外层块找到 A'} → 值 {frame.read === 'inner' ? frame.inner : frame.outer}</div><ScopeView frame={frame} /></div></>;
}
function Steps() {
  const [operator, setOperator] = useState<Operator>(':=');
  const [step, setStep] = useState(0);
  const config = { ...initial, operator };
  const trace = scopeTrace(config);
  return <><h4>拆步骤：修好结账路径</h4><p>目标是让账单变成 80。先选择分支语句，再沿真实执行顺序验证每一步写入和读取的身份。</p><label>你构建的语句<select value={operator} onChange={e => { setOperator(e.target.value as Operator); setStep(0); }}><option value=":=">price := 80</option><option value="=">price = 80</option></select></label><div className="fl1-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>回退</button><button disabled={step === 5} onClick={() => setStep(step + 1)}>执行下一句</button><button onClick={() => setStep(0)}>重新运行</button></div><div data-testid="live-model" data-state={`${operator}:${step}`}><Code config={config} line={step} /><ScopeView frame={trace[step]} /><p aria-live="polite">{trace[step].change}</p>{step === 5 && <div className="fl1-feedback">{trace[step].output === 80 ? '修复验证：写 A、读 A，账单达到目标。' : '未达到目标：分支创建 B，return 却读 A。修改分支运算符重新验证。'}</div>}</div></>;
}
function Transfer() {
  const [declare, setDeclare] = useState(true);
  const [original, setOriginal] = useState(3);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const result = transferResult(declare, original);
  const clear = () => { setAnswer(''); setReason(''); setChecked(false); };
  return <><h4>让我试试：加一次 = 就能更新外层吗？</h4><p>这是有反馈的迁移练习，不写入正式测验成绩。内层第二次使用 =，请追踪它实际更新谁。</p><label>外层初值<select value={original} onChange={e => { setOriginal(Number(e.target.value)); clear(); }}><option value={3}>3</option><option value={12}>12</option><option value={0}>0</option></select></label><label>内层第一句<select value={String(declare)} onChange={e => { setDeclare(e.target.value === 'true'); clear(); }}><option value="true">x := 7</option><option value="false">x = 7</option></select></label><pre className="fl1-snippet">{`x := ${original}\n{\n  x ${declare ? ':=' : '='} 7\n  x = 9\n  _ = x\n}\nreturn x`}</pre><fieldset disabled={checked}><legend>先预测，再核对</legend><label>最终返回值<input type="number" value={answer} onChange={e => setAnswer(e.target.value)} /></label><label>解释 x = 9 写入哪个绑定<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="fl1-actions"><button disabled={checked || answer === '' || !reason.trim()} onClick={() => setChecked(true)}>核对推理</button><button onClick={clear}>重新作答</button></div><div data-testid="live-model" data-state={`${declare}:${original}:${checked}`} aria-live="polite">{checked && <div className="fl1-feedback"><strong>{Number(answer) === result.outer ? '返回值预测吻合。' : `返回值应为 ${result.outer}，而不是 ${answer}。`}</strong><p>你的解释：{reason}</p><p>x = 9 写入最近的绑定 {result.writesTo}。块内读到 9，块外读到 {result.outer}。{declare ? '只把后续写入改成 = 不会绕过已经存在的 B；把内层第一句也改为 = 后再试。' : '内层从未建立 B，两次赋值都落在 A。'}</p></div>}</div></>;
}
export function Help({ mode }: { mode: string }) { return <section className="fl1 fl1-help" data-testid="foundations-help-1" key={mode}>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>; }

