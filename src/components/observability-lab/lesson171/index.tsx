import { useState } from 'react';
import { defaultConfig, snapshot, type Config } from './model';
import './style.css';
const names = { paid: '支付成功', rejected: '预期业务拒绝', failed: '系统失败', cancelled: '用户取消' };
const percent = (value: number | null) => value === null ? '待成熟' : `${Math.round(value * 100)}%`;
export default function Lesson171() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [now, setNow] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const [transfer, setTransfer] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [checked, setChecked] = useState(false);
  const state = snapshot(config, now);
  const previous = snapshot(config, Math.max(0, now - 1));
  function restart(next = config) { setConfig(next); setNow(0); setPrediction(''); setReason(''); setLocked(false); }
  return <section className="obs171" data-testid="observability-lab-171">
    <h3>支付旅程审计台：202 后发生了什么？</h3>
    <p>审计受理时刻在 [0, 2) 分钟内的支付。每笔等待满 5 分钟才结算指标；正好 5 分钟到达终态也算及时。</p>
    <div className="obs171-controls">
      <label>B 的支付完成耗时<select value={config.slowMinutes} onChange={e => restart({ ...config, slowMinutes: Number(e.target.value) })}><option value={4}>4 分钟</option><option value={5}>5 分钟（边界）</option><option value={6}>6 分钟</option></select></label>
      <label>预期业务拒绝的产品约定<select value={config.rejection} onChange={e => restart({ ...config, rejection: e.target.value as Config['rejection'] })}><option value="good">期限内明确拒绝算好事件</option><option value="bad">只有支付成功算好事件</option></select></label>
    </div>
    <p>本模型固定：系统失败与用户取消都算坏事件。资格不符的 E 不进入受理队列；F 在第 2 分钟受理，归属下一窗口。改变条件会重开实验。</p>
    <details><summary>查看实验输入（用来推导预测）</summary><p>A：0 分钟受理、2 分钟成功；B：0 分钟受理、按上方耗时成功；C：1 分钟受理、3 分钟业务拒绝；D：1 分钟受理、2 分钟系统失败；E：1 分钟资格校验失败；F：2 分钟受理、3 分钟成功；G：1 分钟受理、3 分钟取消。</p></details>
    <fieldset disabled={locked}><legend>先预测：第 6 分钟，本窗口的好事件数 / 成熟分母是多少？</legend>
      <label>预测<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">选择结果</option>{['1/5', '2/5', '3/5', '5/5', '3/7'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>推理依据<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="哪些事件进分母？哪些终态算好事件？" /></label>
      <button disabled={!prediction || !reason.trim()} onClick={() => setLocked(true)}>记录预测，开始观察</button>
    </fieldset>
    {locked && <p>已记录：{prediction}。理由：{reason}</p>}
    <div className="obs171-controls"><button data-obs-action="back" disabled={!locked || now === 0} onClick={() => setNow(now - 1)}>回退 1 分钟</button><button data-obs-action="step" disabled={!locked || now === 7} onClick={() => setNow(now + 1)}>单步 +1 分钟</button><button data-obs-action="reset" onClick={() => restart()}>重置实验</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({ now, config, denominator: state.denominator, good: state.good, prediction: locked ? prediction : null })}>
      <div className="obs171-clock">当前时刻：第 {now} 分钟 <progress max={7} value={now} aria-label="支付观察时间" /></div>
      <div className="obs171-metrics"><div>本窗口成熟分母<strong>{state.denominator}</strong></div><div>符合约定的好事件<strong>{state.good}</strong></div><div>用户旅程 SLI<strong>{percent(state.ratio)}</strong></div><div>已受理请求 HTTP 2xx<strong>{percent(state.acceptedHttpSuccess)}</strong></div></div>
      <p role="status">{now === 0 ? '尚未推进：受理不代表完成，未成熟的事件暂不进入比率。' : `当前 ${now} 分钟，对比前一分钟：成熟分母 ${previous.denominator} → ${state.denominator}，好事件 ${previous.good} → ${state.good}。${state.denominator === previous.denominator ? '没有新事件满 5 分钟；终态出现也不提前结算。' : '有受理事件刚满 5 分钟，按其期限内的终态结算。'}`}</p>
      <div className="obs171-payments">{state.rows.map(row => <article key={row.id} className={row.denominator ? row.good ? 'obs171-good' : 'obs171-bad' : ''}><strong>{row.id} · {row.eligible ? '受理' : '提交'}时间 {row.acceptedAt} 分钟</strong><span>{row.acceptedAt > now ? '尚未到达' : row.http !== 202 ? 'HTTP 400 · 未受理' : `HTTP 202 · ${row.terminalAt !== undefined && row.terminalAt <= now ? names[row.outcome!] : '处理中'}`}</span><small>{row.status}</small></article>)}</div>
    </div>
    {now >= 6 && <p className="obs171-feedback">预测 {prediction}，实际 {state.good}/{state.denominator}：{prediction === `${state.good}/${state.denominator}` ? '数值一致。' : '有差异，请回退观察哪些行进入分母。'} A 及时成功；B 由耗时决定；C 由拒绝约定决定；D、G 为坏事件；E、F 不在本窗口分母。晚到成功不会回写成及时成功。</p>}
    <fieldset><legend>独立迁移 · 新退款旅程（不计入课程完成）</legend><p>退款承诺 24 小时内明确结果。10 笔已受理且合格，年龄均为 25 小时；7 笔第 20 小时成功，2 笔第 25 小时成功，1 笔仍处理中。入口均返回 202。好事件比率是多少？</p><label>你的结果<select disabled={checked} value={transfer} onChange={e => setTransfer(e.target.value)}><option value="">选择</option><option>70%</option><option>90%</option><option>100%</option></select></label><label>理由<textarea disabled={checked} value={transferReason} onChange={e => setTransferReason(e.target.value)} /></label><button disabled={checked || !transfer || !transferReason.trim()} onClick={() => setChecked(true)}>提交独立判断</button>{checked && <p>{transfer === '70%' ? '本次独立判断正确。' : '本次尚未掌握。'} 分母为 10，只有 7 笔在 24 小时内完成；第 25 小时的成功仍违反期限。该提交只保留在当前模块，不作为课程通过记录。</p>}</fieldset>
    <p className="obs171-boundary">模型边界：使用完整事件且无重复，暂不模拟迟到日志、跨机时钟和对账；HTTP 指标限定为已受理请求，不代表全部入口请求可用率。拒绝与取消口径需产品共同确认，示例不是 SLA。</p>
  </section>;
}
export function Help({ mode }: { mode: string }) {
  const [stage, setStage] = useState(0);
  const [reject, setReject] = useState(false);
  const [selection, setSelection] = useState('');
  const [revealed, setRevealed] = useState(false);
  return <section className="obs171 obs171-help" data-testid="observability-help-171">
    {mode === 'example' ? <><h3>换成餐厅取餐：接单 ≠ 按约交付</h3><p>承诺 5 分钟内交付或明确售罄。10 张合格订单已满 5 分钟：8 份及时出餐、1 份及时告知售罄、1 份仍在等。</p><label><input type="checkbox" checked={reject} onChange={e => setReject(e.target.checked)} /> 合同允许及时售罄通知算达标</label><p>同一批订单：接单成功率 100%；旅程达标率 {reject ? '90%' : '80%'}。{reject ? '售罄通知进入好事件，分母仍为 10。' : '只有及时出餐进入好事件，分母仍为 10。'}</p></> : mode === 'diagram' ? <><h3>沿一笔支付追踪两种指标</h3><div className="obs171-controls">{['HTTP 202', '业务队列', '第 5 分钟', '第 6 分钟'].map((label, index) => <button key={label} aria-pressed={stage === index} onClick={() => setStage(index)}>{index + 1}. {label}</button>)}</div><p role="status">{['受理 → 入口计为成功；用户旅程尚未成熟，没有结算。', '异步处理 → 入口结果不变，支付仍可能失败。', '期限已到且仍待处理 → 旅程分母 +1，好事件 +0。', '迟到成功 → 业务最终完成，但 5 分钟内完成的历史判定仍为坏事件。'][stage]}</p><div className="obs171-route"><div className="obs171-timeline">{["受理", "排队", "期限", "迟到"].map((name, index) => <span key={name} className={index === stage ? "obs171-current" : ""}>{name}<br />入口：成功<br />旅程：{index < 2 ? "暂缓" : "违反期限"}</span>)}</div><p>选中节点对应结算：分母 {stage < 2 ? 0 : 1}，好事件 0；{stage === 3 ? "业务已完成，但期限未达标。" : stage === 2 ? "等待到期，正式结算。" : "还有时间，暂不结算。"}</p></div></> : mode === 'steps' ? <><h3>手工审核一条事件</h3><p>在第 1 分钟受理，第 6 分钟明确业务拒绝；现在第 6 分钟。约定允许及时拒绝。</p><ol>{['先查合格性：已受理且符合业务规则。', '再查归属：受理时刻 1 落在 [0, 2)，不能按终态时刻 6 改窗口。', '再查成熟：6 − 1 = 5，刚好成熟，分母加 1。', '最后查终态：耗时正好 5，拒绝符合约定，好事件加 1。'].slice(0, stage + 1).map(item => <li key={item}>{item}</li>)}</ol><button disabled={stage === 0} onClick={() => setStage(stage - 1)}>上一步</button><button disabled={stage >= 3} onClick={() => setStage(stage + 1)}>下一审核步骤</button></> : <><h3>试着找一个指标反例</h3><p>要证明“HTTP 2xx 就代表满足 5 分钟承诺”不成立，选择最有力的证据。</p><label>选择证据<select value={selection} onChange={e => { setSelection(e.target.value); setRevealed(false); }}><option value="">先选再核对</option><option value="slow">202 后第 8 分钟才完成支付</option><option value="fresh">202 后仅等待 1 分钟</option><option value="invalid">参数非法，返回 400</option></select></label><button disabled={!selection} onClick={() => setRevealed(true)}>核对反例</button>{revealed && <p>{selection === 'slow' ? '成立：入口成功，同时旅程明确违反期限。' : selection === 'fresh' ? '证据不足：1 分钟尚未成熟，之后仍可能及时完成。' : '对象不符：它没有返回 2xx，不能反驳该命题。'} 此处有辅助反馈，不计独立掌握证据。</p>}</>}
  </section>;
}

