import { useState } from 'react';
import { advance, defaults, initial, nextLabel, trace, type Config, type State } from './model';
import './style.css';
const phaseNames = ['准备', 'A 已构建', 'A 已部署', 'B 已构建', 'latest 已覆盖', '调查完成'];
export default function Lesson198() {
  const [config, setConfig] = useState<Config>({ ...defaults });
  const [history, setHistory] = useState<State[]>([initial()]);
  const [cursor, setCursor] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [locked, setLocked] = useState(false);
  const state = history[cursor];
  const result = trace(state);
  function configure(update: Partial<Config>) { const next = { ...config, ...update }; setConfig(next); setHistory([initial(next)]); setCursor(0); }
  function step() { if (!prediction || !reason.trim()) return; setLocked(true); const next = advance(state); setHistory([...history.slice(0, cursor + 1), next]); setCursor(cursor + 1); }
  function reset() { setHistory([initial(config)]); setCursor(0); setPrediction(''); setReason(''); setLocked(false); }
  return <section className="delivery198" data-testid="delivery-lab-198">
    <header><span className="d198-eyebrow">制品档案室 · 先部署，再覆盖标签</span><h3>生产里的 latest 到底是哪一份？</h3><p>构建两份同名二进制，保留一台运行 A 的服务器。你决定保存哪些证据，再追查它的来源。</p></header>
    <fieldset disabled={locked}><legend>搭建取证链</legend>
      <label><input type="checkbox" checked={config.pinned} onChange={e => configure({ pinned: e.target.checked })} />部署记录绑定内容摘要</label>
      <label><input type="checkbox" checked={config.metadata} onChange={e => configure({ metadata: e.target.checked })} />保存源提交、dirty、工具链、依赖与构建参数</label>
      <label><input type="checkbox" checked={config.dirty} onChange={e => configure({ dirty: e.target.checked })} />B 包含未提交修改（依赖清单也变化）</label>
      <label>构建证明来源<select value={config.proof} onChange={e => configure({ proof: e.target.value as Config['proof'] })}><option value="self">上传者自述，未验证</option><option value="trusted">可信构建者，签名验证通过（假设）</option></select></label>
    </fieldset>
    <fieldset disabled={locked}><legend>先预测，再操作</legend><label>覆盖 latest 后，保存的证据能否定位生产内容？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">选择你的判断</option><option value="yes">能唯一定位 A</option><option value="no">不能消除 A / B 歧义</option></select></label><label>你的依据<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="说明哪条记录会保留，哪条引用会移动" /></label></fieldset>
    <div className="d198-controls"><button data-delivery-action="step" disabled={!prediction || !reason.trim() || cursor >= 5} onClick={step}>单步：{nextLabel(state.step)}</button><button data-delivery-action="back" disabled={cursor === 0} onClick={() => setCursor(cursor - 1)}>回退</button><button data-delivery-action="reset" onClick={reset}>重置实验</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({ ...state, assessment: state.step === 5 ? result : null, predictionLocked: locked })}>
      <ol className="d198-phases">{phaseNames.map((label, i) => <li key={label} aria-current={state.step === i ? 'step' : undefined}>{i + 1}. {label}</li>)}</ol>
      <div className="d198-grid"><article><h4>可变标签</h4><strong>latest → {state.latest ?? '尚未发布'}</strong><p>这个指针会移动。</p></article><article><h4>生产部署记录</h4><strong>{state.deployment?.recorded ?? '尚未部署'}</strong><p>{state.deployment ? '运行内容仍是 A；这是实验已知事实。调查只能使用保存的证据。' : '稍后部署第一份制品。'}</p></article></div>
      <div className="d198-grid">{state.artifacts.map(a => <article key={a.id}><h4>{a.id} · 内容身份</h4>{a.record ? <dl>{Object.entries(a.record).map(([key, value]) => <div key={key}><dt>{({ commit: '源提交', dirty: '未提交修改', go: '工具链', dependencies: '依赖', flags: '构建参数', environment: '构建环境' } as Record<string, string>)[key]}</dt><dd>{String(value)}</dd></div>)}</dl> : <p>未保存构建输入，只有身份。</p>}<p>证明：{a.proof === 'trusted' ? '可信构建者签名已验证（假设）' : '自述，真实性未验证'}</p></article>)}</div>
      <p className="d198-note" role="status">{state.note}</p>
      {state.step === 5 && <article className="d198-result"><h4>对照你的预测</h4><p>你选了“{prediction === 'yes' ? '能定位 A' : '不能消歧'}”；{(prediction === 'yes') === result.identity ? '与模型结果一致。' : '与模型结果不同，检查部署记录是否保存内容身份。'}</p><p>原始理由：{reason}</p><ul><li>内容身份：{result.identity ? '定位 A' : 'A / B 待排查'}</li><li>构建输入：{result.source ? '可沿记录查阅' : '证据链不完整'}</li><li>来源可信度：{result.trusted ? '按本模型信任策略通过' : '未建立可信来源'}</li><li>逐字节复现：尚未验证，需控制环境和非确定性并实际重建比对</li></ul><p>重置后改变一个条件再比较；操作历史只属于观察练习。</p></article>}
    </div>
    <p className="d198-boundary">模型边界：artifact-A / B 是教学内容身份符号，代表两份不同字节的摘要，不执行真实哈希或签名。dirty=true 只暴露来源差异，若要恢复实际源文件还需保存相应源码快照。摘要本身不证明制品安全或来源可信。记录仅含公开构建信息，不包含秘密。</p>
  </section>;
}
function Example() {
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const options = ['Git 标签相同', 'Go 版本相同', '本地 C 编译器与库版本不同', '生产文件摘要不同'];
  return <><h4>证据桌：同一提交为什么产物不同？</h4><p>订单服务启用 cgo；构建机甲与乙使用同一提交和 Go 版本。选出能解释或证实差异的证据，放入你的调查链。</p><div className="d198-grid">{options.map(o => <button key={o} aria-pressed={selected.includes(o)} onClick={() => { setSelected(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o]); setRevealed(false); }}>{o}</button>)}</div><p>调查链：{selected.join(' → ') || '尚未选择证据'}</p><button disabled={!selected.length} onClick={() => setRevealed(true)}>核对证据作用</button>{revealed && <p role="status">{selected.includes(options[2]) ? 'C 编译器与库版本是额外构建输入，支持产物差异的原因解释。' : '还缺少解释 cgo 差异的输入证据。'} {selected.includes(options[3]) ? '摘要不同说明产物内容不同，但不能单独解释原因。' : '再核对实际文件摘要，先确认内容是否不同。'} 同提交或同 Go 版本不能覆盖全部输入；这些证据也不能单独证明构建可信。</p>}</>;
}
function Diagram() {
  const [focus, setFocus] = useState('identity');
  const paths: Record<string, { nodes: string[]; edges: string[]; note: string }> = {
    identity: { nodes: ['生产实例', '部署记录', '制品摘要'], edges: ['生产实例 → 部署记录：绑定本次部署', '部署记录 → 制品摘要：定位内容'], note: '这里回答“运行了哪份字节”。可变标签不能替代保存的内容摘要。' },
    inputs: { nodes: ['制品摘要', '构建记录', '输入清单'], edges: ['制品摘要 → 构建记录：查询此内容的来源声明', '构建记录 → 输入清单：源提交、dirty、依赖、工具链、参数'], note: '这里回答“声称怎样构建”。dirty 状态不能替代未提交源码快照，复现还需完整输入及非确定性控制。' },
    trust: { nodes: ['构建记录', '签名与信任策略'], edges: ['构建记录 → 签名与信任策略：验证绑定内容、签名和构建者身份'], note: '这里回答“为何相信这份声明”。签名验证需要可信身份和策略；任意人签名或拥有摘要并不够。' },
  };
  const path = paths[focus];
  return <><h4>沿问题选择追踪路径</h4><div className="d198-controls">{[['identity', '哪份内容'], ['inputs', '什么输入'], ['trust', '为何可信']].map(([key, label]) => <button key={key} aria-pressed={focus === key} onClick={() => setFocus(key)}>{label}</button>)}</div><div className="d198-map">{['生产实例', '部署记录', '制品摘要', '构建记录', '输入清单', '签名与信任策略'].map(n => <span key={n} data-active={path.nodes.includes(n)}>{n}</span>)}</div><ul>{path.edges.map(edge => <li key={edge}>{edge}</li>)}</ul><p role="status">{path.note}</p></>;
}
const procedure = ['冻结并记录构建输入', '构建并计算实际制品摘要', '绑定构建证明并验证信任', '部署记录绑定摘要并保留历史'];
function Steps() {
  const [built, setBuilt] = useState<string[]>([]);
  const [message, setMessage] = useState('你是发布流水线操作者。按依赖关系构建证据链，系统会拒绝缺前置条件的步骤。');
  function add(label: string) { if (label !== procedure[built.length]) { setMessage(`暂不能“${label}”：先完成“${procedure[built.length]}”，否则下一条记录缺少绑定依据。`); return; } setBuilt([...built, label]); setMessage(built.length === 3 ? '证据链完成。下一步要验证复现时，需要另开受控重建并比对字节；当前链条没有执行这件事。' : `已完成“${label}”，新证据将成为下一步输入。`); }
  return <><h4>你来组织构建与发布过程</h4><div className="d198-grid">{[procedure[3], procedure[1], procedure[0], procedure[2]].map(p => <button key={p} disabled={built.includes(p)} onClick={() => add(p)}>{p}</button>)}</div><ol>{built.map(p => <li key={p}>{p}</li>)}</ol><p role="status">{message}</p><div className="d198-controls"><button disabled={!built.length} onClick={() => { setBuilt(built.slice(0, -1)); setMessage('撤回最后一步，后续证据必须重新建立。'); }}>撤回一步</button><button onClick={() => { setBuilt([]); setMessage('证据链已清空，请重新组织。'); }}>重新组织</button></div></>;
}
function Try() {
  const [answer, setAnswer] = useState(''); const [reason, setReason] = useState(''); const [submitted, setSubmitted] = useState(false);
  return <><h4>新情境：第三方镜像的漂亮证明</h4><p>生产记录保存了镜像摘要；供应商提供绑定该摘要的签名声明，列出源提交和依赖。签名数学验证通过，但签名者不在你的可信构建者名单里，也没有重建实验。</p><fieldset disabled={submitted}><legend>给出判断与证据</legend><label>现在能得出的结论<select value={answer} onChange={e => setAnswer(e.target.value)}><option value="">选择结论</option><option value="all">来源可信且可以逐字节复现</option><option value="identity">可定位内容，来源信任和复现仍待验证</option><option value="none">没有任何有用证据</option></select></label><label>为什么？<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="区分内容身份、签名者信任与复现证据" /></label></fieldset><button disabled={submitted || !answer || !reason.trim()} onClick={() => setSubmitted(true)}>提交并揭晓</button>{submitted && <div className="d198-note" role="status"><p>{answer === 'identity' ? '判断符合证据边界。' : '重新区分三种结论：摘要支持内容定位；签名通过不自动让签名者可信；没有重建比对不能声称复现。'}</p><p>你的理由：{reason}</p><p>下一步核实构建者身份与信任策略，审核证明绑定和输入完整性；复现需要单独重建验证。本题是帮助中的迁移练习，不计入独立掌握。</p></div>}</>;
}
export function Help({ mode }: { mode: string }) { return <section className="delivery198 d198-help" data-testid="delivery-help-198"><p className="d198-eyebrow">帮助练习 · 不计入独立掌握</p>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}</section>; }
