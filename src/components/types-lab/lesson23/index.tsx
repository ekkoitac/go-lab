import { useState } from 'react';
import { buildTree, describe, initial, resolve, shippingPath, type Branch, type Config, type Outcome, type Resolution } from './model';
import './style.css';

function Tree({ tree, result, onPick, scanDepth }: { tree: Branch; result?: Resolution; onPick?: (path: string) => void; scanDepth?: number }) {
  function branch(node: Branch, path: string, depth: number) {
    const selected = result?.candidates.some(candidate => candidate.path === path);
    return <li key={path} className={selected ? result?.outcome === 'ambiguous' ? 't23-ambiguous' : 't23-selected' : ''} data-depth={depth}>
      <span className={scanDepth === depth && node.origin ? 't23-scanning' : ''}>{node.origin ? <>{onPick ? <button onClick={() => onPick(path)} aria-label={`选择完整路径 ${path}`}>City = {node.value}</button> : <code>City = {node.value}</code>}<small>深度 {depth}</small></> : <strong>{node.name}</strong>}</span>
      {!!node.children.length && <ul>{node.children.map(child => branch(child, `${path}.${child.name}`, child.origin ? depth : depth + 1))}</ul>}
    </li>;
  }
  return <div className="t23-tree" aria-label="嵌入字段树：连线表示结构体包含关系"><ul>{branch(tree, tree.name, 0)}</ul><p>连线 = 包含关系；深度 = 从 o 穿过的嵌入字段数。{onPick && '点击 City 节点可生成完整访问路径。'}</p></div>;
}
function Predictions({ value, onChange }: { value: string; onChange: (value: Outcome) => void }) {
  return <label>预测选择结果<select value={value} onChange={e => onChange(e.target.value as Outcome)}><option value="">先选择</option><option value="ambiguous">编译失败：同深度歧义</option><option value="missing">编译失败：字段不存在</option><option value="outer">读取外层 City（北京）</option><option value="billing">读取 Billing.City（上海）</option><option value="shipping">读取 Shipping.City（杭州）</option></select></label>;
}
export default function Lab() {
  const [config, setConfig] = useState<Config>({ ...initial });
  const [history, setHistory] = useState<Config[]>([]);
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [compare, setCompare] = useState(false);
  const [feedback, setFeedback] = useState('初始结构同时嵌入 Billing 与 Shipping。先判断 o.City 是否能唯一定位。');
  const tree = buildTree(config);
  const result = resolve(tree, config.selector);
  const clear = () => { setPrediction(''); setReason(''); setRevealed(false); };
  const change = (next: Config, message: string) => { setHistory([...history, config]); setConfig(next); clear(); setFeedback(message); };
  const reset = () => { setConfig({ ...initial }); setHistory([]); setCompare(false); clear(); setFeedback('已恢复两个同层嵌入字段与 o.City。'); };
  return <section className="types-23" data-testid="types-lab-23">
    <header><p className="t23-eyebrow">构建字段树 → 预测查找 → 显式路径修复</p><h3>一个 City，究竟沿哪条路径读取？</h3><p>目标：通过改变嵌入层级，区分最浅唯一、同深度歧义和外层遮蔽。先解释自己的判断，再让模型验证。</p></header>
    <div className="t23-controls"><label><input type="checkbox" checked={config.billing} onChange={e => change({ ...config, billing: e.target.checked }, e.target.checked ? '加入 Billing，增加一条深度 1 的 City 路径。' : '移除 Billing，账单 City 路径消失。')} />嵌入 Billing（上海）</label>
      <label>Shipping 放置位置<select value={config.shipping} onChange={e => change({ ...config, shipping: e.target.value as Config['shipping'] }, 'Shipping 层级已改变，字段树同步更新；现有选择器保留供诊断。')}><option value="direct">直接嵌入：深度 1</option><option value="nested">放进 Envelope：深度 2</option><option value="off">移除 Shipping</option></select></label>
      <label><input type="checkbox" checked={config.outer} onChange={e => change({ ...config, outer: e.target.checked }, e.target.checked ? '外层新增 City（北京），深度为 0；内部 City 没有被删除。' : '移除外层 City，内部路径保留。')} />外层声明 City（北京）</label>
      <label>要编译的选择器<select value={config.selector} onChange={e => change({ ...config, selector: e.target.value }, '只改变读取路径；字段结构和城市值保持不变。')}>{Array.from(new Set(['o.City', 'o.Billing.City', 'o.Shipping.City', 'o.Envelope.City', 'o.Envelope.Shipping.City', config.selector])).map(path => <option key={path}>{path}</option>)}</select></label>
    </div>
    <div className="t23-model" data-testid="live-model" data-state={JSON.stringify({ ...config, revealed })}>
      <Tree tree={tree} result={revealed ? result : undefined} onPick={path => change({ ...config, selector: path }, `选择节点生成 ${path}；这次访问明确指出每一层字段。`)} />
      <div className="t23-query"><code>return {config.selector}</code><span>→</span><strong>{revealed ? describe(result) : '等待预测与验证'}</strong></div>
    </div>
    <p className="t23-feedback" role="status">{feedback}</p>
    <fieldset disabled={revealed}><legend>先预测，再解释查找依据</legend><Predictions value={prediction} onChange={setPrediction} /><label>你的理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="从哪里开始查找？最浅深度有几条 City 路径？" /></label></fieldset>
    <div className="t23-buttons"><button disabled={!prediction || !reason.trim() || revealed} onClick={() => setRevealed(true)}>验证选择器</button><button disabled={!history.length} onClick={() => { setConfig(history[history.length - 1]); setHistory(history.slice(0, -1)); clear(); setFeedback('已回退一次结构或路径操作，请重新预测。'); }}>回退操作</button><button onClick={reset}>重置实验</button></div>
    {revealed && <div className="t23-feedback" aria-live="polite"><strong>{prediction === result.outcome ? '预测吻合。' : '预测与实际规则不同。'}</strong><p>你的理由：{reason}</p><p>{result.explanation}</p><p>下一步：保持城市值不变，只改变一个条件，检查原来的结论是否仍成立。</p></div>}
    <div className="t23-buttons"><button disabled={config.shipping === 'off'} onClick={() => { setCompare(true); change({ ...config, selector: shippingPath(config) }, '已使用辅助修复：指定送货城市的完整路径。保留相同结构下 o.City 作为对照，验证后查看差异。'); }}>辅助修复：明确读取送货城市</button></div>
    {compare && revealed && <div className="t23-compare"><article><h4>同一结构 · 简写访问</h4><code>o.City</code><p>{describe(resolve(buildTree(config), 'o.City'))}</p></article><article><h4>当前访问</h4><code>{config.selector}</code><p>{describe(result)}</p></article></div>}
    <p className="t23-boundary">模型边界：仅模拟此树中字符串字段 City 的选择器查找和嵌入路径；不执行 Go，不模拟方法集、指针嵌入或继承。所有观察、提示、修复和帮助均为练习，不写入独立掌握成绩。</p>
  </section>;
}

