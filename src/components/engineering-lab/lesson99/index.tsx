import { useState } from 'react';
import { explanations, initialConfig, observe, type Config, type Wrap } from './model';
import './style.css';

function Chain({ wrap }: { wrap: Wrap }) {
  return <div className="eg99-chain" data-testid="relationship-diagram" aria-label="错误解包关系">
    <div><b>调用方</b><code>errors.Is(err, timeout)</code></div><span>↓ 检查当前错误，尝试 Unwrap</span>
    <div><b>load order-7: timeout</b><code>fmt.Errorf("load order-7: %{wrap}", timeout)</code></div>
    <span>{wrap === 'w' ? '↓ Unwrap() 保留原因引用' : '✕ 没有 Unwrap 关系；文字相同也不能匹配'}</span>
    {wrap === 'w' && <div><b>timeout 哨兵</b><code>同一个错误值 → 匹配 true</code></div>}
  </div>;
}

export default function Lesson99() {
  const [config, setConfig] = useState<Config>({ ...initialConfig });
  const [phase, setPhase] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [committed, setCommitted] = useState(false);
  const snapshot = observe(config, phase);
  const update = (patch: Partial<Config>) => { setConfig({ ...config, ...patch }); setPrediction(''); setReason(''); setCommitted(false); };
  const reset = () => { setPhase(0); setCommitted(false); setPrediction(''); setReason(''); };
  return <section className="eg99" data-testid="engineering-lab-99">
    <h3>一次故障，三种证据</h3>
    <p>订单加载失败了。保留原因、聚合事件、连接请求路径，分别能回答什么？</p>
    <fieldset disabled={phase > 0 || committed} className="eg99-config"><legend>实验条件（开始后锁定）</legend>
      <label>错误包装<select value={config.wrap} onChange={e => update({ wrap: e.target.value as Wrap })}><option value="v">%v：格式化文本</option><option value="w">%w：保留原因</option></select></label>
      <label>指标标签<select value={config.labels} onChange={e => update({ labels: e.target.value as Config['labels'] })}><option value="stage">stage=load</option><option value="order">每个 order_id</option></select></label>
      <label>请求数量<input type="range" min="2" max="8" value={config.requests} onChange={e => update({ requests: Number(e.target.value) })}/><output>{config.requests} 个不同订单，每个发生 1 次错误</output></label>
      <label>慢阶段<select value={config.slow} onChange={e => update({ slow: e.target.value as Config['slow'] })}><option value="inventory">库存 inventory</option><option value="payment">支付 payment</option></select></label>
    </fieldset>
    <div className="eg99-predict"><label>先预测 errors.Is 的结果<select disabled={committed} value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="true">true：能找到 timeout</option><option value="false">false：找不到 timeout</option></select></label>
      <label>你的理由<textarea disabled={committed} value={reason} onChange={e => setReason(e.target.value)} placeholder="文字相同是否意味着原因仍可被解包？" rows={2}/></label>
      <button data-eg-action="commit" disabled={!prediction || !reason.trim() || committed} onClick={() => setCommitted(true)}>记录预测</button>
    </div>
    <div className="eg99-actions"><button data-eg-action="back" disabled={phase === 0} onClick={() => setPhase(phase - 1)}>回退一步</button><button data-eg-action="step" disabled={!committed || phase === 4} onClick={() => setPhase(phase + 1)}>单步观察</button><button data-eg-action="reset" onClick={reset}>重置实验</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({ ...snapshot, config, committed })}>
      <p className="eg99-feedback" aria-live="polite"><b>第 {phase}/4 步：</b>{explanations[phase]}</p>
      <div className="eg99-grid">
        <article><h4>① 错误与日志 · 发生了什么</h4>{phase < 1 ? <p>等待依赖返回错误</p> : <><code>err = {snapshot.text}</code>{phase >= 2 ? <><Chain wrap={config.wrap}/><p><b>errors.Is = {String(snapshot.isTimeout)}</b>；你的预测 {prediction}，{prediction === String(snapshot.isTimeout) ? '与结果一致' : '与结果不同，请沿解包关系找原因'}。</p><pre>{`level=ERROR\norder_id=order-7\nstage=load\nerr="${snapshot.text}"`}</pre><p>日志保留具体事件和关联标识。相同错误文本不能证明存在错误链。</p></> : <p>尚未包装，尚未记录日志。</p>}</>}</article>
        <article><h4>② 指标 · 整体有多少</h4>{phase < 3 ? <p>等待聚合事件</p> : <><strong>{snapshot.series.length} 条序列 / 错误总数 {config.requests}</strong><ul className="eg99-series">{snapshot.series.map(s => <li key={s.label}><code>{s.label}</code><span style={{ width: `${s.count / config.requests * 100}%` }}/><b>{s.count}</b></li>)}</ul><p>{config.labels === 'order' ? '每个订单新增一条标签组合；订单持续增加时，基数也持续增长。' : '所有订单合并到 stage=load，一条序列持续累加。'} 聚合计数不能还原某个请求的路径。</p></>}</article>
        <article><h4>③ Trace · 时间花在哪里</h4>{phase < 4 ? <p>等待关联 span</p> : <><p>trace=order-7 · 总时长 110 ms</p><div className="eg99-spans">{snapshot.spans.map(span => <div key={span.name}><span>{span.name} · {span.duration} ms</span><div><i style={{ marginLeft: `${span.start / 110 * 100}%`, width: `${span.duration / 110 * 100}%` }}/></div></div>)}</div><p>request 包含 inventory 与 payment；本例子阶段串行，余下 10 ms 为请求自身处理。慢点是 {config.slow}，仅看错误总数无法定位它。</p></>}</article>
      </div>
    </div>
    <p className="eg99-note">这是确定性的教学模型：错误来自同一 timeout 哨兵，没有自定义 Is 方法；指标仅包含一个错误计数器和所选标签。序列数不是实际内存或费用测量，span 时长为设定值。日志与 Trace 不会自动保留 Go 错误链。</p>
  </section>;
}

