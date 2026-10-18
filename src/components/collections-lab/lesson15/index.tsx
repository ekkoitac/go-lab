import { useState } from 'react';
import { baseline, snapshot, shrink, type Config, type Descriptor } from './model';
import './style.css';
function Ticket({ name, value }: { name: string; value: Descriptor | null }) {
  return <article className="c15-ticket"><strong>{name}</strong>{value ? <><p>→ 数组 {value.array}</p><p>len = {value.len} · cap = {value.cap}</p></> : <p>当前不存在</p>}</article>;
}
function Memory({ state, selected }: { state: ReturnType<typeof snapshot>; selected?: Descriptor | null }) {
  return <div className="c15-memory">{Object.entries(state.arrays).map(([id, values]) => <article className="c15-array" key={id}><strong>底层数组 {id}</strong><div className="c15-cells">{values!.map((v, i) => <span key={i} className={selected?.array === id && i < selected.len ? 'c15-visible' : ''}><small>[{i}]</small><b>{v}</b></span>)}</div>{id === 'B' && <small>只画已知的两个元素；新容量至少为 2。</small>}</article>)}</div>;
}
export default function Lab() {
  const [config, setConfig] = useState<Config>(baseline);
  const [phase, setPhase] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [first, setFirst] = useState('');
  const [reason, setReason] = useState('');
  const [seen, setSeen] = useState(false);
  const state = snapshot(config, phase);
  const configure = (next: Config) => { setConfig(next); setPhase(0); setPrediction(''); setFirst(''); setReason(''); setSeen(false); };
  const ready = /^\d+$/.test(prediction) && /^\d+$/.test(first) && reason.trim().length > 0;
  return <section className="c15" data-testid="collections-lab-15"><header><p className="c15-eyebrow">购物车 · 函数边界与返回通道</p><h3>商品进了数组，购物车为何仍看不到？</h3><p>跟踪调用者、形参和返回值的三张描述符。先预测调用结束的结果，再逐步验证。</p></header>
    <div className="c15-controls"><label>初始容量<select aria-label="初始容量" value={config.capacity} onChange={e => configure({ ...config, capacity: Number(e.target.value) as 1 | 3 })}><option value="3">cap=3 · 有空位</option><option value="1">cap=1 · 无空位</option></select></label><label>helper 返回方式<select aria-label="helper 返回方式" value={String(config.returns)} onChange={e => configure({ ...config, returns: e.target.value === 'true', receives: e.target.value === 'true' ? config.receives : false })}><option value="false">无返回值</option><option value="true">return s</option></select></label><label>调用者接收方式<select aria-label="调用者接收方式" disabled={!config.returns} value={String(config.receives)} onChange={e => configure({ ...config, receives: e.target.value === 'true' })}><option value="false">只调用 add(cart)</option><option value="true">cart = add(cart)</option></select></label><label className="c15-check"><input type="checkbox" checked={config.edit} onChange={e => configure({ ...config, edit: e.target.checked })} />追加后执行 s[0] = 9</label></div>
    <pre className="c15-code">{`func add(s []int)${config.returns ? ' []int' : ''} {\n  s = append(s, 8)${config.edit ? '\n  s[0] = 9' : ''}${config.returns ? '\n  return s' : ''}\n}\ncart := make([]int, 1, ${config.capacity})\ncart[0] = 7\n${config.receives ? 'cart = ' : ''}add(cart)`}</pre>
    <div data-testid="live-model" data-state={JSON.stringify(state)}><p className="c15-operation">第 {phase} / 5 步 · {state.operation}</p><div className="c15-tickets"><Ticket name="调用者 cart" value={state.caller} /><Ticket name="形参 s" value={state.local} /><Ticket name="返回结果" value={state.returned} /></div><Memory state={state} selected={state.caller} /><p>调用者可见 cart = [{state.callerValues.join(' ')}]；高亮格子是 cart 当前可索引的范围。</p>{state.localValues && <p>函数可见 s = [{state.localValues.join(' ')}]</p>}{phase === 5 && state.returned && !config.receives && <p>返回结果作为历史证据保留在图中；本次调用已经丢弃它。</p>}</div>
    <fieldset disabled={seen}><legend>{seen ? '已揭示的预测记录' : '在 append 前留下最终结果预测'}</legend><label>调用结束后 len(cart)<input inputMode="numeric" value={prediction} onChange={e => setPrediction(e.target.value)} /></label><label>调用结束后 cart[0]<input inputMode="numeric" value={first} onChange={e => setFirst(e.target.value)} /></label><label>预测依据<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="分别解释描述符长度与已有元素" /></label></fieldset>
    <div className="c15-actions"><button disabled={phase === 5 || (phase === 1 && !ready)} onClick={() => { if (phase === 1) setSeen(true); setPhase(phase + 1); }}>{['单步：调用函数', '验证：局部 append', '单步：已有元素写入', '单步：函数返回', '单步：调用者处理结果', '执行结束'][phase]}</button><button disabled={phase === 0} onClick={() => setPhase(phase - 1)}>回退一步</button><button onClick={() => configure(baseline)}>重置实验</button><button onClick={() => configure({ ...config, returns: true, receives: true })}>修复：返回并接收，再观察</button></div>
    <div className="c15-feedback" aria-live="polite">{phase === 5 ? <><strong>{Number(prediction) === state.caller.len && Number(first) === state.callerValues[0] ? '预测吻合。' : '预测需要修正。'}</strong><p>你预测长度 {prediction}、首元素 {first}；实际长度 {state.caller.len}、首元素 {state.callerValues[0]}。{config.receives ? '调用处赋值替换了 cart 描述符，新增商品进入可见范围。' : '调用处没有赋值，cart 的 len 保持 1；数组里有没有商品 8，不等于 cart 能索引它。'}{config.edit && (config.capacity === 3 ? ' s[0] 写入共享 A，所以旧 cart 也能看到 9。' : ' s[0] 写入新 B；未接收结果的旧 cart 仍读 A。')}</p><p>你的依据：{reason}</p></> : <p>{phase === 1 ? '下一步只更新函数局部描述符。先提交长度和首元素的预测，再继续。' : state.operation} {phase >= 2 && '观察两个 len 是否同步，再对照数组格子的变化。'}</p>}</div>
    <p className="c15-boundary">模型边界：整数切片、单次顺序调用。A/B 是逻辑存储标记；扩容后只保证 cap ≥ 新长度，不承诺倍增或真实地址。图中保留数组用于追踪历史，不表示对象仍可达或 GC 时机。探索和帮助不写入正式成绩。</p>
  </section>;
}
function Example() {
  const [pass, setPass] = useState(1);
  const [clerk, setClerk] = useState(1);
  const [goods, setGoods] = useState([7]);
  return <><h4>仓库通行证：货物与可见范围分开操作</h4><p>仓库预留 3 格。你和店员各有通行证；证上记着能看到几格。先让店员存货，再决定是否换证。</p><div className="c15-actions"><button disabled={clerk === 2} onClick={() => { setGoods([...goods, 8]); setClerk(2); }}>店员存入商品 8 并更新自己的证</button><button disabled={clerk === pass} onClick={() => setPass(clerk)}>接过店员的新证</button><button onClick={() => setGoods(goods.map((v,i) => i === 0 ? 9 : v))}>修改共享仓库首格为 9</button><button onClick={() => { setPass(1); setClerk(1); setGoods([7]); }}>重新发证</button></div><div className="c15-feedback" data-testid="live-model" data-state={JSON.stringify({ pass, clerk, goods })}><p>你的证：可见 {pass} 格 → [{goods.slice(0,pass).join(' ')}]</p><p>店员的证：可见 {clerk} 格 → [{goods.slice(0,clerk).join(' ')}]</p><p>仓库实物：[{goods.join(' ')}]</p></div><p>存货改变仓库内容；换证改变自己的可见长度。类比边界：这里容量足够；扩容可能搬到新数组，不能假设永远共享一个仓库。</p></>;
}
function Diagram() {
  const [capacity, setCapacity] = useState<1 | 3>(3);
  const [who, setWho] = useState<'caller' | 'returned'>('caller');
  const state = snapshot({ capacity, returns: true, receives: false, edit: false },4);
  const selected = state[who];
  return <><h4>关联探索：把描述符连到可见格子</h4><p>停在 return s 之后、调用者接收之前。选择一张描述符，数组中的高亮随它的地址与长度变化。</p><label>这次追加前的容量<select aria-label="这次追加前的容量" value={capacity} onChange={e => setCapacity(Number(e.target.value) as 1 | 3)}><option value="3">3 · 原数组可容纳</option><option value="1">1 · 必须分配新数组</option></select></label><div className="c15-actions"><button aria-pressed={who === 'caller'} onClick={() => setWho('caller')}>追踪调用者 cart</button><button aria-pressed={who === 'returned'} onClick={() => setWho('returned')}>追踪返回结果</button></div><div data-testid="live-model" data-state={JSON.stringify({ who, capacity, selected })}><Ticket name={who === 'caller' ? 'cart' : '返回结果'} value={selected} /><Memory state={state} selected={selected} /></div><p className="c15-feedback">当前路径：{who === 'caller' ? 'cart' : '返回结果'} → {selected!.array}[0:{selected!.len}]。{capacity === 3 ? '指向同一数组，仍可拥有不同长度。' : '追加分配新数组，返回结果与旧 cart 的地址和长度都不同。'}</p></>;
}
function Steps() {
  const [returns, setReturns] = useState(false);
  const [receives, setReceives] = useState(false);
  const [phase, setPhase] = useState(0);
  const state = snapshot({ capacity: 1, returns, receives, edit: false }, phase);
  return <><h4>诊断修复：修好跨函数的两段通道</h4><p>目标：让 cart 显示 [7 8]。只改变返回和接收语句，逐条执行检查。勾选项变更会重跑到起点。</p><div className="c15-controls"><label className="c15-check"><input type="checkbox" checked={returns} onChange={e => { setReturns(e.target.checked); if (!e.target.checked) setReceives(false); setPhase(0); }} />添加 return s 与 []int 返回类型</label><label className="c15-check"><input type="checkbox" checked={receives} disabled={!returns} onChange={e => { setReceives(e.target.checked); setPhase(0); }} />调用处添加 cart =</label></div><ol><li>复制参数描述符</li><li>局部 s = append(s, 8)</li><li>本轮不改已有元素</li><li>{returns ? '返回新描述符' : '函数结束，无返回'}</li><li>{receives ? '用返回结果替换 cart' : '调用者没有接收'}</li></ol><div data-testid="live-model" data-state={JSON.stringify(state)} className="c15-feedback"><p>{state.operation}</p><p>cart = [{state.callerValues.join(' ')}] · len={state.caller.len}</p>{phase === 5 && <p>{state.caller.len === 2 ? '修复达到目标。两段通道都接通，新增范围交回调用者。' : returns ? '证据：返回了 len=2，但 cart 仍 len=1。继续修复调用处的接收。' : '证据：局部 append 完成后没有返回通道。先补全 helper 的返回。'}</p>}</div><div className="c15-actions"><button disabled={phase === 5} onClick={() => setPhase(phase + 1)}>执行下一条</button><button disabled={phase === 0} onClick={() => setPhase(phase - 1)}>退回上一条</button><button onClick={() => setPhase(0)}>重新执行方案</button></div></>;
}
function Transfer() {
  const [variant, setVariant] = useState(0);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const receives = variant === 1;
  const result = shrink(receives, variant === 0 ? 10 : 5, checked);
  return <><h4>迁移：压缩列表也要接收结果吗？</h4><p>这次 helper 缩短切片。独立推导调用结束后 len(items)。核对前不显示结果；本练习不计正式成绩。</p><pre className="c15-code">{`func keepFirst(s []int) []int {\n  return s[:1]\n}\nitems := []int{${variant === 0 ? 10 : 5}, 20, 30}\n${receives ? 'items = ' : ''}keepFirst(items)`}</pre><fieldset disabled={checked}><legend>先独立提交</legend><label>最终 len(items)<input inputMode="numeric" value={answer} onChange={e => setAnswer(e.target.value)} /></label><label>推导理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="c15-actions"><button disabled={checked || !/^\d+$/.test(answer) || !reason.trim()} onClick={() => setChecked(true)}>提交并核对</button><button onClick={() => { setVariant(1-variant); setAnswer(''); setReason(''); setChecked(false); }}>换一个新情境</button></div><div data-testid="live-model" data-state={JSON.stringify({ variant, checked, evidence: checked ? 'revealed-practice' : 'unrevealed-attempt', ...(checked ? { result } : {}) })} aria-live="polite">{result && <p className="c15-feedback">{Number(answer) === result.len ? '本次独立提交吻合。' : '本次提交需要修正。'}你填 {answer}，实际 len(items)={result.len}，items=[{result.values.join(' ')}]。{receives ? '接收返回的描述符，调用者长度才缩短。' : '函数只返回较短描述符，未赋值的 items 仍保持原长度。'}你的理由：{reason}。答案已揭示，后续属于探索。</p>}</div></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="c15 c15-help" data-testid="collections-help-15">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}
