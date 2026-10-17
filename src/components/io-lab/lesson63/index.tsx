import { useState } from 'react';
import { advance, feedback, initial, scopeName, timeline, type Config, type Prediction, type Scope, type State } from './model';
import './style.css';

const phaseLabel: Record<State['phase'], string> = { open: '打开下一个文件', register: '注册 defer Close', process: '处理文件并结束循环体', iterationReturn: '返回单文件函数', outerReturn: '返回批次函数', close: '执行栈顶 Close', done: '执行已结束' };
const boundary = '模型边界：串行处理；每次打开占 1 个句柄；处理和 Close 均成功；打开失败立即返回批次函数。资源上限是实验参数，不代表操作系统实际上限。';

function Board({ state, selected, onSelect }: { state: State; selected?: number; onSelect?: (id: number) => void }) {
  return <div className="io63-board" data-testid="live-model" data-state={JSON.stringify(state)}>
    <div className="io63-metrics"><span>打开 <b>{state.open.length}/{state.limit}</b></span><span>峰值 <b>{state.peak}</b></span><span>完成 <b>{state.processed}/{state.total}</b></span></div>
    <div className="io63-scope"><strong>批次函数 runBatch()</strong><div className={state.scope === 'iteration' ? 'io63-inner' : 'io63-loop'}><span>{state.scope === 'iteration' ? '循环 → processOne() 独立函数' : 'for 循环体 · 没有新函数边界'}</span><div className="io63-files">{Array.from({ length: state.total }, (_, i) => i + 1).map(id => {
      const status = state.open.includes(id) ? 'open' : state.closed.includes(id) ? 'closed' : id === state.failedAt ? 'failed' : 'waiting';
      return <button type="button" key={id} aria-pressed={selected === id} className={`io63-file io63-${status} ${selected === id ? 'io63-selected' : ''}`} onClick={() => onSelect?.(id)} disabled={!onSelect} aria-label={`文件 F${id}：${{ open: '打开', closed: '已关闭', failed: '打开失败', waiting: '未打开' }[status]}`}><b>F{id}</b><small>{{ open: '打开', closed: '已关闭', failed: '打开失败', waiting: '未打开' }[status]}</small></button>;
    })}</div></div><div className="io63-stack"><span>待执行的 defer（归属：{state.scope === 'outer' ? '批次函数' : '单文件函数'}）</span><div>{state.deferred.length ? state.deferred.map((id, index) => <span className={`io63-chip ${selected === id ? 'io63-selected' : ''}`} key={id}>F{id}.Close{index === state.deferred.length - 1 ? ' ← 栈顶' : ''}</span>) : <span className="io63-empty">空栈</span>}</div></div></div>
    <p className="io63-event" role="status">{state.event}</p>
    <p className="io63-next">下一操作：{phaseLabel[state.phase]}{state.closed.length > 0 && ` · 关闭顺序：${state.closed.map(n => `F${n}`).join(' → ')}`}</p>
  </div>;
}

function Predictor({ onCommit }: { onCommit: (p: Prediction) => void }) {
  const [outcome, setOutcome] = useState<Prediction['outcome'] | ''>('');
  const [peak, setPeak] = useState('');
  const [reason, setReason] = useState('');
  return <fieldset className="io63-prediction"><legend>先预测，再执行</legend><div className="io63-fields"><label>整个批次会怎样？<select value={outcome} onChange={e => setOutcome(e.target.value as Prediction['outcome'])}><option value="">请选择</option><option value="complete">全部处理完成</option><option value="limit">触及资源上限，打开失败</option></select></label><label>同时打开的峰值<input type="number" min="1" max="8" placeholder="1–8" value={peak} onChange={e => setPeak(e.target.value)} /></label></div><label>理由：哪个函数返回时才会关闭？<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="写下你对函数边界与资源数量的推断" rows={2} /></label><button type="button" disabled={!outcome || !reason.trim() || !Number.isInteger(Number(peak)) || Number(peak) < 1 || Number(peak) > 8} onClick={() => onCommit({ outcome: outcome as Prediction['outcome'], peak: Number(peak), reason: reason.trim() })}>记录预测，解锁执行</button></fieldset>;
}

