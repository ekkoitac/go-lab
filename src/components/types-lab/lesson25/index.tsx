import { useState } from 'react';
import { initial, payloads, targets, inspect, assertionCode, repair, handle, type Config, type Payload, type Target, type Form, type Outcome, type Policy } from './model';
import './style.css';
function Controls({ config, change }: { config: Config; change: (c: Config) => void }) {
  return <div className="t25-controls"><label>插件载荷<select value={config.payload} onChange={e => change({ ...config, payload: e.target.value as Payload })}>{Object.entries(payloads).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}</select></label><label>目标具体类型<select value={config.target} onChange={e => change({ ...config, target: e.target.value as Target })}>{targets.map(t => <option key={t}>{t}</option>)}</select></label><label>断言形式<select value={config.form} onChange={e => change({ ...config, form: e.target.value as Form })}><option value="single">单值：x := v.(T)</option><option value="checked">两结果：x, ok := v.(T)</option></select></label></div>;
}
function Code({ config }: { config: Config }) { return <pre>{`type Version int\nvar v any = ${payloads[config.payload].code}\n${assertionCode(config)}`}</pre>; }
function View({ config, step }: { config: Config; step: number }) {
  const r = inspect(config);
  return <div className="t25-model" data-testid="live-model" data-state={JSON.stringify({ ...config, step, result: step === 3 ? r.outcome : 'pending' })}>
    <ol className="t25-stages">{['装入载荷', '读取动态类型', '比对类型身份', '产生结果'].map((s, i) => <li key={s} aria-current={step === i ? 'step' : undefined}>{i + 1}. {s}</li>)}</ol>
    <div className="t25-flow"><article><small>接口 v 的动态类型</small><strong>{step ? r.source.type ?? '无动态类型' : '待读取'}</strong><span>原始值：{r.source.value}</span></article><span aria-hidden="true">→</span><article><small>目标类型身份</small><strong>{config.target}</strong><span>{step >= 2 ? r.matched ? '类型身份一致' : '类型身份不一致' : '等待比对'}</span></article><span aria-hidden="true">→</span><article><small>结果槽</small><strong>{step < 3 ? '尚未产生' : r.outcome === 'panic' ? 'panic，未赋值' : `x = ${r.value}`}</strong><span>{step < 3 ? '先预测，再执行' : r.ok === null ? '单值形式没有 ok' : `ok = ${r.ok}`}</span></article></div>
    <p aria-live="polite">{step === 0 ? '源代码已经确定；先判断断言将得到原值、零值与 false，还是 panic。' : step === 1 ? `读出 ${r.source.type ?? '无类型'}；断言不会把数字格式化或把文本解析成数字。` : step === 2 ? '只比较类型身份：Version 的底层类型虽然是 int，Version 与 int 仍是不同类型。' : r.explanation}</p>
  </div>;
}
export default function Lab() {
  const [config, setConfig] = useState<Config>(initial);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [baseline, setBaseline] = useState<Config | null>(null);
  const r = inspect(config);
  function change(c: Config) { setConfig(c); setStep(0); setPrediction(''); setReason(''); }
  return <section className="types-25" data-testid="types-lab-25"><header><p className="t25-kicker">插件载荷检查台</p><h3>类型断言是在检查，还是在转换？</h3><p>控制载荷、目标类型和断言形式，观察“类型身份 → 分支 → 结果”的因果链。</p></header><Controls config={config} change={c => { change(c); setBaseline(null); }} /><Code config={config} /><View config={config} step={step} />
    <fieldset disabled={step > 0}><legend>先预测并解释</legend><label>最终结果<select value={prediction} onChange={e => setPrediction(e.target.value as Outcome)}><option value="">请选择结果</option><option value="success">成功：取出原值</option><option value="zero">失败：目标零值与 ok=false</option><option value="panic">失败：panic，未赋值</option></select></label><label>依据哪两个类型作判断？<textarea value={reason} rows={2} onChange={e => setReason(e.target.value)} placeholder="写出动态类型、目标类型，以及失败时所选形式的行为" /></label></fieldset>
    <div className="t25-buttons"><button disabled={step === 3 || !prediction || !reason.trim()} onClick={() => setStep(step + 1)}>{step === 0 ? '提交预测，读取类型' : step === 1 ? '比对类型身份' : '执行断言'}</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button onClick={() => { change(initial); setBaseline(null); }}>重置实验</button></div>
    {step === 3 && <aside className="t25-feedback" aria-live="polite"><strong>{prediction === r.outcome ? '结果预测吻合' : '结果与预测不同'}</strong><p>你的理由：{reason}</p><p>{r.explanation}</p><button onClick={() => { setBaseline(config); change(config.form === 'single' ? repair(config) : { ...config, form: 'single' }); }}>保留相同输入，换一种断言形式</button></aside>}
    {baseline && <aside className="t25-feedback"><strong>同一载荷与目标的对照</strong><p>原来：{assertionCode(baseline)} → {inspect(baseline).outcome === 'panic' ? 'panic，未赋值' : `x=${inspect(baseline).value}, ok=${inspect(baseline).ok ?? '无'}`}。</p><p>现在：{assertionCode(config)} → {step === 3 ? `结果 ${r.outcome}；${r.explanation}` : '先预测再揭晓；载荷和目标未变。'}</p></aside>}
    <p className="t25-boundary">模型范围：只检查列出的具体类型；目标为接口时还需判断方法集，本台不模拟。断言不负责解析或数值转换。辅助探索不计独立掌握成绩。</p>
  </section>;
}
function Example() {
  const [payload, setPayload] = useState<Payload>('int');
  return <><h4>同一件包裹，两种检查方式</h4><p>标签像动态类型；打开包裹不会把数字变成字符串。只换包裹，同时观察两种 string 断言。</p><label>替换同一份载荷<select value={payload} onChange={e => setPayload(e.target.value as Payload)}>{Object.entries(payloads).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}</select></label><div className="t25-comparison">{(['single', 'checked'] as const).map(form => <article key={form}><Code config={{ payload, target: 'string', form }} /><View config={{ payload, target: 'string', form }} step={3} /></article>)}</div><p>检查空字符串：成功取出的 "" 与失败得到的 "" 外观相同，ok 才能区分。类比只解释标签检查，不表示真实内存布局。</p></>;
}
function Diagram() {
  const [config, setConfig] = useState<Config>({ payload: 'Version', target: 'int', form: 'checked' });
  return <><h4>搭一条类型检查路径</h4><p>把载荷送到目标类型门。尝试让 Version(42) 通过 int 门，再改接 Version 门；值没有改变，类型身份决定路径。</p><Controls config={config} change={setConfig} /><Code config={config} /><View config={config} step={3} /><div className="t25-buttons"><button onClick={() => setConfig({ payload: 'typedNil', target: '*Version', form: 'checked' })}>装入带类型的空指针</button><button onClick={() => setConfig({ ...config, payload: 'nil' })}>只把输入改成 nil 接口</button></div><p>边界：带类型的 nil 能通过对应指针类型门；nil 接口没有动态类型，不能通过任何具体类型门。</p></>;
}
function Steps() {
  const [config, setConfig] = useState<Config>({ payload: 'float64', target: 'int', form: 'single' });
  const [step, setStep] = useState(0);
  return <><h4>从相同输入分叉失败路径</h4><p>float64(42) 的数值虽然是整数，类型仍是 float64。到类型比较后切换断言形式，观察最后一步是否仍然崩溃。</p><Code config={config} /><View config={config} step={step} /><div className="t25-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => { setConfig({ ...config, form: config.form === 'single' ? 'checked' : 'single' }); setStep(Math.min(step, 2)); }}>保留输入，切换断言形式</button><button onClick={() => { setConfig({ payload: 'float64', target: 'int', form: 'single' }); setStep(0); }}>重置推演</button></div></>;
}
function Transfer() {
  const [policy, setPolicy] = useState<Policy>('single');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  return <><h4>修复接入层：不崩溃，也不把失败当成功</h4><p>协议接受所有 string（包括空串），拒绝其他动态类型。只改变处理逻辑，让以下三份载荷都得到正确响应。</p><label>选择补丁<select value={policy} onChange={e => { setPolicy(e.target.value as Policy); setChecked(false); setReason(''); }}><option value="single">单值断言后接受</option><option value="ignore">逗号 ok，但忽略 ok 并接受</option><option value="guard">逗号 ok；false 时返回 unsupported</option></select></label><pre>{policy === 'single' ? 's := v.(string)\nreturn accept(s)' : policy === 'ignore' ? 's, _ := v.(string)\nreturn accept(s)' : 's, ok := v.(string)\nif !ok { return unsupported(v) }\nreturn accept(s)'}</pre><label>为什么这份补丁能区分空串和失败？<textarea rows={2} value={reason} onChange={e => { setReason(e.target.value); setChecked(false); }} /></label><div className="t25-buttons"><button disabled={!reason.trim() || checked} onClick={() => setChecked(true)}>运行三份载荷</button><button onClick={() => { setChecked(false); setReason(''); }}>重新推理</button></div><div data-testid="live-model" data-state={JSON.stringify({ policy, checked })} aria-live="polite">{checked && (['int', 'string', 'empty'] as const).map(payload => { const r = handle(payload, policy); return <article className="t25-feedback" key={payload}><strong>{payloads[payload].label}：{r.contract ? '契约成立' : '契约失败'}</strong><p>{r.response}；{r.ok === null ? '没有 ok' : `ok=${r.ok}`}。</p><p>{r.contract ? r.explanation : r.outcome === 'panic' ? '证据：int 不匹配 string，单值断言中断了请求。应显式处理失败。' : '证据：失败产生的空串被 accept 接收了。需要读取 ok，不能只检查 s 是否为空。'}</p></article>; })}</div></>;
}
export function Help({ mode }: { mode: string }) { return <section className="types-25 t25-help" data-testid="types-help-25">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="t25-boundary">这些示例、推演和修复均为辅助探索，不计独立掌握成绩。</p></section>; }
