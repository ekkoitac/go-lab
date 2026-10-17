import { useState } from 'react';
import { boundaryComparison, couponEligible, inspectShipping, type Implementation, type Outcome } from './model';
import './style.css';

export default function Lab() {
  const [amount, setAmount] = useState(100);
  const [implementation, setImplementation] = useState<Implementation>('buggy');
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [compare, setCompare] = useState(false);
  const result = inspectShipping(amount, implementation);
  const invalidate = () => { setRevealed(false); setPrediction(''); setReason(''); setCompare(false); };
  const reset = () => { setAmount(100); setImplementation('buggy'); invalidate(); };
  return <section className="testing-81" data-testid="testing-lab-81">
    <header><p className="t81-eyebrow">规格 → 独立预期 → 可观察输出</p><h3>谁能发现免运费边界的错误？</h3><p>目标：为同一份运费实现选择独立判据，找出“测试通过但业务仍错”的输入。</p></header>
    <div className="t81-contract"><strong>业务契约</strong>：订单满 100 元免运费；不足 100 元收 10 元。实验仅处理 0–200 元的整数金额。</div>
    <div className="t81-controls"><label>订单金额<input type="number" min={0} max={200} step={1} value={amount} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 200) { setAmount(n); invalidate(); } }} /></label>
      <div className="t81-buttons" aria-label="边界输入">{[99, 100, 101].map(n => <button key={n} aria-pressed={amount === n} onClick={() => { setAmount(n); invalidate(); }}>{n} 元</button>)}</div>
      <label>被测实现<select value={implementation} onChange={e => { setImplementation(e.target.value as Implementation); invalidate(); }}><option value="buggy">原实现：total &gt; 100</option><option value="fixed">修复实现：total &gt;= 100</option></select></label>
    </div>
    <div className="t81-model" data-testid="live-model" data-state={`${amount}:${implementation}:${revealed}:${compare}`}>
      <div className="t81-route"><span>输入 {amount} 元</span><span aria-hidden="true">→</span><code>total {implementation === 'buggy' ? '>' : '>='} 100</code><span aria-hidden="true">→</span><span>实际运费 {revealed ? `${result.actual} 元` : '待运行'}</span></div>
      <div className="t81-grid"><article><h4>判据 A · 复制实现</h4><p>把当前实现的条件原样抄进 expected。</p><code>expected = total {implementation === 'buggy' ? '>' : '>='} 100 ? 0 : 10</code>{revealed && <p className="t81-pass">预期 {result.copiedExpected} / 实际 {result.actual} → PASS</p>}</article><article><h4>判据 B · 规格表</h4><p>0–99 元 → 10 元运费<br />100–200 元 → 0 元运费</p>{revealed && <p className={result.specPass ? 't81-pass' : 't81-fail'}>预期 {result.specExpected} / 实际 {result.actual} → {result.specPass ? 'PASS' : 'FAIL'}</p>}</article></div>
    </div>
    <fieldset disabled={revealed}><legend>先预测这两条断言，再运行</legend><label>预测结果<select value={prediction} onChange={e => setPrediction(e.target.value as Outcome)}><option value="">请选择</option><option value="both-pass">A、B 都通过</option><option value="spec-fails">A 通过，B 失败</option></select></label><label>你的理由<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="说明边界包含性，以及两种预期来自哪里" rows={2} /></label></fieldset>
    <div className="t81-buttons"><button data-testing-action="step" disabled={!prediction || !reason.trim() || revealed} onClick={() => setRevealed(true)}>运行并核对预测</button><button data-testing-action="reset" onClick={reset}>重置实验</button></div>
    {revealed && <div className="t81-feedback" aria-live="polite"><strong>{prediction === result.outcome ? '预测吻合。' : '预测需要修正。'}</strong><p>你记录的理由：{reason}</p><p>{result.specPass ? `在 ${amount} 元时，两种判据都通过；这只说明当前输入符合契约，不能证明所有输入正确。` : '100 已经达到“满 100”，规格要求 0 元；原实现的 > 排除了相等，实际收 10 元。复制预期也收 10 元，因此错误互相掩盖。'}</p><button onClick={() => setCompare(true)}>对照边界两侧 99 / 100 / 101</button>{compare && <><div className="t81-table-wrap"><table><caption>保持当前实现，只改变订单金额</caption><thead><tr><th>金额</th><th>实际</th><th>规格</th><th>A / B</th></tr></thead><tbody>{boundaryComparison(implementation).map(r => <tr key={r.amount}><td>{r.amount}</td><td>{r.actual}</td><td>{r.specExpected}</td><td>PASS / {r.specPass ? 'PASS' : 'FAIL'}</td></tr>)}</tbody></table></div><p>下一步：{implementation === 'buggy' ? '切换到修复实现，重新预测并验证边界；复制判据仍然通过，独立判据才会从失败变为通过。' : '修复后 3 个边界样例符合契约；仍需根据其他业务契约补充测试。'}</p></>}</div>}
  </section>;
}

