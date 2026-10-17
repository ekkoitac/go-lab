import { useState } from 'react';
import { advance, defaults, detectionStage, graph, initial, inspect, rewind, strategyNames, timeline, type Config, type LabState, type Node, type Strategy } from './model';
import './style.css';
import RelationGraph from '../RelationGraph';

function DiagramView({ config, built = [], selected, onSelect }: { config: Config; built?: Node[]; selected?: Node; onSelect?: (node: Node) => void }) {
  const dependencies = graph(config);
  const positions={Service:{x:105,y:12},DB:{x:8,y:155},Client:{x:198,y:155}};
  return <RelationGraph label="构造依赖图：箭头表示需要" height={225} selected={selected} onSelect={onSelect?(id=>onSelect(id as Node)):undefined} nodes={(['Service','DB','Client'] as Node[]).map(id=>({id,...positions[id],active:built.includes(id),missing:dependencies[id]===null,detail:dependencies[id]===null?'缺少提供者':built.includes(id)?'已构造':'尚未构造'}))} edges={(['Service','DB','Client'] as Node[]).flatMap(from=>(dependencies[from]??[]).map(to=>({from,to,active:config.cycle&&((from==='DB'&&to==='Service')||(from==='Service'&&to==='DB'))})))}/>;
}
export default function Lesson108() {
  const [state, setState] = useState<LabState>(() => initial());
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const view = inspect(state);
  function configure(patch: Partial<Config>) { setState(initial({ ...state.config, ...patch })); setPrediction(''); setReason(''); }
  return <section className="arch108" data-testid="architecture-lab-108">
    <header><p className="arch108-kicker">装配工作台 / 108</p><h3>依赖看得见，资源收得回</h3><p>搭一张构造图，单步观察错误在哪个阶段暴露，以及失败后谁负责关闭已打开的资源。</p></header>
    <div className="arch108-controls">
      <label>装配方式<select value={state.config.strategy} onChange={e => configure({ strategy: e.target.value as Strategy })}>{Object.entries(strategyNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      <label>构造时故障<select value={state.config.failAt} onChange={e => configure({ failAt: e.target.value as Config['failAt'] })}><option value="none">无：正常启动后退出</option><option value="Client">Client 地址不可达</option><option value="Service">Service 启动检查拒绝配置</option></select></label>
      <label className="arch108-check"><input type="checkbox" checked={state.config.missingClient} onChange={e => configure({ missingClient: e.target.checked })} />移除 Client 提供者</label>
      <label className="arch108-check"><input type="checkbox" checked={state.config.cycle} onChange={e => configure({ cycle: e.target.checked })} />让 DB 反向依赖 Service</label>
      <label className="arch108-check"><input type="checkbox" checked={state.config.cleanup} onChange={e => configure({ cleanup: e.target.checked })} />装配点登记逆序清理</label>
    </div>
    <fieldset disabled={state.phase > 0}><legend>可选：运行前预测</legend><label>本轮结局<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">直接探索</option><option value="graph">构造图检查失败，尚未打开资源</option><option value="clean">构造或运行结束，资源收回</option><option value="leak">结束后仍有资源打开</option></select></label><label>理由<input value={reason} onChange={e => setReason(e.target.value)} placeholder="哪条依赖或清理职责决定结果？" /></label></fieldset>
    <div data-testid="live-model" data-state={JSON.stringify({ ...state, ...view })}>
      <DiagramView config={state.config} built={view.built} />
      <div className="arch108-stack"><strong>装配点持有的清理栈（右侧为栈顶）</strong><div>{view.active.length ? view.active.map(node => <span key={node}>{node} · 打开</span>) : <span>空</span>}</div><small>已关闭顺序：{view.closed.join(' → ') || '暂无'}</small></div>
      <div className="arch108-metrics"><span>已构造 <b>{view.built.length}</b></span><span>打开资源 <b>{view.active.length}</b></span><span>已关闭 <b>{view.closed.length}</b></span></div>
    </div>
    <div className="arch108-actions"><button type="button" data-arch-action="back" disabled={!state.phase} onClick={() => setState(rewind(state))}>回退一步</button><button type="button" data-arch-action="step" disabled={view.done} onClick={() => setState(advance(state))}>{state.phase ? '执行下一步' : '检查并开始装配'}</button><button type="button" data-arch-action="reset" onClick={() => { setState(initial()); setPrediction(''); setReason(''); }}>重置实验</button></div>
    <div className="arch108-feedback" aria-live="polite"><strong>第 {state.phase} 步 · {view.stage}</strong><p>{view.message}</p>{state.phase > 0 && <p>{prediction ? `本轮已记录预测。${reason ? `理由：${reason}` : ''}` : '本轮为自由探索，未记录预测。'}</p>}{view.done && prediction && <p>{prediction === (view.built.length === 0 ? 'graph' : view.active.length ? 'leak' : 'clean') ? '预测与观察一致。' : '预测与观察不同：请用依赖路径和清理栈解释差异，再修改一个条件重跑。'}</p>}</div>
    <details><summary>保持条件不变，对照三种装配方式</summary><p>检查的是同一张依赖图和同一构造故障。装配工具改变部分错误的发现阶段，不会自动消除网络失败。</p><div className="arch108-table"><table><thead><tr><th>方式</th><th>本轮失败发现阶段</th><th>最终遗留资源</th></tr></thead><tbody>{(['explicit', 'generated', 'runtime'] as Strategy[]).map(strategy => { const config = { ...state.config, strategy }; const end = timeline(config).at(-1)!; return <tr key={strategy}><th>{strategyNames[strategy]}</th><td>{detectionStage(config)}</td><td>{end.active.length}</td></tr>; })}</tbody></table></div></details>
    <p className="arch108-note">教学模型：DB 与 Client 持有资源，Service 只借用；失败构造函数自己清理其内部临时资源。显式方案缺失提供者指引用了不存在的构造函数，编译器可发现；语义依赖环仍需审查，nil、配置和外部连接错误仍可能在运行时出现。生成式方案假定生成器验证图；容器假定启动时完整解析。实际工具验证与清理策略各异。回退是模拟快照，不代表真实资源可复活。</p>
  </section>;
}
export function Help({ mode }: { mode: string }) { return <aside className="arch108 arch108-help" data-testid="architecture-help-108"><p className="arch108-kicker">辅助理解 · 不计入独立掌握</p>{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</aside>; }
function Example() {
  const [cleanup, setCleanup] = useState(false);
  const [executed, setExecuted] = useState(false);
  const end = timeline({ ...defaults, cleanup }).at(-1)!;
  return <><h3>订单服务启动到一半失败</h3><p>DB 打开成功，支付 Client 地址不可达。切换清理责任后执行，观察 DB 是否仍被占用。</p><label className="arch108-check"><input type="checkbox" checked={cleanup} onChange={e => { setCleanup(e.target.checked); setExecuted(false); }} />在装配点登记 DB.Close</label><pre>{'db := OpenDB()\nclient, err := NewClient(url)\nif err != nil {\n' + (cleanup ? '  db.Close()\n' : '  // 尚未清理 db\n') + '  return err\n}'}</pre><button type="button" onClick={() => setExecuted(true)}>执行这个失败分支</button><div className="arch108-feedback" aria-live="polite">{executed ? `支付 Client 未创建；DB ${end.active.length ? '仍打开，已产生遗留资源' : '已关闭，失败回滚完成'}。` : '等待执行：当前没有观察结果。'}</div></>;
}
function Diagram() {
  const [selected, setSelected] = useState<Node>('Service');
  const [cycle, setCycle] = useState(false);
  const config = { ...defaults, cycle };
  const dependencies = graph(config)[selected] || [];
  return <><h3>沿构造参数追踪依赖</h3><p>选中一个对象，与它直接需要的对象联动高亮。箭头表示「构造前必须有」。</p><DiagramView config={config} selected={selected} onSelect={setSelected} /><label className="arch108-check"><input type="checkbox" checked={cycle} onChange={e => setCycle(e.target.checked)} />加入 DB → Service 依赖</label><pre>{`${selected}(${dependencies.join(', ')})`}</pre><div className="arch108-feedback" aria-live="polite">{cycle ? 'Service 需要 DB，但 DB 又等待 Service。没有一个能先构造，需拆开这条责任依赖。' : `${selected} ${dependencies.length ? `需要先取得 ${dependencies.join(' 与 ')}。` : '不依赖其他对象，可先构造。'}`}</div><p className="arch108-note">这是构造关系，不是请求调用方向；单纯换容器不会解开环。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState('');
  const choices = ['打开 DB', '打开 Client', '关闭 Client', '关闭 DB'];
  const expected = [0, 1, 2, 3];
  const prompts = ['先构造没有前置依赖的 DB。', 'DB 已打开；继续构造 Client。', 'Client 已打开，但 Service 校验失败。现在先清理谁？', 'Client 已关闭；还剩哪个成功获取的资源？'];
  function act(index: number) { if (step >= 4) return; if (index === expected[step]) { setStep(step + 1); setFeedback('操作已执行，清理栈已更新。'); } else setFeedback(step < 2 ? '资源还未全部获取，按当前装配顺序推进。' : '检查栈顶：先关闭最后成功获取且尚未关闭的资源。'); }
  return <><h3>跟着装配点走一遍</h3><p>{prompts[step] || '回滚完成：Client → DB。Service 失败，未被加入资源栈。'}</p><div className="arch108-stack">清理栈：{step === 1 || step === 3 ? 'DB' : step === 2 ? 'DB → Client（栈顶）' : '空'}</div><div className="arch108-actions">{choices.map((choice, i) => <button type="button" key={choice} disabled={step === 4} onClick={() => act(i)}>{choice}</button>)}</div><p aria-live="polite">{feedback}</p><button type="button" onClick={() => { setStep(0); setFeedback(''); }}>重新走一遍</button></>;
}
function Transfer() {
  const [stage, setStage] = useState('');
  const [order, setOrder] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return <><h3>迁移：报表任务的启动失败</h3><p>显式 Go 构造代码已通过编译。先打开文件，再连接消息队列；随后 Worker 因部署环境中的账号权限不足而启动失败。前两项由装配点拥有，Worker 不保留资源。</p><fieldset disabled={submitted}><legend>先提交判断，再看反馈</legend><label>这次错误在哪个阶段发现？<select value={stage} onChange={e => setStage(e.target.value)}><option value="">请选择</option><option value="compile">编译期</option><option value="runtime">启动期</option></select></label><label>装配点的清理顺序<select value={order} onChange={e => setOrder(e.target.value)}><option value="">请选择</option><option value="file">文件 → 队列</option><option value="queue">队列 → 文件</option><option value="none">Worker 失败，因此无需清理</option></select></label><label>依据<input value={reason} onChange={e => setReason(e.target.value)} placeholder="说明外部条件与成功获取顺序" /></label></fieldset><button type="button" disabled={!stage || !order || !reason.trim() || submitted} onClick={() => setSubmitted(true)}>提交并验证</button>{submitted && <div className="arch108-feedback" aria-live="polite"><strong>{stage === 'runtime' && order === 'queue' ? '判断符合本例。' : '再沿证据检查一次。'}</strong><p>部署账号的外部权限在启动时才验证；已打开资源按获取逆序关闭：队列 → 文件。显式构造让依赖可见，并不让所有配置错误提前到编译期。</p><button type="button" onClick={() => { setSubmitted(false); setStage(''); setOrder(''); setReason(''); }}>清空后重试</button></div>}</>;
}
