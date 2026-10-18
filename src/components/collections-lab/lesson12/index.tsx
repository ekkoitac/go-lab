import { useState } from 'react';
import { descriptorCode, initialDescriptor, operate, storage, validDescriptor, type Descriptor, type Operation, type Result } from './model';
import './style.css';
function Memory({ d, selected = -1 }: { d: Descriptor; selected?: number }) {
  return <div className="c12-memory" aria-label="底层数组与切片范围">{storage.map((value, i) => <div key={i} className={`c12-cell ${i >= d.start && i < d.start + d.length ? 'c12-visible' : i >= d.start && i < d.start + d.capacity ? 'c12-reserve' : ''} ${i === selected ? 'c12-selected' : ''}`}><small>A[{i}]</small><strong>{value}</strong><small>{i >= d.start && i < d.start + d.length ? `s[${i - d.start}]` : i >= d.start && i < d.start + d.capacity ? '容量预留' : '窗口外'}</small></div>)}</div>;
}
function Numbers({ label, value, onChange, min = 0, max = 6 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return <label>{label}<input type="number" min={min} max={max} step={1} value={value} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= min && n <= max) onChange(n); }} /></label>;
}
export default function Lab() {
  const [d, setD] = useState<Descriptor>({ ...initialDescriptor });
  const [draft, setDraft] = useState<Descriptor>({ ...initialDescriptor });
  const [history, setHistory] = useState<Descriptor[]>([]);
  const [kind, setKind] = useState<'index' | 'reslice'>('index');
  const [index, setIndex] = useState(2);
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(3);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState('初始窗口只暴露 65、66；另外两格虽然在容量内，仍不能直接索引。');
  const clear = () => { setResult(null); setPrediction(''); setReason(''); };
  const op: Operation = kind === 'index' ? { kind, index } : { kind, low, high };
  const run = () => { const r = operate(d, op); setHistory(h => [...h, { ...d }]); setResult(r); if (r.ok) setD(r.descriptor); setNotice(r.reason); };
  const reset = () => { setD({ ...initialDescriptor }); setDraft({ ...initialDescriptor }); setHistory([]); setKind('index'); setIndex(2); setLow(0); setHigh(3); clear(); setNotice('已恢复 len=2 / cap=4。先预测 s[2]，再尝试重新切片。'); };
  return <section className="c12-lab" data-testid="collections-lab-12"><header><p className="c12-eyebrow">调参 · 预测验证 · 存储与代码联动</p><h3>有空位，为什么还是越界？</h3><p>目标：区分可索引的长度、可扩展的容量，以及相对起点。</p></header>
    <fieldset><legend>构造起始窗口（显式限制容量的三索引切片）</legend><div className="c12-controls"><Numbers label="底层起点" value={draft.start} onChange={n => setDraft({ ...draft, start: n })} /><Numbers label="初始长度" value={draft.length} onChange={n => setDraft({ ...draft, length: n })} /><Numbers label="初始容量" value={draft.capacity} onChange={n => setDraft({ ...draft, capacity: n })} /></div><button disabled={!validDescriptor(draft)} onClick={() => { setHistory(h => [...h, { ...d }]); setD({ ...draft }); clear(); setNotice(`执行 ${descriptorCode(draft)}；只改变描述符，底层六格保持原值。`); }}>应用窗口</button><p>{validDescriptor(draft) ? descriptorCode(draft) : '非法配置：要求 0 ≤ 长度 ≤ 容量，且起点 + 容量 ≤ 6。'}</p></fieldset>
    <div data-testid="live-model" data-state={JSON.stringify({ descriptor: d, operation: op, result: result ? { ok: result.ok, value: result.value } : null, history: history.length })}><div className="c12-metrics"><span>起点 A[{d.start}]</span><span>len = {d.length}</span><span>cap = {d.capacity}</span></div><Memory d={d} selected={result?.ok && kind === 'index' ? d.start + index : -1} /><p>蓝色：当前索引范围；虚线：容量内未暴露；灰色：窗口外。</p><pre><code>{`backing := [6]byte{65, 66, 0, 0, 0, 0}\n// 当前描述符可由以下表达式构造\n${descriptorCode(d)}\n// ${result ? '刚执行' : '待执行'}：${result?.code ?? (kind === 'index' ? `i := ${index}; value := s[i]` : `low, high := ${low}, ${high}; s = s[low:high]`)}`}</code></pre></div>
    <div className="c12-controls"><label>操作<select aria-label="操作" value={kind} onChange={e => { setKind(e.target.value as typeof kind); clear(); }}><option value="index">索引 s[i]</option><option value="reslice">重新切片 s[low:high]</option></select></label>{kind === 'index' ? <Numbers label="索引 i" value={index} min={-1} max={7} onChange={n => { setIndex(n); clear(); }} /> : <><Numbers label="low" value={low} min={-1} max={7} onChange={n => { setLow(n); clear(); }} /><Numbers label="high" value={high} min={-1} max={7} onChange={n => { setHigh(n); clear(); }} /></>}</div>
    <fieldset disabled={!!result}><legend>先判断是否合法，再说明依据</legend><label>预测结果<select aria-label="预测结果" value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="ok">合法执行</option><option value="panic">越界 panic</option></select></label><label>预测理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="这次操作该检查 len 还是 cap？" /></label></fieldset>
    <div className="c12-actions"><button disabled={!prediction || !reason.trim() || !!result} onClick={run}>执行并核对</button><button disabled={!history.length} onClick={() => { setD(history[history.length - 1]); setHistory(history.slice(0, -1)); clear(); setNotice('已回退一个操作，恢复执行前描述符。底层数组始终未改变。'); }}>回退一步</button><button onClick={reset}>重置实验</button></div>
    <div className="c12-feedback" aria-live="polite">{result && <><strong>{(prediction === 'ok') === result.ok ? '预测吻合。' : '预测需要修正。'}</strong><p>你的理由：{reason}</p></>}<p>{notice}</p>{result?.ok && result.value !== undefined && <p>读取结果 = {result.value}。数值 0 是这份数组的初始化值，不证明收到了一个有效字节。</p>}{result && <button onClick={clear}>继续下一次预测</button>}</div><p className="c12-boundary">模型边界：固定六字节数组；仅模拟描述符、运行时索引和二索引重新切片，不模拟 append。非法操作显示 Go 会发生的 panic，实验保留原状态以便修复；真实程序需要处理 panic 或会终止。可访问数据不等于业务上有效的数据。</p>
  </section>;
}
function Example() {
  const [opened, setOpened] = useState(2);
  const [frame, setFrame] = useState(4);
  const d = { start: 0, length: opened, capacity: frame };
  return <><h4>窗口类比：已打开与最多能打开</h4><p>把窗框上限固定，再移动开口。只有已打开部分对应可索引的元素。</p><div className="c12-controls"><Numbers label="开口格数" value={opened} max={frame} onChange={setOpened} /><Numbers label="窗框上限" value={frame} min={opened} onChange={setFrame} /></div><div data-testid="live-model" data-state={JSON.stringify(d)}><Memory d={d} /><p>开口 {opened} 格 → len={opened}；窗框 {frame} 格 → cap={frame}。s[{opened}] {opened < frame ? '在窗框里，但还没打开，直接访问仍越界。' : '已到窗框边界，直接访问越界，也不能再扩大一格。'}</p></div><p>类比边界：重新切片只暴露存储，不会接收新字节；扩大开口看到零值，也不代表数据已到达。</p></>;
}
function Diagram() {
  const [start, setStart] = useState(1);
  const [index, setIndex] = useState(0);
  const d = { start, length: 2, capacity: 6 - start };
  return <><h4>关联图：相对索引落在哪一格？</h4><p>保持 len=2，移动起点，再选一个相对索引。高亮的是实际读取的同一底层位置。</p><Numbers label="图中起点" value={start} max={4} onChange={setStart} /><div className="c12-actions">{[0, 1].map(i => <button key={i} aria-pressed={index === i} onClick={() => setIndex(i)}>追踪 s[{i}]</button>)}</div><div data-testid="live-model" data-state={JSON.stringify({ ...d, index, address: start + index })}><p className="c12-route">s[{index}] → 起点 {start} + {index} → A[{start + index}] → {storage[start + index]}</p><Memory d={d} selected={start + index} /><p>len 固定为 2；cap = 6 − {start} = {d.capacity}。起点前面的格子不属于容量。</p></div></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const d = step < 2 ? initialDescriptor : { start: 1, length: 2, capacity: 3 };
  const explanations = ['初始 s 指向 A[0]，len=2，cap=4。计划执行 s=s[1:3]。', '先检查 0 ≤ 1 ≤ 3 ≤ 4。high=3 超过旧 len=2 仍合法，因为切片表达式检查 cap。', '更新描述符：起点 0+1=1，len=3−1=2，cap=4−1=3；数组一个字节也没复制。', '读取新 s[1]：1<2 合法，映射到 A[1+1]=A[2]，值为 0；这个零来自初始化。'];
  return <><h4>单步推导：s=s[1:3] 怎样移动窗口？</h4><div data-testid="live-model" data-state={JSON.stringify({ step, descriptor: d })}><div className="c12-metrics"><span>阶段 {step + 1}/4</span><span>len={d.length}</span><span>cap={d.capacity}</span></div><Memory d={d} selected={step === 3 ? 2 : -1} /><p className="c12-feedback">{explanations[step]}</p></div><div className="c12-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>重放推导</button></div></>;
}
function Transfer() {
  const [scenario, setScenario] = useState('index');
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const d = { start: 2, length: 1, capacity: 3 };
  const r = operate(d, scenario === 'index' ? { kind: 'index', index: 1 } : { kind: 'reslice', low: 1, high: 3 });
  const clear = () => { setAnswer(''); setReason(''); setChecked(false); };
  return <><h4>换情境：日志缓冲区从 A[2] 开始</h4><p>新描述符：起点 2，len=1，cap=3。此处为辅助迁移练习，反馈不写入正式掌握证据。</p><label>待判断操作<select aria-label="待判断操作" value={scenario} onChange={e => { setScenario(e.target.value); clear(); }}><option value="index">读取 s[1]</option><option value="slice">重新切片 s=s[1:3]</option></select></label><fieldset disabled={checked}><legend>提交预测与推导后才显示结果</legend><label>你的判断<select aria-label="你的判断" value={answer} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="panic">越界 panic</option><option value="ok">合法</option></select></label><label>你的推导<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="c12-actions"><button disabled={!answer || !reason.trim() || checked} onClick={() => setChecked(true)}>核对新情境</button><button onClick={clear}>重新作答</button></div><div data-testid="live-model" data-state={JSON.stringify({ scenario, checked, descriptor: checked ? r.descriptor : d })} aria-live="polite">{checked && <><p><strong>{(answer === 'ok') === r.ok ? '判断吻合。' : '请修正边界依据。'}</strong>你的推导：{reason}</p><p>{r.reason}</p><Memory d={r.descriptor} /><p>下一步：切换另一操作，区分索引检查 len 与重新切片检查 cap。</p></>}</div></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="c12-lab c12-help" data-testid="collections-help-12">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}

