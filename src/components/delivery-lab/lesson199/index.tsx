import { useState } from 'react';
import { choices, current199, initial199, issues199, transition199, triggers199, type Action199, type Choice, type State199 } from './model';
import './style.css';

export default function Lesson199() {
  const [history, setHistory] = useState<State199[]>([initial199()]);
  const state = history[history.length - 1];
  const [selectedRecord, setSelectedRecord] = useState('ADR-001');
  const act = (action: Action199) => setHistory(h => [...h, transition199(h[h.length - 1], action)]);
  const triggers = triggers199(state);
  const active = current199(state);
  const inspected = state.records.find(r => r.id === selectedRecord) ?? active;
  return <section className="delivery199" data-testid="delivery-lab-199">
    <header><span className="d199-kicker">证据推理 × 决策演进</span><h3>让 ADR 经得起下一次变化</h3><p>旧决定依据“两团队独立发布”。改变现实条件，再检查新决定能否说清依据、代价和退路。</p></header>
    <div data-testid="live-model" data-state={JSON.stringify(state)} className="d199-workbench">
      <div className="d199-grid">
        <fieldset><legend>1 · 当前发生了什么</legend>
          <label>组织要求<select aria-label="组织要求" value={state.context.organization} onChange={e => act({ type: 'organization', value: e.target.value as 'independent' | 'merged' })}><option value="independent">两团队必须独立发布</option><option value="merged">团队合并，允许共同发布</option></select></label>
          <label>实测维护成本：{state.context.measuredCost} 人日/月<input aria-label="实测维护成本" type="range" min="0" max="40" value={state.context.measuredCost} onChange={e => act({ type: 'measurement', value: Number(e.target.value) })} /></label>
          <div className={triggers.length ? 'd199-signal d199-alert' : 'd199-signal'}><strong>{triggers.length ? '复评已触发' : '尚未触发复评'}</strong><p>{triggers.length ? triggers.join('；') : `当前 ${active.id} 的组织条件未变，成本未超过 ${active.threshold} 人日/月。`}</p></div>
          <p className="d199-note">变更输入不会改写旧 ADR，也不会自动证明应当合并或继续拆分。</p>
        </fieldset>
        <fieldset><legend>2 · 把证据放进本次决定</legend>
          <label className="d199-check"><input type="checkbox" checked={state.evidence.organization} onChange={e => act({ type: 'evidence', key: 'organization', value: e.target.checked })} />绑定当前组织约束</label>
          <label className="d199-check"><input type="checkbox" checked={state.evidence.measurement} onChange={e => act({ type: 'evidence', key: 'measurement', value: e.target.checked })} />绑定本次实测成本</label>
          <p className="d199-note">修改证据源会撤销对应绑定，避免用过期材料发布新决定。</p>
          <label>本次方案<select aria-label="本次方案" value={state.choice} onChange={e => act({ type: 'choice', value: e.target.value as Choice })}>{Object.entries(choices).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          <div className="d199-comparison">{Object.entries(choices).map(([key, value]) => <article key={key} data-selected={state.choice === key}><strong>{value.label}</strong><p>{value.cost}</p><small>{key === 'services' ? '可分别部署；团队合并后仍可能因隔离要求保留。' : '共同部署；当前仍强制独立发布时不可选。'}</small></article>)}</div>
          <label className="d199-check"><input type="checkbox" checked={state.costAccepted} onChange={e => act({ type: 'cost', value: e.target.checked })} />明确接受：{choices[state.choice].cost}</label>
        </fieldset>
      </div>
      <fieldset><legend>3 · 说明决定何时需要重看</legend>
        <label>下一版成本复评阈值：{state.threshold} 人日/月<input aria-label="下一版复评阈值" type="range" min="5" max="40" value={state.threshold} onChange={e => act({ type: 'threshold', value: Number(e.target.value) })} /></label>
        <p className="d199-note">组织约束变化也触发复评。提高阈值不等于成本改善；此实验不验证阈值是否具有真实业务依据。</p>
        <label>我的权衡理由（原文保存，不自动评分）<textarea aria-label="我的权衡理由" rows={3} value={state.rationale} onChange={e => act({ type: 'rationale', value: e.target.value })} placeholder="为什么接受这个代价？另一个方案在什么条件下值得重看？" /></label>
      </fieldset>
      <div className="d199-actions"><button type="button" data-delivery-action="step" onClick={() => act({ type: 'step' })}>{state.phase === 'reviewed' ? '单步：发布新 ADR' : '单步：复核证据'}</button><button type="button" data-delivery-action="back" disabled={history.length < 2} onClick={() => setHistory(h => h.slice(0, -1))}>回退一步</button><button type="button" data-delivery-action="reset" onClick={() => { setHistory([initial199()]); setSelectedRecord('ADR-001'); }}>重置实验</button></div>
      <p role="status" className="d199-feedback">{state.notice}</p>
      {state.phase === 'draft' && <p className="d199-note">待处理：{issues199(state).join('；') || '材料已齐备，可复核。'}</p>}
      <h4>历史链 · 当前生效 {active.id}</h4>
      <nav className="d199-chain" aria-label="ADR 历史">{state.records.map(r => <button type="button" key={r.id} aria-pressed={inspected.id === r.id} onClick={() => setSelectedRecord(r.id)}>{r.id}<small>{r.status === 'accepted' ? '当前接受' : `已被 ${r.supersededBy} 替代`}</small></button>)}</nav>
      <article className="d199-record"><h4>{inspected.id} · {choices[inspected.choice].label}</h4><p>证据：{inspected.evidence.join('；')}</p><p>代价：{inspected.acceptedCost}</p><p>复评：组织约束改变，或维护成本 &gt; {inspected.threshold} 人日/月。</p><p className="d199-raw">理由：{inspected.rationale || '未填写自由文本理由；结构证据通过不代表解释能力已验证。'}</p>{inspected.supersedes && <button type="button" onClick={() => setSelectedRecord(inspected.supersedes!)}>追溯被替代记录 {inspected.supersedes}</button>}{inspected.supersededBy && <button type="button" onClick={() => setSelectedRecord(inspected.supersededBy!)}>查看替代记录 {inspected.supersededBy}</button>}</article>
    </div>
    <p className="d199-note">教学边界：成本是人为输入的观察值，模型只检查证据和决策状态；不计算架构收益，不执行迁移，也不替代真实评审。</p>
  </section>;
}

function Example() {
  const [parts, setParts] = useState<string[]>([]);
  const cards = [{ id: 'context', title: '补回背景', text: '当时订单与支付团队每周各自发布，合并发布平均等待 2 天。' }, { id: 'option', title: '补回被拒方案及代价', text: '模块化单体少了网络排障，但当时不能满足独立发布；选择服务拆分需额外维护接口。' }, { id: 'trigger', title: '补回复评条件', text: '若团队合并，或每月维护超过 20 人日，重新评估边界。' }];
  return <div><h4>修复一份无法解释的 ADR</h4><p>档案里只剩“必须微服务”。选择恢复哪些证据，观察后来的团队能回答什么。</p><div className="d199-actions">{cards.map(c => <button type="button" key={c.id} aria-pressed={parts.includes(c.id)} onClick={() => setParts(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])}>{c.title}</button>)}</div><article className="d199-record"><strong>ADR-007 · 当年选择服务拆分</strong>{cards.filter(c => parts.includes(c.id)).map(c => <p key={c.id}>{c.text}</p>)}<p role="status">{parts.includes('context') && parts.includes('option') ? '现在能解释当年的取舍。' : '仍无法完整还原为什么这样选。'}{parts.includes('trigger') ? ' 组织合并事件可匹配复评条件。' : ' 遇到组织合并，仍不知道何时应重看。'}</p></article><p className="d199-note">补齐证据让记录可用，并不证明服务拆分始终正确。</p></div>;
}
function Diagram() {
  const [focus, setFocus] = useState('context');
  const [changed, setChanged] = useState(false);
  const nodes = [{ id: 'context', title: '背景约束' }, { id: 'choice', title: '备选与决定' }, { id: 'cost', title: '承担的后果' }, { id: 'trigger', title: '复评条件' }, { id: 'next', title: '新 ADR' }];
  const edges = [{ from: 'context', to: 'choice', text: '限定可行方案' }, { from: 'choice', to: 'cost', text: '必须显式接受代价' }, { from: 'context', to: 'trigger', text: '约束变化时触发' }, { from: 'cost', to: 'trigger', text: '测量偏离时触发' }, { from: 'trigger', to: 'next', text: changed ? '条件已变化 → 开启复评，可产生替代记录' : '尚未触发 → 继续监测' }];
  const related = edges.filter(e => e.from === focus || e.to === focus);
  return <div><h4>点击节点，追踪它怎样约束别处</h4><div className="d199-map">{nodes.map(n => <button type="button" key={n.id} aria-pressed={focus === n.id} data-linked={related.some(e => e.from === n.id || e.to === n.id)} onClick={() => setFocus(n.id)}>{n.title}</button>)}</div><label className="d199-check"><input type="checkbox" checked={changed} onChange={e => setChanged(e.target.checked)} />注入事件：原先独立发布的团队合并</label><div className="d199-edges" aria-live="polite">{edges.map(e => <p key={e.from + e.to} data-active={e.from === focus || e.to === focus}>{nodes.find(n => n.id === e.from)?.title} → {nodes.find(n => n.id === e.to)?.title}<strong>{e.text}</strong></p>)}</div><p className="d199-note">高亮表示所选对象的直接关系；触发复评不会自动选定新技术。新 ADR 与旧 ADR 通过“替代 / 被替代”双向连接。</p></div>;
}
const timeline = [
  { event: '接受 ADR-011', before: '两团队独立发布；维护 12 人日/月', after: '服务边界被接受；阈值 20 人日/月', old: '接受', next: '尚不存在' },
  { event: '出现新证据', before: 'ADR-011 仍保留原始背景', after: '团队合并，维护升至 28：两个复评条件命中', old: '接受，待复评', next: '尚不存在' },
  { event: '比较备选', before: '合并后共同发布已可接受', after: '比较保留服务与合并部署；记录隔离需求和迁移代价', old: '接受，待复评', next: 'ADR-012 草案' },
  { event: '接受新的权衡', before: '团队已核对证据、接受迁移代价并约定再次复评', after: 'ADR-012 替代 ADR-011；这只是决定生效，迁移和成本改善仍需后续验证', old: '被 ADR-012 替代', next: 'ADR-012 接受，链接 ADR-011' },
];
function Steps() {
  const [step, setStep] = useState(0);
  const item = timeline[step];
  return <div><h4>逐步追踪：变化的是决定状态，还是历史事实？</h4><ol className="d199-timeline">{timeline.map((t, i) => <li key={t.event} data-current={i === step}>{i + 1}. {t.event}</li>)}</ol><article className="d199-record"><strong>{item.event}</strong><p>输入 / 前态：{item.before}</p><p>操作后：{item.after}</p><dl><dt>旧记录</dt><dd>{item.old}</dd><dt>新记录</dt><dd>{item.next}</dd></dl><p>始终保留的历史：当年要求独立发布、成本基线为 12。</p></article><div className="d199-actions"><button type="button" disabled={step === 0} onClick={() => setStep(s => s - 1)}>上一步</button><button type="button" disabled={step === timeline.length - 1} onClick={() => setStep(s => s + 1)}>下一步</button><button type="button" onClick={() => setStep(0)}>从头回放</button></div></div>;
}
function Try() {
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState<{ choice: string; reason: string } | null>(null);
  return <div><h4>换到缓存决策：新的结算规则来了</h4><p>ADR-021 允许价格缓存陈旧 5 分钟，以降低查询成本。现在结算要求“下单前必须核验最新价格”，旧记录约定“一致性要求变化时复评”。下一步如何处理？</p><fieldset><legend>先判断，再揭晓</legend>{[{ id: 'review', text: '触发复评，比较结算前校验等备选；接受新决定时保留旧记录链接' }, { id: 'delete', text: '直接删除旧 ADR，换成“永远禁用缓存”' }, { id: 'ignore', text: '维持旧决定，因为曾经被接受就不能改' }].map(o => <label className="d199-check" key={o.id}><input type="radio" name="d199-transfer" value={o.id} checked={choice === o.id} onChange={() => { setChoice(o.id); setSubmitted(null); }} />{o.text}</label>)}<label>你的理由<textarea aria-label="新情境判断理由" rows={3} value={reason} onChange={e => { setReason(e.target.value); setSubmitted(null); }} placeholder="哪个旧约束失效？为何不能直接选定唯一新技术？" /></label><button type="button" disabled={!choice} onClick={() => setSubmitted({ choice, reason })}>提交判断并揭晓</button></fieldset>{submitted && <div className="d199-feedback" role="status"><strong>{submitted.choice === 'review' ? '判断符合这条复评规则。' : '这个操作丢失了可复核的决策过程。'}</strong><p>新要求使“结算可以使用 5 分钟内旧价格”的假设失效，应按预设条件复评。浏览阶段仍可能使用缓存；结算校验、缩短缓存窗口等方案要结合正确性与成本比较，不能直接断言永久禁用。</p><p>若新决定被接受：标记 ADR-021 被替代，并双向链接新记录。对照你的理由是否指出“约束变化、备选权衡、历史保留”。自由文本没有被自动判分。</p><p className="d199-raw">你的原文：{submitted.reason || '（尚未填写）'}</p><small>这是带揭晓的迁移练习，不写入独立掌握记录。</small></div>}</div>;
}
export function Help({ mode }: { mode: string }) {
  return <section className="delivery199 d199-help" data-testid="delivery-help-199">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Try />}</section>;
}