function Session({ config, predict = true, code = false, graph = false }: { config: Config; predict?: boolean; code?: boolean; graph?: boolean }) {
  const [history, setHistory] = useState<State[]>([initial(config)]);
  const [cursor, setCursor] = useState(0);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selected, setSelected] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const state = history[cursor];
  const next = () => { const n = advance(state); if (n !== state) { setHistory([...history.slice(0, cursor + 1), n]); setCursor(cursor + 1); } };
  const run = () => { const frames = [...history.slice(0, cursor + 1)]; while (frames.at(-1)!.phase !== 'done') frames.push(advance(frames.at(-1)!)); setHistory(frames); setCursor(frames.length - 1); setRevealed(true); };
  const reset = () => { setHistory([initial(config)]); setCursor(0); setPrediction(null); setRevealed(false); setSelected(1); };
  return <div className="io63-session">
    {predict && !prediction && <Predictor onCommit={setPrediction} />}
    {prediction && <p className="io63-record">已记录：{prediction.outcome === 'complete' ? '全部完成' : '打开失败'}，峰值 {prediction.peak}。理由：{prediction.reason}</p>}
    {graph && <p>点击文件方块，追踪它与待执行 Close 的对应关系；单步运行可以看到资源离开函数边界。</p>}
    {graph && <svg className="io63-graph" viewBox="0 0 340 245" role="img" aria-label={`资源与函数边界图，${scopeName(config.scope)}，打开 ${state.open.length} 个句柄，当前选中 F${selected}`}>
      <rect x="3" y="3" width="334" height="238" rx="12" fill="#fff" stroke="#7299b3" strokeWidth="2" />
      <text x="170" y="25" textAnchor="middle" fontSize="13" fill="#234a67">批次函数 runBatch()</text>
      {config.scope === 'outer' && <rect x="15" y="39" width="310" height="62" rx="8" fill="#fffaf0" stroke="#bda776" strokeDasharray="5 4" />}
      {[1, 2, 3].map((id, i) => {
        const x = 65 + i * 105;
        const isOpen = state.open.includes(id); const deferred = state.deferred.includes(id); const closed = state.closed.includes(id);
        return <g key={id}>
          {config.scope === 'iteration' && <rect x={x - 45} y="39" width="90" height="148" rx="8" fill="#f2faf7" stroke="#74aa97" strokeWidth="2" />}
          <rect x={x - 32} y="51" width="64" height="38" rx="6" fill={isOpen ? '#ffedbd' : closed ? '#dcefe4' : '#edf2f6'} stroke={selected === id ? '#276bba' : '#9bb5c5'} strokeWidth={selected === id ? 3 : 1} />
          <text x={x} y="75" textAnchor="middle" fontSize="13" fill="#223447">F{id}</text>
          {deferred && <><path d={`M ${x} 91 L ${x} 133 l -5 -8 m 5 8 l 5 -8`} fill="none" stroke={selected === id ? '#276bba' : '#8aa5bb'} strokeWidth="2" /><rect x={x - 38} y="139" width="76" height="29" rx="5" fill="#eaf1fa" stroke="#91adc8" /><text x={x} y="158" textAnchor="middle" fontSize="12" fill="#234a67">F{id}.Close</text></>}
          {!deferred && <text x={x} y="156" textAnchor="middle" fontSize="12" fill="#526c80">{closed ? '已释放' : isOpen ? '尚未登记' : '未打开'}</text>}
        </g>;
      })}
      <text x="170" y="211" textAnchor="middle" fontSize="12" fill="#234a67">{config.scope === 'outer' ? '循环体结束 → 没有越过函数边界' : '每轮返回 → 越过独立函数边界 → 关闭'}</text>
      <text x="170" y="230" textAnchor="middle" fontSize="11" fill="#526c80">箭头表示：资源对应的已登记 Close</text>
    </svg>}
    <Board state={state} selected={graph ? selected : undefined} onSelect={graph ? setSelected : undefined} />
    {graph && <p className="io63-trace">F{selected} → {state.deferred.includes(selected) ? `已登记在${config.scope === 'outer' ? '批次' : '单文件'}函数的 defer 栈，需等待该函数返回` : state.closed.includes(selected) ? 'Close 已执行，句柄已释放' : state.open.includes(selected) ? '句柄已打开，还没有注册 Close' : state.failedAt === selected ? '打开失败，没有句柄，也不能注册 Close' : '尚未打开'}。</p>}
    {code && <ol className="io63-code">{[
      { phase: 'open', text: 'f, err := os.Open(name) // 检查错误后继续' },
      { phase: 'register', text: 'defer f.Close() // 只登记，不立即关闭' },
      { phase: 'process', text: 'process(f) // 循环体结束不等于函数返回' },
      { phase: config.scope === 'outer' ? 'outerReturn' : 'iterationReturn', text: 'return // 返回拥有 defer 的函数' },
      { phase: 'close', text: '// 返回过程中执行已注册的 Close（LIFO）' },
    ].map(item => <li key={item.phase} className={state.phase === item.phase ? 'io63-active-line' : ''}><code>{item.text}</code>{state.phase === item.phase && <b> ← 下一步</b>}</li>)}</ol>}
    <div className="io63-actions"><button type="button" data-io-action="back" disabled={cursor === 0} onClick={() => setCursor(cursor - 1)}>回退一步</button><button type="button" data-io-action="step" disabled={(predict && !prediction) || state.phase === 'done'} onClick={next}>单步执行</button><button type="button" disabled={(predict && !prediction) || (state.phase === 'done' && revealed)} onClick={run}>{predict ? '运行到底并核对' : '运行到底'}</button><button type="button" data-io-action="reset" onClick={reset}>重置实验</button></div>
    {state.phase === 'done' && prediction && <div className="io63-feedback" role="status"><b>{feedback(prediction, state).correct ? '预测吻合' : '请根据证据修正解释'}</b><p>{feedback(prediction, state).text}</p><p>你的理由保留供自查；这里仅核对结果与峰值，不自动评判自由文本，也不计入正式测验成绩。</p></div>}
    {revealed && cursor < history.length - 1 && <p>正在回看已揭示的实验；重新执行属于辅助探索。</p>}
  </div>;
}