function Example() {
  const [outer, setOuter] = useState(false);
  const [path, setPath] = useState('o.City');
  const tree = buildTree({ ...initial, outer });
  const result = resolve(tree, path);
  return <><h4>文件夹类比：先在当前桌面找城市卡</h4><p>桌面有账单和送货两个文件夹，内部各有 City 卡。改变桌面卡片，再指定要打开的文件夹。</p><div className="t23-buttons"><button aria-pressed={outer} onClick={() => setOuter(!outer)}>{outer ? '拿走桌面 City 卡' : '在桌面放 City = 北京'}</button><button onClick={() => setPath('o.City')}>只说 City</button><button onClick={() => setPath('o.Shipping.City')}>打开 Shipping 再取 City</button></div><div data-testid="live-model" data-state={`${outer}:${path}`}><Tree tree={tree} result={result} /><p><code>{path}</code> → {describe(result)}</p></div><p>{result.explanation}</p><p>对应：文件夹是嵌入结构体，路径是选择器。局限：真实文件系统没有这条最浅唯一规则；Go 嵌入也不产生传统继承关系。</p></>;
}
function Diagram() {
  const [nested, setNested] = useState(false);
  const [path, setPath] = useState('o.City');
  const config: Config = { ...initial, shipping: nested ? 'nested' : 'direct', selector: path };
  const tree = buildTree(config);
  const result = resolve(tree, path);
  return <><h4>路径图：移动一层，候选关系怎样改变？</h4><p>点击 City 节点，联动生成完整选择器。把 Shipping 放深一层后，再比较 o.City。</p><div className="t23-buttons"><button aria-pressed={nested} onClick={() => { setNested(!nested); setPath('o.City'); }}>切换 Shipping：{nested ? '深度 2 → 深度 1' : '深度 1 → 深度 2'}</button><button onClick={() => setPath('o.City')}>查询简写 o.City</button></div><div data-testid="live-model" data-state={`${nested}:${path}`}><Tree tree={tree} result={result} onPick={setPath} /><code>{path}</code><p>{describe(result)}</p><p>{result.explanation}</p></div></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [outer, setOuter] = useState(false);
  const config: Config = { ...initial, outer, shipping: 'nested' };
  const tree = buildTree(config);
  const result = resolve(tree, 'o.City');
  const text = [ '先只检查 o 自身的直接字段，不进入内部。', outer ? '深度 0 已有唯一 City；查找停止，更深字段不会参与竞争。' : '深度 0 没有 City。展开 Billing 与 Envelope，检查深度 1。', outer ? '结果为 o.City = 北京。仍可显式进入内部读取其他城市。' : '深度 1 只有 Billing.City。查找停止，深度 2 的 Shipping.City 不造成歧义。' ];
  return <><h4>逐层查找：何时应该停止？</h4><label><input type="checkbox" checked={outer} onChange={e => { setOuter(e.target.checked); setStep(0); }} />开始前在外层加入 City</label><div data-testid="live-model" data-state={`${outer}:${step}`}><Tree tree={tree} scanDepth={step === 0 ? 0 : outer ? 0 : 1} result={step === 2 ? result : undefined} /><p>第 {step + 1} 步：{text[step]}</p><p>查找位置：{step === 0 || outer ? '深度 0' : '深度 1'}；{step === 2 ? describe(result) : '尚未发布读取结果'}</p></div><div className="t23-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 2} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>重新查找</button></div></>;
}
function Transfer() {
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const [outer, setOuter] = useState(false);
  const tree = buildTree({ ...initial, shipping: 'nested', outer }, { billing: '成都', shipping: '苏州', outer: '西安' });
  const result = resolve(tree, answer);
  const reset = () => { setAnswer(''); setReason(''); setChecked(false); };
  return <><h4>迁移修复：通知必须发往送货城市苏州</h4><p>新结构把 Shipping 放在 Envelope 内。选择能准确表达送货含义的路径，并解释为什么简写不能满足目标。这是辅助迁移练习，不计独立成绩。</p><label><input type="checkbox" checked={outer} onChange={e => { setOuter(e.target.checked); reset(); }} />外层有 City = 西安</label><div data-testid="live-model" data-state={`${outer}:${answer}:${checked}`}><Tree tree={tree} result={checked ? result : undefined} />{checked && <p>{describe(result)}。{result.outcome === 'shipping' ? '目标达成：明确经过 Shipping。' : '还没到达苏州；查看 Shipping 的包含层级后修复。'}</p>}</div><fieldset disabled={checked}><legend>先提交路径与理由</legend><label>选择访问路径<select value={answer} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option>{['o.City', 'o.Envelope.Billing.City', 'o.Shipping.City', 'o.Envelope.Shipping.City'].map(path => <option key={path}>{path}</option>)}</select></label><label>理由<textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} /></label></fieldset><div className="t23-buttons"><button disabled={!answer || !reason.trim() || checked} onClick={() => setChecked(true)}>核对送货目标</button><button onClick={reset}>清空再试</button></div>{checked && <p aria-live="polite">你的理由：{reason}。{result.explanation}{answer === 'o.Shipping.City' && 'Shipping 本身也可由 Envelope 提升，因此此路径合法；完整路径更直观地展示包含层级。'}</p>}</>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="types-23 t23-help" data-testid="types-help-23"><p className="t23-boundary">辅助理解与练习，不记录为独立掌握成绩。</p>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}


