import {useState} from 'react';
import {copyRows, copySnapshot, utf8Length} from './model';
import './style.css';

export default function Lesson94() {
  const [input, setInput] = useState('Go|你|🙂|!');
  const [grow, setGrow] = useState(true), [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState(''), [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const parts = input.split('|').slice(0, 8), state = copySnapshot(parts, grow, step);
  const maxCost = Math.max(1, copyRows(parts, grow).at(-1)?.concatTotal ?? 1);
  const reset = () => {setStep(0); setPrediction(''); setReason(''); setFeedback('');};
  const advance = () => {
    if (input.split('|').length > 8 || state.done || !reason.trim() || prediction === '') return;
    const next = copyRows(parts, grow)[step];
    setFeedback(`你预测 += 本轮搬运 ${prediction} B，理由：${reason}。${Number(prediction) === next.concatDelta ? '数值吻合。' : `模型结果为 ${next.concatDelta} B。`} 新片段 ${next.bytes} B，${next.bytes ? `旧前缀 ${state.bytes} B 也被搬运` : '空片段不触发搬运'}；Builder 本轮写入 ${next.bytes} B，加上扩容搬运 ${next.moved} B。`);
    setStep(step + 1); setPrediction(''); setReason('');
  };
  return <section className="eg94" data-testid="engineering-lab-94">
    <header><span className="eg94-tag">逐片段执行 · 同输入对照</span><h3>多写一句，前面的字还要再搬吗？</h3><p>目标：区分 UTF-8 字节数与字符数，用每轮搬运量解释累计成本。</p></header>
    <div className="eg94-controls"><label>报告片段（用 | 分隔，最多 8 段）<input value={input} maxLength={80} onChange={e => {setInput(e.target.value); reset();}} /></label><label className="eg94-check"><input type="checkbox" checked={grow} onChange={e => {setGrow(e.target.checked); reset();}} />Builder 预先 Grow(总字节数)</label></div>
    {input.split('|').length > 8 && <p role="status" className="eg94-feedback">输入超过 8 段；下方只预览前 8 段，已暂停执行。请减少片段后重试，原始输入仍完整保留。</p>}
    <div className="eg94-parts" aria-label="片段队列">{parts.map((p, i) => <div key={i} className={i < step ? 'eg94-used' : i === step ? 'eg94-current' : ''}><small>片段 {i + 1}</small><strong>{p || '空串'}</strong><span>{utf8Length(p)} B</span></div>)}</div>
    <div data-testid="live-model" data-state={JSON.stringify(state)}>
      <div className="eg94-grid"><article><h4>循环 +=：每轮重建前缀</h4><output>{state.concatTotal} B</output><p>累计搬运量</p><div className="eg94-meter"><i style={{width: `${Math.min(100, state.concatTotal / maxCost * 100)}%`}} /></div></article><article><h4>同一个 Builder：追加写入</h4><output>{state.builderTotal} B</output><p>累计写入 + 扩容搬运 · 模型容量 {state.capacity} B</p><div className="eg94-meter"><i style={{width: `${Math.min(100, state.builderTotal / maxCost * 100)}%`}} /></div></article></div>
      <p className="eg94-output">两条路径输出一致：<code>{state.output || '（空）'}</code> · {state.bytes} B · 已执行 {step}/{parts.length} 段</p>
      {state.rows.length > 0 && <div className="eg94-ledger" aria-label="搬运账本">{state.rows.map((row, i) => <div key={i}><strong>第 {i + 1} 轮 · {row.part || '空串'}</strong><span>+=：{row.concatDelta} B → 累计 {row.concatTotal} B</span><span>Builder：新写 {row.bytes} + 旧搬 {row.moved} B → 累计 {row.builderTotal} B</span></div>)}</div>}
    </div>
    {!state.done && <fieldset><legend>先预测下一轮，再揭晓</legend><label>+= 下一轮搬运多少字节？<input type="number" min="0" value={prediction} onChange={e => setPrediction(e.target.value)} /></label><label>你的理由<textarea rows={2} value={reason} placeholder="需要搬旧前缀吗？新片段占多少字节？" onChange={e => setReason(e.target.value)} /></label></fieldset>}
    <div className="eg94-actions"><button data-eg-action="step" disabled={input.split('|').length > 8 || state.done || prediction === '' || !reason.trim()} onClick={advance}>预测并追加下一段</button><button data-eg-action="back" disabled={step === 0} onClick={() => {setStep(step - 1); setFeedback('已回到上一轮；下一步可重新预测。'); setPrediction(''); setReason('');}}>回退一轮</button><button data-eg-action="reset" onClick={reset}>重置过程</button></div>
    <p aria-live="polite" className="eg94-feedback">{feedback || '修改片段或 Grow 会回到起点。可试试把 ASCII 换成中文或 emoji，再比较同一轮的字节成本。'}</p>
    {state.done && <p><strong>本轮完成。</strong>保留片段，取消 Grow 后重新执行，比较扩容搬运出现在第几轮。</p>}
    <p className="eg94-note">模型边界：+= 按非空追加时复制完整新前缀计数，首轮也计新片段；Builder 未 Grow 时采用“至少满足本轮、否则容量翻倍”的教学策略，Go 的实际容量策略可能不同。这里的 B 是搬运字节，非耗时、分配次数或实测结果。固定表达式可能被编译器优化；非零 Builder 不可复制，性能应另用 benchmark 验证。</p>
  </section>;
}

function ByteDiagram() {
  const [round, setRound] = useState(1);
  const row = copyRows(['Go', '你', '🙂'], true)[round - 1], old = row.prefix - row.bytes;
  return <><label>观察哪一轮<select value={round} onChange={e => setRound(Number(e.target.value))}><option value={1}>第 1 轮：Go</option><option value={2}>第 2 轮：你</option><option value={3}>第 3 轮：🙂</option></select></label><svg viewBox="0 0 360 215" role="img" aria-label={`第${round}轮：+=搬运旧${old}加新${row.bytes}字节；Grow后Builder只写新${row.bytes}字节`}><defs><marker id="eg94-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#287b71" /></marker></defs><text x="12" y="22">+=：旧内容再次进入新字符串</text><rect x="12" y="35" width="130" height="35" rx="5" fill="#e5eef1"/><text x="24" y="57">旧前缀 {old} B</text><rect x="202" y="35" width="140" height="35" rx="5" fill="#caf1e4"/><text x="216" y="57">新片段 {row.bytes} B</text><path d="M80 70 L130 98 M270 70 L230 98" stroke="#287b71" strokeWidth="2" markerEnd="url(#eg94-arrow)"/><text x="80" y="120">新串：本轮共搬 {row.prefix} B</text><text x="12" y="151">Builder + Grow：原地写剩余空间</text><rect x="12" y="165" width="330" height="36" rx="5" fill="#eff6f3" stroke="#287b71"/><rect x="12" y="165" width={old / 9 * 330} height="36" fill="#dce6ea"/><rect x={12 + old / 9 * 330} y="165" width={row.bytes / 9 * 330} height="36" fill="#a8e6d2"/><text x="22" y="189">旧 {old} B 保留 · 只写新 {row.bytes} B</text></svg><p>缓冲预留 9 B。灰色为已有内容，绿色为本轮写入；未填满部分保留供后续追加。</p></>;
}
function TransferTry() {
  const [variant, setVariant] = useState(false), [guess, setGuess] = useState(''), [why, setWhy] = useState(''), [revealed, setRevealed] = useState(false);
  const parts = variant ? ['🙂', 'a', '中'] : ['中', 'a', '🙂'];
  const result = copyRows(parts, true).at(-1)!;
  return <><p>局部迁移练习：依次写入 <code>{parts.join(' → ')}</code>。已 Grow 足够容量。预测 += 的累计搬运字节，比较片段顺序的影响。</p><label>累计搬运字节<input type="number" min="0" disabled={revealed} value={guess} onChange={e => setGuess(e.target.value)} /></label><label>推导理由<textarea rows={2} disabled={revealed} value={why} onChange={e => setWhy(e.target.value)} /></label><button disabled={guess === '' || !why.trim() || revealed} onClick={() => setRevealed(true)}>验证这组输入</button>{revealed && <p role="status">{Number(guess) === result.concatTotal ? '预测吻合' : '需要修正'}：每轮前缀为 {copyRows(parts, true).map(r => r.prefix).join(' + ')}，共 {result.concatTotal} B；Builder 共写 {result.builderTotal} B。你的理由：{why}。较长片段越早加入，后续重复搬运越多。</p>}<button onClick={() => {setVariant(!variant); setGuess(''); setWhy(''); setRevealed(false);}}>调换首尾，重新预测</button><p className="eg94-note">这是帮助区练习，使用同一教学模型，不计入正式测验或掌握记录。</p></>;
}
export function Help({mode}: {mode: string}) {
  return <section className="eg94 eg94-help" data-testid="engineering-help-94">{mode === 'example' ? <><h4>同样三个片段，两本搬运账</h4><p><code>a → b → c</code>：+= 每轮重建前缀，搬运 1、2、3 B，共 6 B。Grow(3) 后的 Builder 每轮只写 1 B，共 3 B，最终都输出 abc。</p><p>换成 <code>你 → 好 → !</code>：UTF-8 字节是 3、3、1。前缀为 3、6、7 B，累计 16 B；预留足够空间只写 7 B。Go 的 len(string) 计算字节，不能把汉字都当成 1 B。</p></> : mode === 'diagram' ? <><h4>追踪字节从哪里搬到哪里</h4><ByteDiagram /></> : mode === 'steps' ? <><h4>自己记一轮账</h4><ol><li>先把每段换算成 UTF-8 字节数，保留原来的顺序。</li><li>写下旧前缀 P 和新片段 N。非空追加时，+= 本轮按 P + N 计数。</li><li>检查 Builder 余量。足够则只写 N；不足则先搬 P，再写 N（扩容策略属于模型假设）。</li><li>分别加进累计账本，并核对两边输出始终相同。</li><li>把长片段移到开头重做：重复搬运旧前缀的代价如何变化？最后用真实 benchmark 判断收益。</li></ol></> : <TransferTry />}</section>;
}
