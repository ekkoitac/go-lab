import { useState } from 'react';
import { initialInput, resolveConfig, scheduled, trace, type Config, type Input, type Policy, type Snapshot } from './model';
import './style.css';
const policies: [Policy, string][] = [['zero', '仅声明结构体'], ['defaults', '业务构造函数'], ['presence', '区分是否提供'], ['replace-zero', '错误兜底：零一律改成 3']];
function Fields({ config }: { config: Config | null }) {
  return <div className="fl2-fields"><div><small>Limit · int</small><strong>{config?.limit ?? '待声明'}</strong></div><div><small>Enabled · bool</small><strong>{config ? String(config.enabled) : '待声明'}</strong></div><div><small>Name · string</small><strong>{config ? JSON.stringify(config.name) : '待声明'}</strong></div></div>;
}
function View({ snapshot, pending }: { snapshot: Snapshot; pending: number }) {
  return <><Fields config={snapshot.config} /><div className="fl2-queue" aria-label="任务队列">{Array.from({ length: pending }, (_, i) => <span className={snapshot.started !== null && i < snapshot.started ? 'fl2-running' : ''} key={i}>任务 {i + 1}<small>{snapshot.started === null ? '待调度' : i < snapshot.started ? '已启动' : '等待'}</small></span>)}{pending === 0 && <span>队列为空</span>}</div><p>本次启动：<strong>{snapshot.started ?? '待执行'}</strong></p><div className="fl2-feedback" aria-live="polite"><strong>{snapshot.operation}</strong><p>{snapshot.cause}</p></div></>;
}
export default function Lab() {
  const [input, setInput] = useState<Input>(initialInput);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const [compare, setCompare] = useState(false);
  const snapshots = trace(input);
  const restart = () => { setStep(0); setLocked(false); setPrediction(''); setReason(''); setCompare(false); };
  const change = (patch: Partial<Input>) => { setInput({ ...input, ...patch }); restart(); };
  const configurable = input.policy === 'presence' || input.policy === 'replace-zero';
  return <section className="fl2" data-testid="foundations-lab-2">
    <header><p className="fl2-eyebrow">零值 → 业务配置 → 调度结果</p><h3>为什么下载器一个任务也没启动？</h3><p>改变初始化方式，追踪每个字段如何决定任务启动。再构造“明确填 0”的反例。</p></header>
    <p className="fl2-contract">业务约定：未提供限额时默认 3；明确填写 0 表示暂停。Enabled=false 时不调度。只模拟一轮任务启动，不模拟线程执行。</p>
    <div className="fl2-controls"><label>初始化方式<select value={input.policy} onChange={e => change({ policy: e.target.value as Policy })}>{policies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>待办任务数<input type="number" min={0} max={8} value={input.pending} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 8) change({ pending: n }); }} /></label></div>
    {configurable && <fieldset><legend>用户配置：保留“有没有填写”的信息</legend><label className="fl2-check"><input type="checkbox" checked={input.provided} onChange={e => change({ provided: e.target.checked })} />用户明确提供限额</label><label>填写的限额<input type="number" min={0} max={6} disabled={!input.provided} value={input.limit} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 6) change({ limit: n }); }} /></label><label className="fl2-check"><input type="checkbox" checked={input.enabled} onChange={e => change({ enabled: e.target.checked })} />Enabled：允许调度</label></fieldset>}
    <fieldset disabled={locked}><legend>执行前，预测最终启动数</legend><label>你的预测<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i}>{i} 个任务</option>)}</select></label><label>为什么？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="字段从哪里来？哪个条件决定能否启动？" /></label></fieldset>
    <div className="fl2-buttons"><button disabled={step === 3 || (!locked && (!prediction || !reason.trim()))} onClick={() => { setLocked(true); setStep(step + 1); }}>单步执行</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>回退一步</button><button onClick={restart}>重新预测</button><button onClick={() => { setInput(initialInput); restart(); }}>重置实验</button></div>
    <div className="fl2-model" data-testid="live-model" data-state={JSON.stringify({ ...input, step, locked, compare })}><div className="fl2-stages" aria-label="执行阶段">{['执行前', '声明', '配置', '调度'].map((label, i) => <span key={label} aria-current={step === i ? 'step' : undefined}>{i} · {label}</span>)}</div><View snapshot={snapshots[step]} pending={input.pending} /></div>
    {step === 3 && <div className="fl2-feedback"><strong>{Number(prediction) === snapshots[3].started ? '启动数与预测一致。' : `你预测 ${prediction} 个，实际 ${snapshots[3].started} 个。`}</strong><p>执行前记录的理由：{reason}</p><p>下一次可只改变一个条件：启用开关、是否填写或填写的值，观察因果是否符合解释。</p><button onClick={() => setCompare(!compare)}>{compare ? '收起同输入对照' : '对照三种初始化结果'}</button>{compare && <div className="fl2-comparison">{(['zero', 'defaults', 'presence'] as Policy[]).map(policy => { const config = resolveConfig({ ...input, policy }); return <article key={policy}><h4>{policies.find(p => p[0] === policy)?.[1]}</h4><Fields config={config} /><p>启动 {scheduled(config, input.pending)} / 待办 {input.pending}</p></article>; })}</div>}</div>}
    <p className="fl2-note">模型边界：限额 0–6、待办 0–8；默认 3 和“0 表示暂停”属于本例业务。零值本身不是错误，sync.Mutex 等类型可直接使用零值。此处练习不写入正式掌握成绩。</p>
  </section>;
}
function Example() {
  const [provided, setProvided] = useState(false);
  const [quota, setQuota] = useState(0);
  const config = resolveConfig({ ...initialInput, policy: 'presence', provided, limit: quota });
  return <><h4>配额表：未填和明确填零</h4><p>公司默认给 3 个工位。你是申请人，用“提交字段”区分没有申请与明确暂停。</p><label className="fl2-check"><input type="checkbox" checked={provided} onChange={e => setProvided(e.target.checked)} />提交配额字段</label><label>配额<input type="range" min={0} max={6} value={quota} disabled={!provided} onChange={e => setQuota(Number(e.target.value))} />{quota}</label><div className="fl2-route" data-testid="live-model" data-state={JSON.stringify({ provided, quota, result: config.limit })}><span>表格：{provided ? `明确填 ${quota}` : '未填写'}</span><span>→ {provided ? '保留输入' : '填业务默认'}</span><strong>分配 {config.limit} 个工位</strong></div><p>映射：表格数值对应 Limit，是否提交对应 Provided。局限：Go 的 int 零值不能携带“是否填过”的历史，程序需要额外 bool、指针或其他表示。</p></>;
}
function Diagram() {
  const [field, setField] = useState<'limit' | 'enabled' | 'name'>('limit');
  const [defaults, setDefaults] = useState(false);
  const config = resolveConfig({ ...initialInput, policy: defaults ? 'defaults' : 'zero' });
  const labels = { limit: 'Limit', enabled: 'Enabled', name: 'Name' };
  const types = { limit: 'int', enabled: 'bool', name: 'string' };
  return <><h4>字段来源图：追踪一条写入路径</h4><div className="fl2-buttons">{(['limit', 'enabled', 'name'] as const).map(key => <button key={key} aria-pressed={key === field} onClick={() => setField(key)}>{labels[key]}</button>)}</div><label className="fl2-check"><input type="checkbox" checked={defaults} onChange={e => setDefaults(e.target.checked)} />接入业务构造函数</label><div className="fl2-route" data-testid="live-model" data-state={JSON.stringify({ field, defaults })}><span>声明 {labels[field]} {types[field]}</span><span>↓ 类型零值 {JSON.stringify(resolveConfig(initialInput)[field])}</span><span className={defaults ? 'fl2-highlight' : ''}>↓ {defaults ? `业务代码写入 ${JSON.stringify(config[field])}` : '没有业务写入'}</span><strong>{labels[field]} = {JSON.stringify(config[field])}</strong></div><p>{field === 'enabled' ? 'false 会关闭调度入口。仅给 Limit 赋 3 仍不够。' : field === 'limit' ? '0 是语言定义的初始值，3 是业务代码选择的数值。' : '空字符串是有效字符串，不是 nil；download 是业务名称。'}</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [useDefaults, setUseDefaults] = useState(false);
  const snapshots = trace({ ...initialInput, policy: useDefaults ? 'defaults' : 'zero' });
  return <><h4>单步推导：在初始化处改变后续路径</h4><p>先执行声明；到配置前选择是否调用 defaults()，观察后续字段和任务格变化。</p><label className="fl2-check"><input type="checkbox" checked={useDefaults} onChange={e => { setUseDefaults(e.target.checked); setStep(Math.min(step, 1)); }} />调用 defaults()</label><div className="fl2-model" data-testid="live-model" data-state={JSON.stringify({ step, useDefaults })}><View snapshot={snapshots[step]} pending={5} /></div><div className="fl2-buttons"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(step + 1)}>下一步</button><button onClick={() => { setStep(0); setUseDefaults(false); }}>重置推导</button></div></>;
}
function Repair() {
  const [provided, setProvided] = useState(true);
  const [policy, setPolicy] = useState<Policy>('replace-zero');
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const config = resolveConfig({ ...initialInput, policy, provided, limit: 0 });
  const clear = () => { setChecked(false); setAnswer(''); setReason(''); };
  return <><h4>诊断修复：自动备份的暂停开关</h4><p>备份器默认允许 3 个任务；用户明确填写 0 要暂停。原实现把所有 0 都改为 3。用“未提供”和“明确填 0”各检验一次修复。</p><label>输入场景<select value={String(provided)} onChange={e => { setProvided(e.target.value === 'true'); clear(); }}><option value="true">用户明确填 0</option><option value="false">用户未提供</option></select></label><label>配置规则<select value={policy} onChange={e => { setPolicy(e.target.value as Policy); clear(); }}><option value="replace-zero">if limit == 0：使用 3</option><option value="presence">if !provided：使用 3</option></select></label><fieldset disabled={checked}><legend>先预测当前规则的运行结果</legend><label>启动多少个？<select value={answer} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="0">0</option><option value="3">3</option></select></label><label>判断理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="fl2-buttons"><button disabled={!answer || !reason.trim() || checked} onClick={() => setChecked(true)}>运行备份器</button><button onClick={() => { setProvided(true); setPolicy('replace-zero'); clear(); }}>重置修复</button></div><div data-testid="live-model" data-state={JSON.stringify({ provided, policy, checked })} aria-live="polite">{checked && <div className="fl2-feedback"><strong>{Number(answer) === config.limit ? '预测一致。' : `实际启动 ${config.limit} 个。`}</strong><p>你的理由：{reason}</p><p>业务要求 {provided ? 0 : 3} 个；当前启动 {config.limit} 个。{config.limit === (provided ? 0 : 3) ? '此场景符合要求；再换另一输入检验。' : '显式零被覆盖。把判断依据改为是否提供，再运行验证。'}</p></div>}</div><p className="fl2-note">这是有提示的迁移练习，不计正式独立掌握。</p></>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="fl2 fl2-help" data-testid="foundations-help-2">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Repair />}</section>;
}
