import { useState } from 'react';
import { advance, configure, initial, inspect, project, checkContract, rewind, stages, trace, type Config, type Field, type LabState } from './model';
import './style.css';

function View({ state, selected, onSelect }: { state: LabState; selected?: string; onSelect?: (key: string) => void }) {
  const view = inspect(state);
  return <div className="a112-views">
    <section><h4>① 领域对象</h4>{Object.entries(view.domain).map(([key, value]) => <button type="button" key={key} className={selected === key ? 'a112-selected' : ''} disabled={!onSelect} onClick={() => onSelect?.(key)} aria-pressed={onSelect ? selected === key : undefined}>{key}: {JSON.stringify(value)}{key === 'riskScore' && <small>内部风控字段</small>}</button>)}</section>
    <section><h4>② 字段路径</h4>{Object.keys(view.domain).map(key => <div key={key} className={`a112-path ${selected === key ? 'a112-selected' : ''}`} data-field={key} data-routed={view.routed.includes(key)}><code>{key}</code><span>{state.phase === 0 ? '待映射' : view.routed.includes(key) ? '→ 公开响应' : '⊣ 留在内部'}</span></div>)}</section>
    <section><h4>③ 实际响应</h4><pre data-testid="dto-response">{view.response ? JSON.stringify(view.response, null, 2) : '尚未编码'}</pre>{selected && view.response && <p>选中 {selected}：{Object.hasOwn(view.response, selected) ? '已出现在响应中' : '未进入响应'}</p>}</section>
    <section className="a112-contract"><h4>④ 契约检查</h4><p>公开字段必须恰好为 id、name。</p><p data-testid="dto-contract">{view.contract ? view.contract.passes ? '通过：字段集合符合契约' : `失败：多出 [${view.contract.unexpected.join(', ')}]；缺少 [${view.contract.missing.join(', ')}]` : '尚未检查'}</p></section>
  </div>;
}
function Actions({ state, onChange }: { state: LabState; onChange: (state: LabState) => void }) {
  return <div className="a112-actions"><button data-arch-action="back" disabled={!state.phase} onClick={() => onChange(rewind(state))}>回退一步</button><button data-arch-action="step" disabled={state.phase === 3} onClick={() => onChange(advance(state))}>执行下一步</button><button data-arch-action="reset" onClick={() => onChange(initial(state.config))}>重置本轮</button></div>;
}
export default function Lesson112() {
  const [state, setState] = useState(() => initial());
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [captured, setCaptured] = useState<{ answer: string; reason: string } | null>(null);
  function edit(patch: Partial<Config>) { setState(configure(state, patch)); setCaptured(null); }
  function move(next: LabState) { if (!state.phase && next.phase === 1) setCaptured({ answer: prediction, reason }); if (!next.phase) setCaptured(null); setState(next); }
  return <section className="a112" data-testid="architecture-lab-112">
    <header><p>公开边界实验 / 112</p><h3>新增一个内部字段，会到达客户端吗？</h3><p>修改领域对象、搭建公开白名单，再沿字段路径检查真实 JSON。</p></header>
    <div className="a112-controls"><label>编码方式<select value={state.config.strategy} onChange={e => edit({ strategy: e.target.value as Config['strategy'] })}><option value="direct">直接编码领域对象</option><option value="dto">显式 DTO 白名单</option></select></label><label>领域姓名<input value={state.config.name} onChange={e => edit({ name: e.target.value })} /></label><label className="a112-check"><input type="checkbox" checked={state.config.addedRisk} onChange={e => edit({ addedRisk: e.target.checked })} />新增内部风控字段</label>{state.config.addedRisk && <label>风控分数<input type="number" min="0" max="100" value={state.config.risk} onChange={e => edit({ risk: Math.max(0, Math.min(100, Number(e.target.value))) })} /></label>}</div>
    <fieldset disabled={state.config.strategy === 'direct'}><legend>公开映射白名单（仅 DTO 使用）</legend>{(['id', 'name', 'riskScore'] as Field[]).map(field => <label className="a112-check" key={field}><input type="checkbox" checked={state.config.whitelist.includes(field)} onChange={e => edit({ whitelist: e.target.checked ? [...state.config.whitelist, field] : state.config.whitelist.filter(key => key !== field) })} />映射 {field}</label>)}</fieldset>
    <fieldset disabled={state.phase > 0}><legend>可选：预测最终契约检查</legend><label>预测结果<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">直接探索</option><option value="pass">通过</option><option value="fail">失败</option></select></label><label>预测理由<input value={reason} onChange={e => setReason(e.target.value)} placeholder="哪个字段会穿过公开边界？" /></label></fieldset>
    <div data-testid="live-model" data-state={JSON.stringify(state)}><View state={state} /></div>
    <Actions state={state} onChange={move} /><div className="a112-feedback" aria-live="polite"><strong>第 {state.phase} 步 · {stages[state.phase]}</strong><p>{trace(state)}</p>{state.phase === 3 && captured?.answer && <p>你的预测：{captured.answer === 'pass' ? '通过' : '失败'}；实际：{inspect(state).contract!.passes ? '通过' : '失败'}。理由：{captured.reason || '未填写'}。请据字段路径核对理由。</p>}</div>
    <p className="a112-note">确定性教学模型：字段均模拟 Go 中可导出且未设置 json:"-" 的字段；契约是本接口批准的精确字段集合。这里不模拟鉴权、嵌套字段或实际网络调用。DTO 名称本身不保证安全，安全来自正确的映射与契约检查。</p>
  </section>;
}
export function Help({ mode }: { mode: string }) { return <aside className="a112 a112-help" data-testid="architecture-help-112"><p className="a112-note">辅助理解 · 独立状态，不计入掌握</p>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Challenge />}</aside>; }
function Example() {
  const [includeCost, setIncludeCost] = useState(false);
  const [price, setPrice] = useState(99);
  const domain = { sku: 'BOOK-7', price, supplierCost: 35 };
  const response = project(domain, 'dto', includeCost ? ['sku', 'price', 'supplierCost'] : ['sku', 'price']);
  return <><h4>商品接口：售价与进货成本</h4><label>公开售价<input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} /></label><label className="a112-check"><input type="checkbox" checked={includeCost} onChange={e => setIncludeCost(e.target.checked)} />把 supplierCost 加入商品 DTO</label><div className="a112-views"><section><h4>仓库领域对象</h4><pre>{JSON.stringify(domain, null, 2)}</pre></section><section><h4>顾客收到的 JSON</h4><pre data-testid="example-response">{JSON.stringify(response, null, 2)}</pre></section></div><p aria-live="polite">{checkContract(response, ['sku', 'price']).passes ? '批准的售价会同步变化；进货成本留在内部。' : '错误白名单把进货成本送给顾客；改名为 DTO 无法阻止这条映射。取消成本映射再检查。'}</p></>;
}
function Diagram() {
  const [selected, setSelected] = useState('riskScore');
  const [include, setInclude] = useState(false);
  const state = { ...initial({ strategy: 'dto', addedRisk: true, name: '小周', risk: 91, whitelist: include ? ['id', 'name', 'riskScore'] : ['id', 'name'] } as Config), phase: 3 };
  return <><h4>点选字段，追踪公开路径</h4><label className="a112-check"><input type="checkbox" checked={include} onChange={e => setInclude(e.target.checked)} />连接 riskScore 到公开映射</label><View state={state} selected={selected} onSelect={setSelected} /><p aria-live="polite">当前追踪：{selected}。同名字段在对象、路径和响应中对应；阻断线表示未映射，不是客户端隐藏。</p></>;
}
function Steps() {
  const [state, setState] = useState(() => initial({ strategy: 'direct', addedRisk: true, name: '小陈', risk: 76, whitelist: ['id', 'name'] }));
  return <><h4>定位一次意外字段暴露</h4><label>修复路径<select value={state.config.strategy} onChange={e => setState(configure(state, { strategy: e.target.value as Config['strategy'] }))}><option value="direct">复现：直接编码</option><option value="dto">修复：只映射批准字段</option></select></label><View state={state} /><Actions state={state} onChange={setState} /><div className="a112-feedback" aria-live="polite"><strong>{stages[state.phase]}</strong><p>{trace(state)}</p></div></>;
}
function Challenge() {
  const [scenario, setScenario] = useState(0);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  function reset(next: number) { setScenario(next); setAnswer(''); setReason(''); setSubmitted(false); }
  const expected = scenario ? 'restore' : 'remove';
  return <><h4>审查一个新接口</h4><p>{scenario ? '物流接口原有契约要求 parcelId、status。改用 DTO 后，白名单只有 parcelId，JSON 仍可解析。应怎样修复？' : '教师管理对象新增 internalNote；公开课程 DTO 白名单为 courseId、title、internalNote。怎样避免内部备注公开？'}</p><label>你的修复方案<select value={answer} disabled={submitted} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="remove">从公开白名单移除内部字段</option><option value="restore">恢复契约要求的必需字段</option><option value="rename">仅把结构名称改为 SafeDTO</option></select></label><label>判断理由<textarea value={reason} disabled={submitted} onChange={e => setReason(e.target.value)} placeholder="指出实际响应与批准契约的具体差异" /></label><button disabled={!answer || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交判断并揭晓</button>{submitted && <div className="a112-feedback" data-testid="challenge-feedback" role="status"><strong>{answer === expected ? '方案符合当前契约' : '方案尚未修复当前字段差异'}</strong><p>{scenario ? '差异：status 丢失。修复：把 status 恢复到显式映射，并断言 parcelId、status 均存在。只删字段无法修复缺失。' : '差异：internalNote 多出。修复：只映射 courseId、title，并断言公开字段集合不含内部备注。DTO 仍会执行错误白名单。'}</p><p>你的理由：{reason}</p><p>这里只核对方案；理由请结合实际字段差异自行复查，不作自动语义评分。</p></div>}<div className="a112-actions"><button onClick={() => reset(scenario)}>重试本情境</button><button onClick={() => reset(1 - scenario)}>换一个情境</button></div></>;
}
