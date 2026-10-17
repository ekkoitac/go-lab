import { useState } from 'react';
import { buildTrace, initialConfig, outcome, outcomeLabels, type Config, type OpenResult, type Policy, type ResourceState } from './model';
import './style.css';
const policies: Record<Policy, string> = { ignore: '忽略 Open 错误', early: '先 defer，再检查', checked: '先检查，再 defer' };
const results: Record<OpenResult, string> = { missing: '文件不存在', denied: '没有读取权限', success: '文件存在且可读' };
const code: Record<Policy, string> = {
  ignore: 'f, _ := os.Open(path)\ndefer f.Close()\n_, err := f.Read(buf)\nreturn err',
  early: 'f, err := os.Open(path)\ndefer f.Close()\nif err != nil { return err }\n_, err = f.Read(buf)\nreturn err',
  checked: 'f, err := os.Open(path)\nif err != nil { return err }\ndefer f.Close()\n_, err = f.Read(buf)\nreturn err',
};
function Graph({ state }: { state: ResourceState }) {
  const names = { unopened: '尚未取得', nil: 'f = nil', open: '文件已打开', closed: '文件已关闭' };
  return <div className="io62-graph" data-testid="live-model" data-state={JSON.stringify(state)}>
    <div className="io62-node" data-active={state.stage === 'Open'}><span>① 获取</span><strong>{state.primary ? 'Open 失败' : state.file === 'unopened' ? '等待 Open' : 'Open 成功'}</strong><small>{state.primary || 'err = nil / 尚未调用'}</small></div>
    <svg className="io62-connector" viewBox="0 0 300 28" role="img" aria-label="Open 返回结果进入资源槽"><path d="M150 1v20m-6-6 6 6 6-6" fill="none" stroke={state.primary ? "#bc7445" : "#4c7fa6"} strokeWidth="2" /></svg>
    <div className="io62-node io62-resource" data-file={state.file}><span>② 资源槽</span><div className="io62-file" aria-hidden="true">{state.file === 'nil' ? '∅' : state.file === 'closed' ? '✓' : state.file === 'open' ? '▤' : '?'}</div><strong>{names[state.file]}</strong><small>Read 调用 {state.readCalls} 次</small></div>
    <svg className="io62-connector" viewBox="0 0 300 36" role="img" aria-label="函数退出时按清理栈执行"><path d="M150 1v25m-6-6 6 6 6-6" fill="none" stroke={state.closeCalls ? "#267d58" : "#8d9fb4"} strokeWidth="2" /><text x="165" y="19" fontSize="12" fill="#52677e">函数退出时</text></svg>
    <div className="io62-node" data-active={state.stage.includes('defer')}><span>③ 清理栈</span><strong>{state.deferred === 'none' ? '没有注册' : `接收者 = ${state.deferred === 'nil' ? 'nil' : '文件'}`}</strong><div className="io62-stack" data-filled={state.deferred !== 'none'}>{state.deferred !== 'none' ? 'defer f.Close()' : '空栈'}</div><small>Close 调用 {state.closeCalls} 次{state.closeError ? ' → ErrInvalid' : ''}</small></div>
  </div>;
}
function Options({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  return <div className="io62-options"><label>打开条件<select value={config.result} onChange={e => onChange({ ...config, result: e.target.value as OpenResult })}>{Object.entries(results).map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select></label><label>代码策略<select value={config.policy} onChange={e => onChange({ ...config, policy: e.target.value as Policy })}>{Object.entries(policies).map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select></label></div>;
}
function Prediction({ value, reason, onValue, onReason, disabled = false }: { value: string; reason: string; onValue: (v: string) => void; onReason: (v: string) => void; disabled?: boolean }) {
  return <fieldset className="io62-predict" disabled={disabled}><legend>先预测最终返回与清理行为</legend><label>我的判断<select value={value} onChange={e => onValue(e.target.value)}><option value="">请选择</option>{Object.entries(outcomeLabels).map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label><label>依据是什么？<textarea rows={2} value={reason} onChange={e => onReason(e.target.value)} placeholder="例如：Open 失败时 f 是什么，哪一步会执行？" /></label></fieldset>;
}
const Boundary = () => <p className="io62-boundary">模型边界：模拟 os.Open 和 *os.File 的失败契约；成功后的 Read、Close 均假设成功。nil *os.File 的这两个方法返回 ErrInvalid，其他类型的方法可能 panic。自定义构造器若返回部分资源与错误，应按其契约清理。</p>;
export default function Lesson62() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [step, setStep] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [started, setStarted] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [repairNote, setRepairNote] = useState('');
  const trace = buildTrace(config); const state = trace[step];
  const change = (c: Config) => { setConfig(c); setStep(0); setPrediction(''); setReason(''); setStarted(false); setDiagnosis(''); setRepairNote(''); };
  return <section className="io62" data-testid="io-lab-62"><h3>文件获取台：第一现场在哪里？</h3><p>把文件条件与代码顺序作为两个变量，追踪资源、错误和清理栈。改变条件会开始一轮新实验。</p>
    <Options config={config} onChange={change} /><pre className="io62-code">{code[config.policy]}</pre>
    <Prediction value={prediction} reason={reason} onValue={setPrediction} onReason={setReason} disabled={started} />
    <div className="io62-actions"><button disabled={!prediction || !reason.trim() || started} onClick={() => { setStarted(true); setStep(1); }}>记录预测并执行 Open</button><button data-io-action="step" disabled={!started || step >= trace.length - 1} onClick={() => setStep(step + 1)}>下一步</button><button data-io-action="back" disabled={step === 0} onClick={() => setStep(step - 1)}>回退</button><button data-io-action="reset" onClick={() => change(initialConfig)}>重置实验</button></div>
    <p className="io62-status" role="status">步骤 {step}/{trace.length - 1} · {state.stage}：{state.event}</p><Graph state={state} />
    <div className="io62-evidence"><p><b>最初的证据：</b>{state.primary || '尚无 Open 错误'}</p><p><b>当前返回值：</b>{state.reported || '暂无错误返回'}</p></div>
    {state.done && <div className="io62-feedback"><strong>{prediction === outcome(config) ? '预测吻合。' : '预测需要修正。'}实际：{outcomeLabels[outcome(config)]}</strong><p>你的理由：{reason}</p>{config.result === 'success' && <p>成功路径无法暴露错误检查的遗漏。切换到「文件不存在」再验证。</p>}
      {config.policy !== 'checked' && config.result !== 'success' && <><label>依据轨迹定位问题<select value={diagnosis} onChange={e => setDiagnosis(e.target.value)}><option value="">请选择诊断</option><option value="open">失败后仍按已获得资源安排操作</option><option value="read">文件内容太短</option><option value="close">Close 应在 Read 之前</option></select></label><button disabled={!diagnosis} onClick={() => { if (diagnosis !== 'open') { setRepairNote('轨迹中 Open 已失败，尚未取得可读内容；请先检查资源取得边界。'); return; } change({ ...config, policy: 'checked' }); setRepairNote('已把 err 检查移到 defer 和 Read 前。请重新预测并执行，核对失败路径是否还使用资源。'); }}>应用修复并准备复验</button></>}
    </div>}{repairNote && <p role="status">{repairNote}</p>}<Boundary /></section>;
}
function Example() {
  const [result, setResult] = useState<OpenResult>('missing');
  return <><h4>对照例子：同一个缺失配置</h4><p>保持文件条件一致，只改变 err 检查位置。先看谁保留了第一现场，再把输入切为成功反查。</p><label>共同输入<select value={result} onChange={e => setResult(e.target.value as OpenResult)}>{Object.entries(results).map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select></label><div className="io62-compare">{(['ignore', 'checked'] as Policy[]).map(policy => { const config = { policy, result }; const trace = buildTrace(config); return <article key={policy}><h4>{policies[policy]}</h4><pre className="io62-code">{code[policy]}</pre><Graph state={trace[trace.length - 1]} /><p>{outcomeLabels[outcome(config)]}</p></article>; })}</div></>;
}
function Diagram() {
  const [config, setConfig] = useState<Config>({ policy: 'checked', result: 'missing' }); const [step, setStep] = useState(0);
  const trace = buildTrace(config);
  return <><h4>交互流程：把检查闸门移到资源前</h4><p>切换闸门会重建整条执行路径；逐步点亮资源槽和清理栈。</p><Options config={config} onChange={c => { setConfig(c); setStep(0); }} /><Graph state={trace[step]} /><p role="status">{trace[step].stage}：{trace[step].event}</p><div className="io62-actions"><button disabled={step >= trace.length - 1} onClick={() => setStep(step + 1)}>沿箭头执行</button><button disabled={!step} onClick={() => setStep(step - 1)}>退回上一节点</button><button onClick={() => setStep(0)}>回到起点</button></div></>;
}
function Steps() {
  const [result, setResult] = useState<OpenResult>('missing'); const [step, setStep] = useState(0);
  const trace = buildTrace({ result, policy: 'checked' }); const s = trace[step];
  return <><h4>分步拆解：成功才取得清理责任</h4><div className="io62-actions"><button aria-pressed={result === 'missing'} onClick={() => { setResult('missing'); setStep(0); }}>走失败分支</button><button aria-pressed={result === 'success'} onClick={() => { setResult('success'); setStep(0); }}>走成功分支</button></div><ol className="io62-steps">{trace.map((item, i) => <li key={i} data-active={i === step} data-past={i < step}>{i <= step ? item.stage : '待执行'}</li>)}</ol><Graph state={s} /><p role="status">{s.event}</p><p>{s.stage === '检查 err' ? result === 'missing' ? '现在没有取得文件。下一步应返回原始错误，不建立清理责任。' : '现在已取得文件。下一步才注册清理，然后使用。' : '留意注册 defer 只保存接收者；Close 的调用数要到退出时才增加。'}</p><div className="io62-actions"><button disabled={step === trace.length - 1} onClick={() => setStep(step + 1)}>执行下一条</button><button disabled={!step} onClick={() => setStep(step - 1)}>回看前一步</button><button onClick={() => setStep(0)}>从头拆解</button></div></>;
}
function Try() {
  const [prediction, setPrediction] = useState(''); const [reason, setReason] = useState(''); const [revealed, setRevealed] = useState(false); const [fixed, setFixed] = useState(false);
  const config: Config = { result: 'denied', policy: fixed ? 'checked' : 'early' }; const trace = buildTrace(config);
  const reset = () => { setRevealed(false); setPrediction(''); setReason(''); };
  return <><h4>换条件试试：文件存在，但没有权限</h4><p>这次已经写了 err 检查，但先注册了 defer。是否还会发生无效操作？这是帮助内的迁移练习，不计入正式成绩。</p><pre className="io62-code">{code[config.policy]}</pre><Prediction value={prediction} reason={reason} onValue={setPrediction} onReason={setReason} disabled={revealed} /><div className="io62-actions"><button disabled={!prediction || !reason.trim() || revealed} onClick={() => setRevealed(true)}>提交判断并揭晓</button><button onClick={() => { setFixed(false); reset(); }}>重新尝试</button></div>{revealed && <><Graph state={trace[trace.length - 1]} /><p role="status">{prediction === outcome(config) ? '判断一致。' : '对照修正：'}{outcomeLabels[outcome(config)]}。{fixed ? '检查失败就返回，未注册清理。' : 'defer 注册时保存 nil，return 时才执行 Close；这次不会执行 Read。'}</p><p>你的依据：{reason}</p>{!fixed && <button onClick={() => { setFixed(true); reset(); }}>把检查移到 defer 前，再预测验证</button>}</>}</>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="io62 io62-help" data-testid="io-help-62">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}<Boundary /></section>;
}

