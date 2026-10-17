import { useState } from 'react';
import { act, advance, current, initial, inspect, rewind, type Action, type LabState } from './model';
import './style.css';

function Dataset({ state, selected, onSelect }: { state: LabState; selected?: number; onSelect?: (id: number) => void }) {
  const snap = current(state);
  return <div className="arch116-dataset"><strong>服务端实时列表（按唯一 ID 升序）</strong><div className="arch116-records">{snap.records.map((id, index) => <button key={id} disabled={!onSelect} aria-pressed={onSelect ? selected === id : undefined} onClick={() => onSelect?.(id)} className={(index < snap.offset ? 'arch116-passed ' : '') + (snap.cursor !== null && id <= snap.cursor ? 'arch116-before' : '')}><small>位置 {index}</small><strong>ID {id}</strong><small>{snap.cursor !== null && id <= snap.cursor ? '≤ 游标' : '> 游标 / 未定'}</small></button>)}</div><p>位置从 0 开始；左侧色条表示位置已在 offset 之前，下边线表示 ID 在游标边界内。</p>{!snap.records.length && <p>列表为空</p>}</div>;
}
function Results({ state, selected }: { state: LabState; selected?: number }) {
  const snap = current(state);
  return <div className="arch116-results">{(['offset', 'key'] as const).map(kind => { const view = inspect(state, kind); return <article key={kind} data-testid={'pagination-' + kind}><h4>{kind === 'offset' ? '偏移分页' : '键集分页'}</h4><code>{kind === 'offset' ? '下次从位置 ' + snap.offset + ' 取 2 条' : '下次取 ID > ' + (snap.cursor ?? '起点') + '，最多 2 条'}</code><ol>{view.pages.map((page, i) => <li key={i}>第 {i + 1} 次读取：{page.length ? page.map((id, j) => <span key={j} className={(view.duplicates.includes(id) ? 'arch116-duplicate ' : '') + (selected === id ? 'arch116-selected' : '')}>ID {id} </span>) : '空页'}</li>)}</ol>{!view.pages.length && <p>尚未读取</p>}<dl><dt>重复读到</dt><dd>{view.duplicates.join(', ') || '无'}</dd><dt>已被继续边界越过的原有未读记录</dt><dd data-testid={'skipped-' + kind}>{view.skipped.join(', ') || '无'}</dd><dt>边界前后来补入（不会向前补读）</dt><dd>{view.behindNew.join(', ') || '无'}</dd><dt>未读就被删除</dt><dd>{view.deletedUnread.join(', ') || '无'}</dd></dl></article>; })}</div>;
}
function Explorer({ example = false, steps = false }: { example?: boolean; steps?: boolean }) {
  const fresh = () => initial(example ? [10, 20, 30, 40] : undefined);
  const [state, setState] = useState<LabState>(fresh);
  const [prediction, setPrediction] = useState(''), [captured, setCaptured] = useState('');
  const snap = current(state);
  const script: Action[] = ['read', 'insert', 'read', 'append', 'read', 'read'];
  const index = state.history.length - 1;
  const actionNames: Record<Action, string> = { read: '两种方案读取下一页', insert: '前方补入记录', delete: '删除最前记录', append: '后方追加记录' };
  function perform(action: Action) { setState(act(state, action)); if (action === 'read') { setCaptured(prediction); setPrediction(''); } else setCaptured(''); }
  return <><h3>{example ? '浏览收据时，迟到的旧单据进入列表' : steps ? '读一页、补入记录、再继续读' : '同一份列表，两种继续方式'}</h3><p>{example ? '收据按稳定编号排序。先读 10、20，再补入较早的收据或删除旧收据，观察浏览结果。' : '先读取一页，再直接修改实时列表。已经读过的页、offset 与 ID 游标会保留。'}</p>
    {!steps && <><div className="arch116-actions"><button disabled={snap.frontAdded} onClick={() => perform('insert')}>前方补入记录</button><button disabled={!snap.records.length} onClick={() => perform('delete')}>删除最前记录</button><button onClick={() => perform('append')}>后方追加记录</button></div><label>可选预测：下一页哪种方案会重复？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">直接探索</option><option value="offset">仅偏移</option><option value="key">仅键集</option><option value="neither">都不重复</option></select></label></>}
    <div data-testid="live-model" data-state={JSON.stringify(state)}><Dataset state={state} /><Results state={state} /></div>
    <div className="arch116-actions"><button data-arch-action="back" disabled={index === 0} onClick={() => { setState(rewind(state)); setCaptured(''); setPrediction(''); }}>回退一步</button><button data-arch-action="step" disabled={steps && index >= script.length} onClick={() => perform(steps ? script[index] : 'read')}>{steps ? index < script.length ? actionNames[script[index]] : '演示完成' : '两种方案读取下一页'}</button><button data-arch-action="reset" onClick={() => { setState(fresh()); setCaptured(''); setPrediction(''); }}>重置实验</button></div>
    <div className="arch116-feedback" aria-live="polite"><strong>操作 {index}</strong><p>{snap.event}</p>{captured && <p>读取前预测：{captured === 'offset' ? '仅偏移重复' : captured === 'key' ? '仅键集重复' : '都不重复'}。本次页与之前已读页重复的 ID：偏移 {inspect(state, 'offset').lastPage.filter(id => snap.offsetPages.slice(0, -1).flat().includes(id)).join(', ') || '无'}；键集 {inspect(state, 'key').lastPage.filter(id => snap.keyPages.slice(0, -1).flat().includes(id)).join(', ') || '无'}。</p>}</div>
    <p className="arch116-note">教学模型：唯一不可变 ID 升序，每页 2 条；前方补入模拟较早记录延迟进入可见列表，并非新生成 ID 逆序。后方追加生成更大 ID。记录删除仍会消失，游标不提供开始时的快照。回退撤销最近操作；再操作会从此分支继续。</p></>;
}
export default function Lesson116() { return <section className="arch116" data-testid="architecture-lab-116"><Explorer /></section>; }
export function Help({ mode }: { mode: string }) { return <aside className="arch116 arch116-help" data-testid="architecture-help-116"><p>辅助理解 · 不计入独立掌握</p>{mode === 'example' ? <Explorer key="example" example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Explorer key="steps" steps /> : <Challenge />}</aside>; }
function Diagram() {
  const [change, setChange] = useState<Action>('insert'), [selected, setSelected] = useState(2);
  const state = act(advance(initial()), change);
  const snap = current(state);
  return <><h3>位置移动，记录身份不变</h3><label>第一页之后的变化<select value={change} onChange={e => setChange(e.target.value as Action)}><option value="insert">前方补入 ID 0</option><option value="delete">删除 ID 1</option><option value="append">后方追加 ID 7</option></select></label><Dataset state={state} selected={selected} onSelect={setSelected} /><div className="arch116-trace" aria-live="polite">选中 ID {selected} → 当前位置 {snap.records.indexOf(selected) < 0 ? '已删除' : snap.records.indexOf(selected)} → {!snap.records.includes(selected) ? '不再参与分页' : snap.records.indexOf(selected) < snap.offset ? '在 offset 前' : '可进入偏移后续页'} / {selected <= (snap.cursor ?? -Infinity) ? '在游标边界内' : '可进入键集后续页'}</div><Results state={advance(state)} selected={selected} /><p>上方保留读取前的边界；下方同时展示第二页。点击 ID 会高亮两种结果中的同一条记录。索引变化不等于身份变化。</p></>;
}
function Challenge() {
  const [variant, setVariant] = useState(0), [answer, setAnswer] = useState(''), [reason, setReason] = useState(''), [submitted, setSubmitted] = useState(false);
  const scenarios = [
    { text: '工单列表 [10,20,30,40]，已读取 10、20。删除 10 后，offset=2 的下一页与 ID>20 的下一页分别是什么？', options: ['偏移 [40]；键集 [30,40]', '两者都是 [30,40]', '偏移 [20,30]；键集 [30,40]'], expected: '0', feedback: '删除前方记录让 30 移到位置 1，offset=2 越过它；稳定边界 ID>20 仍返回 30、40。修复连续浏览可改用稳定键，但删除的记录无法凭游标恢复。' },
    { text: '活动列表 [1,2,3,4]，已读 1、2。之后追加 ID 5。按 ID 游标继续读完会不会看到 5？', options: ['不会，游标自动冻结开始时的数据', '会，后续可读到 5；它不是快照', '必须重置游标才能看到'], expected: '1', feedback: '下一页 3、4，再下一页 5。键集条件描述继续边界，不冻结数据；要求时点一致的导出还需快照或固定版本策略。' },
  ]; const item = scenarios[variant];
  function reset(next = variant) { setVariant(next); setAnswer(''); setReason(''); setSubmitted(false); }
  return <><h3>换个列表判断</h3><p>{item.text}</p><label>你的判断<select value={answer} disabled={submitted} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option>{item.options.map((text, i) => <option key={text} value={i}>{text}</option>)}</select></label><label>判断理由<textarea value={reason} disabled={submitted} onChange={e => setReason(e.target.value)} placeholder="依据索引变化或稳定 ID 条件推导" /></label><button disabled={!answer || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交并看反馈</button>{submitted && <div className="arch116-feedback" data-testid="challenge-feedback" aria-live="polite"><strong>{answer === item.expected ? '判断符合模型' : '结果不同，请检查继续条件'}</strong><p>{item.feedback}</p><p>你的理由：{reason}</p><p>只核对选项；理由保留供你对照，没有自动语义评分。</p></div>}<div className="arch116-actions"><button onClick={() => reset()}>重试本题</button><button onClick={() => reset((variant + 1) % scenarios.length)}>换一个情境</button></div></>;
}


