import { useState } from 'react';
import { baseline, copyCount, overlap, pointerCopy, snapshot, type Config } from './model';
import './style.css';
function Cells({ name, values, length = values.length, active = -1 }: { name: string; values: number[]; length?: number; active?: number }) {
  return <article className="c16-storage"><strong>{name}</strong><div className="c16-cells">{values.map((v, i) => <span key={i} className={`c16-cell ${i >= length ? 'c16-reserved' : ''} ${active === i ? 'c16-active' : ''}`}><small>[{i}] {i >= length ? '超出长度' : '可索引'}</small><b>{v}</b></span>)}</div>{length === 0 && <p>切片 [] · 当前没有可索引元素</p>}</article>;
}
function Size({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (n: number) => void }) {
  return <label>{label}<select aria-label={label} value={value} onChange={e => onChange(Number(e.target.value))}>{Array.from({length: 9 - min}, (_, i) => i + min).map(n => <option key={n} value={n}>{n}</option>)}</select></label>;
}
export default function Lab() {
  const [config, setConfig] = useState<Config>(baseline);
  const [phase, setPhase] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [seen, setSeen] = useState(false);
  const state = snapshot(config, phase);
  const configure = (next: Config) => { setConfig(next); setPhase(0); setSeen(false); setPrediction(''); setReason(''); };
  const ready = /^\d+$/.test(prediction.trim()) && reason.trim().length > 0;
  return <section className="c16" data-testid="collections-lab-16"><header><p className="c16-eyebrow">快照复制机 · 长度 / 容量</p><h3>空位很多，为什么一项也没复制？</h3><p>改变两个切片的长度和目标容量，先预测数量，再逐格追踪写入。</p></header>
    <div className="c16-controls"><Size label="源长度 len(src)" value={config.srcLength} onChange={srcLength => configure({...config, srcLength})} /><Size label="目标长度 len(dst)" value={config.dstLength} onChange={dstLength => configure({...config, dstLength, capacity: Math.max(dstLength, config.capacity)})} /><Size label="目标容量 cap(dst)" value={config.capacity} min={config.dstLength} onChange={capacity => configure({...config, capacity})} /></div>
    <pre className="c16-code">{`src := []int{${state.src.join(', ')}}
dst := make([]int, ${config.dstLength}, ${config.capacity})
n := copy(dst, src)
${config.dstLength > 0 ? 'dst[0] = 99 // 复制完成后再执行' : '// dst[0] 不存在，不能修改'}`}</pre>
    <div className="c16-model" data-testid="live-model" data-state={JSON.stringify(state)}><p className="c16-operation">{state.operation}</p><Cells name={`A · src · len ${config.srcLength}`} values={state.src} active={phase > 0 && phase <= state.count ? phase - 1 : -1} /><Cells name={`B · dst · len ${config.dstLength} / cap ${config.capacity}`} values={state.storage} length={config.dstLength} active={state.edited ? 0 : phase > 0 && phase <= state.count ? phase - 1 : -1} /><p>复制写入：{state.copied} 项；返回值 n：{state.returned ?? '尚未返回'}。虚线格属于底层容量，但不在 dst 当前长度内。</p></div>
    <fieldset disabled={seen}><legend>{seen ? '已揭示的探索预测' : '执行前预测'}</legend><label>copy 将返回几项？<input inputMode="numeric" value={prediction} onChange={e => setPrediction(e.target.value)} /></label><label>数量取决于什么？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset>
    <div className="c16-actions"><button disabled={phase === state.finalPhase || (!seen && !ready)} onClick={() => { setSeen(true); setPhase(phase + 1); }}>{phase < state.count ? '单步复制一项' : phase === state.count ? '完成 copy 并核对' : '修改副本首项为 99'}</button><button disabled={phase === 0} onClick={() => setPhase(phase - 1)}>回退一步</button><button onClick={() => configure({...baseline})}>重置实验</button></div>
    <div className="c16-feedback" aria-live="polite">{state.complete ? <p>{Number(prediction) === state.count ? '数量预测吻合。' : '数量预测需要修正。'}预测 {prediction}，实际 {state.count} = min({config.srcLength}, {config.dstLength})。容量 {config.capacity} 不参与计算；长度也不会由 copy 扩大。{state.edited && ' 修改 B[0] 后 A 保持原样，因为整数被复制进独立数组。'}你的依据：{reason}</p> : <p>{phase === 0 ? '先留下数量与依据。想复制全部源元素，目标的长度至少要有多大？' : `已写入 B[${phase - 1}]。继续追踪，直到较短的切片用完。`}</p>}</div>
    <p className="c16-boundary">模型边界：整数切片，make 创建独立数组 B。逐格过程是教学展开，不表示 Go 的 copy 可被暂停，也不保证实际内存写入顺序。隐藏容量中的零值仅展示底层存储；不得直接用 dst 索引访问。引用元素只复制引用。所有操作仅作探索，不写正式成绩。</p>
  </section>;
}
function Example() {
  const [length, setLength] = useState(0);
  const [capacity, setCapacity] = useState(4);
  const [ran, setRan] = useState(false);
  const count = copyCount(4, length);
  return <><h4>目标反推：装满四张快照卡</h4><p>源有 4 项，目标必须接住全部。调整已摆出的盒子（长度）与可放盒子的空间（容量），再验收。</p><div className="c16-controls"><Size label="已摆盒子数量" value={length} onChange={n => { setLength(n); setCapacity(Math.max(n, capacity)); setRan(false); }} /><Size label="空间可容纳盒子" value={capacity} min={length} onChange={n => { setCapacity(n); setRan(false); }} /></div><button onClick={() => setRan(true)}>尝试复制四张卡</button><div data-testid="live-model" data-state={JSON.stringify({length, capacity, ran, ...(ran ? {count} : {})})}><Cells name="目标盒子" values={Array.from({length: capacity}, (_,i) => ran && i < count ? i + 1 : 0)} length={length} />{ran && <p className="c16-feedback">收到 {count} / 4 张。{count === 4 ? '目标达成；现在保持长度，改变容量，验证结果是否变化。' : `还缺 ${4 - count} 张。只增加空间不会摆出新盒子；把目标长度至少设为 4 再运行。`}</p>}</div><p>类比边界：make 的长度区间已初始化零值，不需要逐个手动创建盒子。</p></>;
}
function Diagram() {
  const [action, setAction] = useState<'none' | 'edit' | 'replace'>('none');
  const state = pointerCopy(action);
  return <><h4>引用图：独立槽位不等于独立对象</h4><p>src 是 []*int；先 make 长度 2 的 dst，再 copy。每次选择从这个复制后的基线重新执行。</p><div className="c16-actions"><button aria-pressed={action === 'edit'} onClick={() => setAction('edit')}>执行 *dst[0] = 99</button><button aria-pressed={action === 'replace'} onClick={() => setAction('replace')}>执行 dst[0] = &amp;Z</button><button onClick={() => setAction('none')}>恢复引用图</button></div><div className="c16-model" data-testid="live-model" data-state={JSON.stringify(state)}><p>源数组 A：src[0] → X；src[1] → Y</p><p>目标数组 B：dst[0] → {state.dst[0]}；dst[1] → Y</p><div className="c16-objects">{Object.entries(state.objects).map(([id, value]) => <span key={id}>对象 {id} = {value}</span>)}</div></div><p className="c16-feedback">{action === 'edit' ? '解引用写入共享对象 X：两边读到 99。copy 不会递归复制对象。' : action === 'replace' ? '只替换 B 的指针槽：dst[0] → Z，src[0] 仍然 → X。' : 'A、B 是两个数组；其中保存的地址仍指向同一组对象。'}</p></>;
}
function Steps() {
  const [direction, setDirection] = useState<'right' | 'left'>('right');
  const [phase, setPhase] = useState(0);
  const state = overlap(direction, phase);
  return <><h4>重叠复制：逐项核对最终映射</h4><label>重叠方向<select aria-label="重叠方向" value={direction} onChange={e => { setDirection(e.target.value as typeof direction); setPhase(0); }}><option value="right">copy(a[1:], a[:3]) · 向右搬</option><option value="left">copy(a[:3], a[1:]) · 向左搬</option></select></label><p>初始 a=[2 4 6 8]。copy 支持区间重叠；结果按复制开始时的源值计算。</p><div data-testid="live-model" data-state={JSON.stringify(state)}><Cells name="调用前源值的教学记录（不是 Go 额外分配保证）" values={state.source} /><Cells name="同一个底层数组 A" values={state.array} active={phase > 0 ? phase - 1 + (direction === 'right' ? 1 : 0) : -1} /><p>{phase === 0 ? '尚未展开映射。' : `本步把调用前源值 ${state.source[phase - 1]} 映射到 A[${phase - 1 + (direction === 'right' ? 1 : 0)}]。`}</p></div><div className="c16-actions"><button disabled={phase === 3} onClick={() => setPhase(phase + 1)}>展开下一项映射</button><button disabled={phase === 0} onClick={() => setPhase(phase - 1)}>退回上一项</button><button onClick={() => setPhase(0)}>重放映射</button></div><p className="c16-feedback">{phase === 3 ? `最终返回 3，a=[${state.array.join(' ')}]。不会因重叠把第一次写入的值错误地一路传播。` : '每个目标项都连接到调用前对应的源项。'}</p><p>这是结果语义的教学展开，不代表实现采用临时数组或按这个顺序执行。</p></>;
}
function Transfer() {
  const [variant, setVariant] = useState(0);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const task = [{src: 5, len: 2, cap: 7}, {src: 2, len: 5, cap: 8}, {src: 4, len: 0, cap: 8}][variant];
  const result = copyCount(task.src, task.len);
  return <><h4>新情境：日志快照实际保存几条？</h4><p>先独立写出返回值和依据，再揭晓。本练习不写正式成绩。</p><pre className="c16-code">{`// src 包含 ${task.src} 条日志编号
dst := make([]int, ${task.len}, ${task.cap})
n := copy(dst, src)`}</pre><fieldset disabled={checked}><legend>独立预测</legend><label>返回值 n<input inputMode="numeric" value={answer} onChange={e => setAnswer(e.target.value)} /></label><label>解释长度与容量的作用<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="c16-actions"><button disabled={checked || !/^\d+$/.test(answer.trim()) || !reason.trim()} onClick={() => setChecked(true)}>提交并核对</button><button onClick={() => { setVariant((variant + 1) % 3); setAnswer(''); setReason(''); setChecked(false); }}>换一组输入</button></div><div aria-live="polite" data-testid="live-model" data-state={JSON.stringify({variant, checked, evidence: checked ? 'revealed-practice' : 'unrevealed-attempt', ...(checked ? {result} : {})})}>{checked && <p className="c16-feedback">{Number(answer) === result ? '本次预测吻合。' : '本次预测需要修正。'}你填 {answer}，实际 {result} = min({task.src}, {task.len})。cap={task.cap} 不增加参与复制的槽位；dst 长度仍为 {task.len}。你的依据：{reason}。结果已揭示，继续操作属于探索。</p>}</div></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="c16 c16-help" data-testid="collections-help-16">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}