function Example() {
  const [source, setSource] = useState<'copy' | 'notice'>('copy');
  return <><h4>类比：两名售票员核对免票资格</h4><p>公告写“满 18 岁免票”，售票员甲却把刚满 18 岁的人判为收费。让乙选择核对依据。</p><div className="t81-buttons"><button aria-pressed={source === 'copy'} onClick={() => setSource('copy')}>乙照抄甲的判断</button><button aria-pressed={source === 'notice'} onClick={() => setSource('notice')}>乙查独立公告</button></div><div className="t81-route" data-testid="live-model" data-state={source}><span>18 岁来客</span><span>甲：收费</span><span>乙：{source === 'copy' ? '收费 → 两人一致，错误未发现' : '免票 → 不一致，发现边界错误'}</span></div><p>对应关系：甲是实现，乙是测试，公告是规格。局限：独立参考实现也可作判据，但不能共享同一缺陷。</p></>;
}
function Diagram() {
  const [source, setSource] = useState<'implementation' | 'contract'>('implementation');
  return <><h4>关联图：expected 究竟依赖谁？</h4><p>切换预期来源，追踪 100 元输入下错误会不会沿依赖传播。</p><label>连接 expected 的来源<select value={source} onChange={e => setSource(e.target.value as typeof source)}><option value="implementation">实现条件：&gt; 100</option><option value="contract">业务规格：满 100</option></select></label><div className="t81-graph" data-testid="live-model" data-state={source}><div>输入 100 → 实现 &gt; 100 → actual = 10</div><div className={source === 'implementation' ? 't81-fail' : 't81-pass'}>{source === 'implementation' ? '同一错误条件 ↓ 复制到 expected = 10' : '独立规格：100 属于免运区 → expected = 0'}</div><div>actual 与 expected 比较 → {source === 'implementation' ? 'PASS · 共享错误被掩盖' : 'FAIL · 独立判据揭示错误'}</div></div></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const rows = [
    ['写下契约', '满 100 免运费。把“满”翻译成包含边界，不读取实现来推算预期。'],
    ['选择反例', '选恰好 100 元；99 和 101 都不能区分 > 与 >=。独立预期写死为 0。'],
    ['执行原实现', '100 > 100 为 false → 实际运费 10；对照 expected = 0 → FAIL。'],
    ['修复后重测', '改成 >=：100 >= 100 为 true → 0；99 → 10，101 → 0，边界三点都符合契约。'],
  ];
  return <><h4>分步诊断：从需求走到修复</h4><ol className="t81-step-list">{rows.map((row, i) => <li key={row[0]} aria-current={step === i ? 'step' : undefined}>{row[0]}</li>)}</ol><div className="t81-feedback" data-testid="live-model" data-state={step}><strong>第 {step + 1} 步 · {rows[step][0]}</strong><p>{rows[step][1]}</p><div className="t81-route"><span>input = {step ? '100' : '?'}</span><span>expected = {step ? '0' : '?'}</span><span>actual = {step < 2 ? '?' : step === 2 ? '10 → FAIL' : '0 → PASS'}</span></div></div><div className="t81-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>重新推导</button></div></>;
}
function Transfer() {
  const [amount, setAmount] = useState(50);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const clear = () => { setAnswer(''); setReason(''); setChecked(false); };
  return <><h4>换情境：满 50 元可用优惠券</h4><p>独立任务：为优惠券 API 写出预期。实现暂时隐藏。此练习只提供迁移反馈，不计入正式掌握成绩。</p><label>新订单金额<select value={amount} onChange={e => { setAmount(Number(e.target.value)); clear(); }}>{[49, 50, 51, 80].map(n => <option key={n} value={n}>{n} 元</option>)}</select></label><fieldset disabled={checked}><legend>先从规格给出预期</legend><label>优惠券应否可用<select value={answer} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="yes">可用（true）</option><option value="no">不可用（false）</option></select></label><label>推导理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="t81-buttons"><button disabled={!answer || !reason.trim() || checked} onClick={() => setChecked(true)}>核对独立预期</button><button onClick={() => { setAmount(50); clear(); }}>重置迁移题</button></div><div data-testid="live-model" data-state={`${amount}:${answer}:${checked}`} aria-live="polite">{checked && <div className="t81-feedback"><strong>{(answer === 'yes') === couponEligible(amount) ? '预期符合契约。' : '请重新检查“满”的包含性。'}</strong><p>你的理由：{reason}</p><p>{amount} 元{amount < 50 ? '未达到' : '已达到'} 50 元，规格预期是 {String(couponEligible(amount))}。如果实现写成 amount &gt; 50，只有恰好 50 才能暴露差异；把这个预期写成固定值，避免抄实现。</p></div>}</div></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="testing-81 t81-help" data-testid="testing-help-81">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>;
}