function Configurator({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  return <div className="io63-fields"><label>defer 所在函数<select value={config.scope} onChange={e => onChange({ ...config, scope: e.target.value as Scope })}><option value="outer">批次函数内 defer</option><option value="iteration">每轮独立函数内 defer</option></select></label><label>文件数量<select value={config.total} onChange={e => onChange({ ...config, total: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option value={n} key={n}>{n} 个</option>)}</select></label><label>同时打开上限<select value={config.limit} onChange={e => onChange({ ...config, limit: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option value={n} key={n}>{n} 个句柄</option>)}</select></label></div>;
}

export default function Lesson63() {
  const [config, setConfig] = useState<Config>({ scope: 'outer', total: 5, limit: 3 });
  return <section className="io63" data-testid="io-lab-63"><header><span className="io63-eyebrow">函数边界 × 资源预算</span><h3>循环结束了，文件真的关了吗？</h3><p>处理同一批文件，观察“当前打开”“历史峰值”和 defer 栈。把 defer 移进每轮调用的函数，再比较相同预算下的结果。</p></header><Configurator config={config} onChange={setConfig} /><p className="io63-note">更改条件会开始新实验并清除旧预测；回退可检查每一步的因果。</p><Session key={JSON.stringify(config)} config={config} /><p className="io63-boundary">{boundary}</p></section>;
}

function Comparison() {
  const [round, setRound] = useState(0);
  const a = timeline({ scope: 'outer', total: 4, limit: 2 });
  const b = timeline({ scope: 'iteration', total: 4, limit: 2 });
  // A checkpoint is the end of one processed file, before the next open.
  const checkpoint = (frames: State[], count: number) => count === 0 ? frames[0] : frames.find(s => s.processed === count && (s.phase === 'open' || s.phase === 'outerReturn') && (s.scope === 'outer' || s.open.length === 0)) ?? frames.at(-1)!;
  const left = round === 5 ? a.at(-1)! : checkpoint(a, round);
  const right = round === 5 ? b.at(-1)! : checkpoint(b, round);
  return <><h3>同样 4 张发票，只有 2 个句柄名额</h3><p>每次推进一个处理轮次，对齐两种方案的循环边界。最后再让批次函数返回，区分峰值和最终打开数。</p><div className="io63-compare">{[left, right].map(s => <article key={s.scope}><h4>{scopeName(s.scope)}</h4><Board state={s} /></article>)}</div><div className="io63-actions"><button type="button" data-io-action="back" disabled={round === 0} onClick={() => setRound(round - 1)}>回退一轮</button><button type="button" data-io-action="step" disabled={round === 5} onClick={() => setRound(round + 1)}>{round === 4 ? '让批次函数返回' : '推进一轮'}</button><button type="button" data-io-action="reset" onClick={() => setRound(0)}>重置对照</button></div><p className="io63-note">{round === 0 ? '先看同一个起点：两边均无打开的句柄。' : round <= 2 ? '左侧每轮结束保留句柄；右侧先返回单文件函数并关闭，然后进入下一轮。' : '左侧 F3 打开失败，错误返回触发清理；右侧可以继续。清理后打开数同为 0，并不代表两边都完成了任务。'}</p></>;
}

function Transfer() {
  const [variant, setVariant] = useState(0);
  const [scope, setScope] = useState<Scope>('outer');
  const config: Config = { total: variant === 0 ? 7 : 6, limit: variant === 0 ? 2 : 1, scope };
  return <><h3>迁移任务：串行处理归档图片</h3><p>有 {config.total} 张图片，最多同时打开 {config.limit} 张。选择函数边界，预测是否全部完成以及峰值，并解释为什么。你可以先试自己的方案，再调整修复。</p><label>我的处理结构<select value={scope} onChange={e => setScope(e.target.value as Scope)}><option value="outer">整个批次返回时统一关闭</option><option value="iteration">每张图片交给独立函数</option></select></label><Session key={`${variant}-${scope}`} config={config} /><button type="button" onClick={() => setVariant(variant === 0 ? 1 : 0)}>换一组预算，重新预测</button><p className="io63-note">这是换条件的练习，不写入正式掌握成绩。看过反馈后的重试属于辅助探索。</p></>;
}

export function Help({ mode }: { mode: string }) {
  const [scope, setScope] = useState<Scope>('outer');
  return <section className="io63 io63-help" data-testid="io-help-63" data-mode={mode}>
    {mode === 'example' ? <Comparison /> : mode === 'try' ? <Transfer /> : <><h3>{mode === 'diagram' ? '让资源跨过真正的函数边界' : '跟着执行位置找出关闭时机'}</h3><p>{mode === 'diagram' ? '外框是批次函数，内框随策略变成循环体或独立函数。点选资源，观察 Close 的归属；推进模型，检查何时释放。' : '高亮行表示下一步将执行的操作。先观察循环体结束，再观察函数开始返回，检查两者是否都会触发 Close。'}</p><label>检查哪种作用域<select value={scope} onChange={e => setScope(e.target.value as Scope)}><option value="outer">批次函数</option><option value="iteration">每轮独立函数</option></select></label><Session key={`${mode}-${scope}`} config={{ scope, total: 3, limit: 3 }} predict={false} graph={mode === 'diagram'} code={mode !== 'diagram'} /></>}
    <p className="io63-boundary">{boundary}</p>
  </section>;
}

