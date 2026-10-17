import {useState} from 'react';
import {hex, parseInput, runExperiment, shrinkOnce, runeGroups, type ExperimentInput, type Outcome, type Result} from './model';
import './style.css';
const outcomeLabel: Record<Outcome, string> = {pass: '性质通过', fail: '找到反例', skip: '前提不成立，跳过'};
const initial: ExperimentInput = {input: '猫咪Go', mode: 'text', implementation: 'byte', property: 'utf8'};
function Bytes({values, kept}: {values: number[]; kept?: number}) {
  return <div className="l86-bytes" aria-label="UTF-8 字节排列">{values.length ? values.map((b, i) => <span key={i} className={kept !== undefined && i < kept ? 'l86-kept' : ''}><small>字节 {i}</small>{hex([b])}</span>) : <span>∅ 空序列</span>}</div>;
}
function Experiment({practice = false}: {practice?: boolean}) {
  const baseline = practice ? {...initial, input: '🙂Go'} : initial;
  const [config, setConfig] = useState<ExperimentInput>(baseline);
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const edit = (patch: Partial<ExperimentInput>) => {setConfig({...config, ...patch}); setResult(null); setPrediction(''); setReason(''); setError(''); setHistory([]);};
  const reset = () => {setConfig(baseline); setPrediction(''); setReason(''); setResult(null); setError(''); setHistory([]);};
  let bytes: number[] = [];
  let inputError = '';
  try {bytes = parseInput(config.input, config.mode);} catch (e) {inputError = (e as Error).message;}
  const run = () => {if (!prediction || !reason.trim()) {setError('先选择结果并写下理由，再验证。'); return;} try {setResult(runExperiment(config)); setError('');} catch (e) {setError((e as Error).message);}};
  const shrink = () => {const next = shrinkOnce(config); if (next === null) return; setHistory([...history, `${config.input || '∅'} → ${next || '∅'}`]); const changed = {...config, input: next}; setConfig(changed); setResult(runExperiment(changed));};
  const canShrink = result?.outcome === 'fail' && shrinkOnce(config) !== null;
  return <div className="l86-workbench">
    <p>{practice ? '迁移练习：自己构造新种子，预测再验证。此处属于辅助练习，不记录正式成绩。' : '目标：自己选择种子，找到“合法输入经过 first 后仍合法”的反例，再缩小它。'}</p>
    <p className="l86-note">这是确定性的性质实验台，不运行 Go fuzz 引擎，也不会自动生成大量样本。每次验证只检查当前输入。</p>
    <div className="l86-controls">
      <label>输入表示<select value={config.mode} onChange={e => edit({mode: e.target.value as ExperimentInput['mode'], input: e.target.value === 'hex' ? 'FF' : '猫咪Go'})}><option value="text">Unicode 文本</option><option value="hex">Go 字符串字节（十六进制）</option></select></label>
      <label>种子输入<input value={config.input} maxLength={240} onChange={e => edit({input: e.target.value})}/></label>
      <label>截取实现<select value={config.implementation} onChange={e => edit({implementation: e.target.value as ExperimentInput['implementation']})}><option value="byte">按首字节 s[:1]（空串保护）</option><option value="rune">按首 rune（完整码点）</option></select></label>
      <label>要验证的性质<select value={config.property} onChange={e => edit({property: e.target.value as ExperimentInput['property']})}><option value="utf8">合法 UTF-8 输入 → 合法 UTF-8 输出</option><option value="length">输出字节数 ≤ 输入字节数（弱性质）</option></select></label>
    </div>
    <div className="l86-actions"><button onClick={() => edit({input: 'abc', mode: 'text'})}>ASCII 种子</button><button onClick={() => edit({input: '猫咪Go', mode: 'text'})}>中文种子</button><button onClick={() => edit({input: '', mode: 'text'})}>空串种子</button><button onClick={() => edit({input: 'FF', mode: 'hex'})}>非法字节</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({config, outcome: result?.outcome ?? 'hidden', history})}>
      <h4>输入 → 切割 → 性质断言</h4><Bytes values={bytes} kept={result?.output.length}/>
      {inputError && <p role="alert">{inputError}</p>}
      <p className="l86-note">文本模式只接收 Unicode 码点；字节模式可表示任意 Go 字符串字节。非法 UTF-8 会跳过本课性质。绿色标出实际保留的字节。</p>
      {!result ? <fieldset><legend>先预测此种子会得到什么结果</legend><label>我的预测<select value={prediction} onChange={e => setPrediction(e.target.value as Outcome | '')}><option value="">请选择</option><option value="pass">性质通过</option><option value="fail">找到反例</option><option value="skip">前提不成立，跳过</option></select></label><label>我的理由<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="说明首码点需要几个字节，或性质的前提是否成立。"/></label></fieldset> : <section className="l86-feedback" aria-live="polite"><strong>{outcomeLabel[result.outcome]}</strong><p>{history.length ? '缩减仍保持失败性质。原始预测仅对应缩减前的种子。' : `你的预测：${outcomeLabel[prediction as Outcome]}，${prediction === result.outcome ? '与观察一致' : '与观察不同'}。`}</p><p>原始理由：{reason}</p><p>{result.explanation}</p><p>输出字节：<code>{result.validInput ? hex(result.output) : '未执行'}</code>；输出 UTF-8：{result.validInput ? result.validOutput ? '合法' : '非法' : '未检查'}</p></section>}
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="l86-actions"><button data-testing-action="step" disabled={!!result || !!inputError || !prediction || !reason.trim()} onClick={run}>验证这个种子</button><button disabled={!canShrink} onClick={shrink}>缩减：删除末尾一个码点</button><button data-testing-action="reset" onClick={reset}>重置实验</button></div>
    {!!history.length && <ol aria-label="反例缩减证据">{history.map((step, i) => <li key={i}>{step}：仍失败</li>)}</ol>}
    {result?.outcome === 'fail' && !canShrink && <p>无法继续按本规则删除末尾码点并保留失败。当前是此简化规则下的反例，不保证全局最小；真实 fuzz 会采用更丰富的变异和缩减策略。</p>}
    {result && <p>下一步：切换实现或性质后重新预测。找到反例应保存为回归语料；本实验不写入 Go 语料目录。</p>}
  </div>;
}
export default function Lab() {return <section className="lesson86" data-testid="testing-lab-86"><h3>种子、性质与反例缩减</h3><Experiment/></section>;}
function Example() {
  const [seed, setSeed] = useState('a');
  return <div><p>同一输入，同时比较两种实现；先看字节是否完整，再判断性质。</p><label>对照样例<select value={seed} onChange={e => setSeed(e.target.value)}><option value="a">ASCII：a</option><option value="猫">中文：猫</option><option value="🙂">emoji：🙂</option><option value="">空串</option></select></label><div className="l86-comparison">{(['byte', 'rune'] as const).map(implementation => {const result = runExperiment({input: seed, mode: 'text', implementation, property: 'utf8'}); return <section key={implementation}><h4>{implementation === 'byte' ? '首字节' : '首 rune'}</h4><Bytes values={result.output}/><strong>{outcomeLabel[result.outcome]}</strong><p>{result.explanation}</p></section>;})}</div></div>;
}
function Diagram() {
  const groups = runeGroups('A猫🙂');
  const [selected, setSelected] = useState(1);
  return <div><p>点击一个码点，联动查看编码字节。这里的 rune 是码点，不是字节，也不保证是整个视觉字符。</p><div className="l86-actions">{groups.map((group, i) => <button key={i} aria-pressed={i === selected} onClick={() => setSelected(i)}>{group.rune} · 码点 {i}</button>)}</div><div className="l86-diagram"><strong>{groups[selected].rune}</strong><span aria-hidden="true">↓ UTF-8 编码</span><Bytes values={groups[selected].bytes}/><p>这个码点共 {groups[selected].bytes.length} 字节；若只保留第一个字节，{groups[selected].bytes.length === 1 ? '恰好完整。' : `会丢失 ${groups[selected].bytes.length - 1} 个后续字节，无法解码。`}</p></div></div>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const stages = invalid ? ['种子 FF：准备交给性质检查。', 'utf8.ValidString(s) = false：合法输入前提不成立。', '跳过 first 和断言；跳过不是通过，另行定义非法输入契约。'] : ['种子“猫咪”：编码 E7 8C AB E5 92 AA。', 'utf8.ValidString(s) = true：可以检查性质。', 'first 执行 s[:1]，得到 E7：切断首码点。', 'utf8.ValidString(first(s)) = false：记录失败反例。', '删掉末尾“咪”，候选“猫”仍失败：保留这个更短反例。'];
  return <div><label><input type="checkbox" checked={invalid} onChange={e => {setInvalid(e.target.checked); setStep(0);}}/>改走非法字节分支</label><ol className="l86-stages">{stages.map((text, index) => <li key={text} aria-current={index === step ? 'step' : undefined}>{index <= step ? text : '待执行'}</li>)}</ol><div className="l86-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button disabled={step === stages.length - 1} onClick={() => setStep(step + 1)}>执行下一步</button><button onClick={() => setStep(0)}>回到种子</button></div><p>逐步揭示的是教学过程；真实 Go 中 F.Add 提供种子，F.Fuzz 注册性质，fuzz 引擎负责生成输入与缩减。</p></div>;
}
export function Help({mode}: {mode: string}) {return <section className="lesson86" data-testid="testing-help-86"><h3>{mode === 'example' ? '同种子对照' : mode === 'diagram' ? '码点与字节联动' : mode === 'steps' ? '追踪性质检查路径' : '换种子找反例'}</h3>{mode === 'example' ? <Example/> : mode === 'diagram' ? <Diagram/> : mode === 'steps' ? <Steps/> : <Experiment practice/>}</section>;}