export function Help({ mode }: { mode: string }) {
  const [wrap, setWrap] = useState<Wrap>('v');
  const [step, setStep] = useState(0);
  const [labels, setLabels] = useState<Config['labels']>('order');
  const [answer, setAnswer] = useState('');
  const [why, setWhy] = useState('');
  const [revealed, setRevealed] = useState(false);
  const result = observe({ ...initialConfig, requests: 6, labels }, 3);
  return <section className="eg99 eg99-help" data-testid="engineering-help-99">
    {mode === 'example' ? <><h3>同样的文字，两种错误值</h3><p>比较同一次 order-7 超时：改变格式符，观察哪一部分改变。</p><button onClick={() => setWrap(wrap === 'v' ? 'w' : 'v')}>切换为 %{wrap === 'v' ? 'w' : 'v'}</button><div className="eg99-example"><code>fmt.Errorf("load order-7: %{wrap}", timeout)</code><p>输出文本：load order-7: timeout</p><p>errors.Is：<b>{String(wrap === 'w')}</b></p><p>{wrap === 'w' ? '文本之外还保存了原因引用。' : '只有文本，没有可解包的原因引用。'}</p></div></>
      : mode === 'diagram' ? <><h3>沿着原因引用查找</h3><label>连接方式<select value={wrap} onChange={e => setWrap(e.target.value as Wrap)}><option value="v">%v：断开原因</option><option value="w">%w：连接原因</option></select></label><Chain wrap={wrap}/><p>连线表示可解包的原因引用，不是字符串包含关系。Trace 的 span 父子关系是另一套关系。</p></>
      : mode === 'steps' ? <><h3>逐层建立诊断证据</h3><p>固定使用 %w 与 stage 标签，拆开每一层观察。</p><ol className="eg99-steps">{['接收 timeout 哨兵', '用 %w 添加订单与阶段', '把错误事件聚合为计数', '关联请求内各阶段 span'].map((name, i) => <li key={name} aria-current={step === i ? 'step' : undefined}><b>{name}</b>{step === i && <p>{explanations[i + 1]}</p>}</li>)}</ol><div className="eg99-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => setStep(0)}>从头看</button></div><p>{step === 0 ? '错误值：timeout' : step === 1 ? 'errors.Is = true；日志关联 order-7' : step === 2 ? '4 次错误 → stage=load 一条序列，计数 4' : 'inventory 90 ms → payment 10 ms，总计 110 ms'}</p></>
      : <><h3>换一批订单，预测指标基数</h3><p>6 个不同订单各失败 1 次，只有一个错误计数器。先选标签，再预测会产生几条时间序列。</p><label>标签方案<select disabled={revealed} value={labels} onChange={e => { setLabels(e.target.value as Config['labels']); setAnswer(''); setWhy(''); }}><option value="order">order_id</option><option value="stage">stage=load</option></select></label><label>预测序列数<select disabled={revealed} value={answer} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="1">1</option><option value="6">6</option></select></label><label>理由<textarea disabled={revealed} value={why} onChange={e => setWhy(e.target.value)} rows={2}/></label><button disabled={revealed || !answer || !why.trim()} onClick={() => setRevealed(true)}>验证这次预测</button><button onClick={() => { setRevealed(false); setAnswer(''); setWhy(''); }}>重新尝试</button>{revealed && <div className="eg99-feedback" aria-live="polite">实际 {result.series.length} 条，{Number(answer) === result.series.length ? '与你的预测一致' : `你的预测是 ${answer} 条`}。{labels === 'order' ? '6 个不同 order_id 形成 6 组标签。' : '6 个事件共享 stage=load 同一组标签。'}计数总和始终是 6。<p>这是带帮助的局部练习，不计入独立掌握记录。</p></div>}</>}
  </section>;
}
