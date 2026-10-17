import {useState} from 'react';
import {emptyCache, execute, initialConfig, keyOf, outcomeLabels, records, type CacheState, type Config, type KeyMode, type Operation, type Outcome} from './model';
import './style.css';
const schemes: Record<KeyMode, string> = {id: '仅业务 ID', joined: 'tenant + : + ID', tuple: '结构化 [tenant, ID]'};
const operations: Record<Operation, string> = {writeA: '后台写入 A', writeB: '后台写入 B', readA: '请求读取 A', readB: '请求读取 B', invalidateA: '请求失效 A'};
function Scheme({label, value, onChange}: {label: string; value: KeyMode; onChange: (mode: KeyMode) => void}) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value as KeyMode)}>{Object.entries(schemes).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>;
}
function Workbench({analogy = false, guided = false}: {analogy?: boolean; guided?: boolean}) {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [history, setHistory] = useState<CacheState[]>([emptyCache()]);
  const [operation, setOperation] = useState<Operation>('writeA');
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const state = history.at(-1)!;
  const clearPrediction = () => {setPrediction(''); setReason(''); setFeedback('');};
  const changeConfig = (next: Config) => {setConfig(next); setHistory([emptyCache()]); clearPrediction();};
  function run() {
    if (!prediction || !reason.trim()) return;
    const result = execute(state, config, operation);
    setHistory([...history, result]);
    setFeedback(`你的预测：${outcomeLabels[prediction]}。理由：${reason}。实际：${outcomeLabels[result.outcome!] }。${prediction === result.outcome ? '结果符合预测，请用键与槽位解释变化。' : '请对照下方实际访问的键，检查是否忽略租户或使用了不同编码。'}`);
  }
  return <div className="sec182-workbench">
    <p>{analogy ? '把缓存想成两个公司的寄存柜：本地票号都可能是 42。后台存包、按标签取包、注销标签都必须遵循同一套地址规则。柜门标签本身并不证明你有权取包。' : '让 A、B 写入各自发票，再读取与失效；修改三条路径的键规则，找出串数据和删不掉缓存的原因。'}</p>
    {guided && <ol className="sec182-guide"><li>保持仅 ID，依次写入 A、写入 B、读取 A；观察覆盖。</li><li>点击统一修复，重复写 A、写 B、读 A；检查两个槽位。</li><li>只把失效规则改回仅 ID，再写 A、失效 A、读 A；解释残留。</li><li>切到分隔符边界，比较拼接和结构化编码。</li></ol>}
    <div className="sec182-grid">{(['write', 'read', 'invalidate'] as const).map((path, index) => <Scheme key={path} label={['写入键规则', '读取键规则', '失效键规则'][index]} value={config[path]} onChange={value => changeConfig({...config, [path]: value})}/>)}</div>
    <div className="sec182-controls"><button onClick={() => changeConfig({...config, write: 'tuple', read: 'tuple', invalidate: 'tuple'})}>统一修复三条路径</button><label><input type="checkbox" checked={config.boundary} onChange={event => changeConfig({...config, boundary: event.target.checked})}/>分隔符边界：a:b / c 与 a / b:c</label></div>
    <p className="sec182-note">修改键规则或输入会清空本轮缓存，保持对照起点一致；不会自动迁移旧键。真实系统还需清理旧命名空间。</p>
    <div className="sec182-grid"><label>可信主体<select value={config.actor} onChange={event => (setConfig({...config, actor: event.target.value as 'A' | 'B'}), clearPrediction())}><option>A</option><option>B</option></select></label><label><input type="checkbox" checked={config.authorize} onChange={event => (setConfig({...config, authorize: event.target.checked}), clearPrediction())}/>执行租户授权校验</label></div>
    <div className="sec182-flow" aria-label="资源到写入键的映射">{records(config.boundary).map((record, index) => <div key={index}><strong>{index === 0 ? 'A' : 'B'} · {record.value}</strong><span>tenant={record.tenant} · ID={record.id}</span><span aria-hidden="true">↓ 写入地址</span><code>{keyOf(record, config.write)}</code></div>)}</div>
    <label>下一步操作<select value={operation} onChange={event => {setOperation(event.target.value as Operation); clearPrediction();}}>{Object.entries(operations).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
    <fieldset className="sec182-predict"><legend>执行前先预测</legend><label>预测结果<select aria-label="预测结果" value={prediction} onChange={event => {setPrediction(event.target.value as Outcome); setFeedback('');}}><option value="">选择一个结果</option>{Object.entries(outcomeLabels).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label><label>预测理由<textarea value={reason} placeholder="这个操作会用哪个键？该槽里目前有什么？" onChange={event => {setReason(event.target.value); setFeedback('');}}/></label><button data-security-action="step" disabled={!prediction || !reason.trim()} onClick={run}>执行一步并核对</button></fieldset>
    <div className="sec182-controls"><button data-security-action="back" disabled={history.length === 1} onClick={() => {setHistory(history.slice(0, -1)); clearPrediction();}}>回退一步</button><button data-security-action="reset" onClick={() => {setHistory([emptyCache()]); clearPrediction();}}>重置缓存</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({config, state, steps: history.length - 1})} className="sec182-cache"><strong>{analogy ? '寄存柜的实际格子' : '缓存实际槽位'} · {Object.keys(state.entries).length} 个</strong>{Object.entries(state.entries).length ? Object.entries(state.entries).map(([key, value]) => <div className={state.key === key ? 'sec182-slot sec182-active' : 'sec182-slot'} key={key}><code>{key}</code><span>→ {value.value}</span><small>来源 tenant={value.tenant} / ID={value.id}</small></div>) : <p>空缓存</p>}<p role="status">{state.message}</p><p>最近访问键：<code>{state.key ?? '尚未访问 / 授权已拦截'}</code></p></div>
    {feedback && <p className="sec182-feedback" aria-live="polite">{feedback}</p>}
    <p className="sec182-note">模型边界：内存映射、顺序执行，无 TTL、并发和数据库回源；后台写入视为可信填充。授权检查目标租户，键设计仍必须确保取出的内容属于目标资源。此处探索不记录课程掌握成绩。</p>
  </div>;
}
function Diagram() {
  const [mode, setMode] = useState<KeyMode>('id');
  const [boundary, setBoundary] = useState(false);
  const [selected, setSelected] = useState(0);
  const values = records(boundary);
  const keys = values.map(value => keyOf(value, mode));
  const slots = [...new Set(keys)];
  return <div><p>点击资源节点，追踪它指向的缓存槽；改变编码，观察两条边是否汇入同一槽。箭头表示“映射到地址”，不是授权关系。</p><Scheme label="图中的键编码" value={mode} onChange={setMode}/><label><input type="checkbox" checked={boundary} onChange={event => setBoundary(event.target.checked)}/>使用带冒号的边界输入</label><div className="sec182-graph" data-testid="live-model" data-state={JSON.stringify({mode, boundary, selected, keys})}><div className="sec182-graph-row">{values.map((value, i) => <button key={i} aria-pressed={selected === i} onClick={() => setSelected(i)}>{value.value}<br/>({value.tenant}, {value.id})</button>)}</div><div className="sec182-graph-row">{keys.map((key, i) => <div key={i} className={selected === i ? 'sec182-active' : ''}>资源 {i === 0 ? 'A' : 'B'} ↓ 槽 {slots.indexOf(key) + 1}</div>)}</div><div className="sec182-graph-row">{slots.map((key, i) => <div className={keys[selected] === key ? 'sec182-slot sec182-active' : 'sec182-slot'} key={key}><strong>槽 {i + 1}</strong><code>{key}</code><span>收到：{keys.flatMap((k, j) => k === key ? [j === 0 ? 'A' : 'B'] : []).join('、')}</span></div>)}</div></div><p role="status">{slots.length === 1 ? '两条资源路径指向同一槽：后写会覆盖先写。' : '两个资源分别寻址：这组输入没有键碰撞。'} 当前选中 {values[selected].value}。</p><p className="sec182-note">结构化编码保留字段边界；地址隔离不能证明调用者权限。</p></div>;
}
function Transfer() {
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [challenge, setChallenge] = useState(0);
  return <div><p>{challenge === 0 ? '新情境：两个学校的学生档案都叫 7。写入与读取改成 [school, id]，失效仍只用 id。先写入北校 7，再失效北校 7，然后读取北校 7。最后会怎样？' : '新情境：学校缓存已全用结构化键。南校学生把目标 school 改成北校，服务器直接信任该参数，未检查所属学校。若北校档案已缓存，键结构能阻止读取吗？'}</p><label>迁移预测<select value={answer} disabled={done} onChange={event => setAnswer(event.target.value)}><option value="">先作判断</option><option value="safe">会安全地返回未命中 / 拒绝</option><option value="unsafe">仍会读出档案</option></select></label><label>迁移理由<textarea value={reason} disabled={done} onChange={event => setReason(event.target.value)}/></label><button disabled={!answer || !reason.trim() || done} onClick={() => setDone(true)}>提交迁移预测</button>{done && <div className="sec182-feedback" role="status"><p>{answer === 'unsafe' ? '预测符合模型。' : '预测与执行结果不同。'}你的理由：{reason}</p><div data-testid="live-model" data-state={challenge === 0 ? 'stale-entry-remains' : 'unauthorized-entry-read'}>{challenge === 0 ? <><code>["北校","7"] → 档案</code><p>失效查找的键是 7，删除 0 个；复合键的槽位还在，读取继续命中。修复失效路径，再用同一流程验证。</p></> : <><code>南校主体 → 北校键 → 北校档案</code><p>编码只定位档案；请求主体是否有权使用目标学校，应在读取前独立校验。租户身份必须来自可信上下文。</p></>}</div></div>}<button onClick={() => {setChallenge(1 - challenge); setAnswer(''); setReason(''); setDone(false);}}>换一道情境并清空预测</button><p className="sec182-note">这是局部迁移练习，不写入进度；看过反馈后的重试不作为独立掌握证据。</p></div>;
}
export default function Lesson182Lab() {return <section className="sec182" data-testid="security-lab-182"><h3>双租户缓存工作台</h3><Workbench/></section>;}
export function Lesson182Help({mode}: {mode: 'example' | 'diagram' | 'steps' | 'try'}) {return <section className="sec182" data-testid="security-help-182">{mode === 'example' ? <Workbench key="example" analogy/> : mode === 'diagram' ? <Diagram/> : mode === 'steps' ? <Workbench key="steps" guided/> : <Transfer/>}</section>;}


