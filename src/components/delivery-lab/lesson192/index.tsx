import {useState} from 'react';
import {coverage, defaults, evaluateAssertions, simulate, sortContract, type Lane, type Options} from './model';
import './style.css';

const boundary = '教学边界：本页运行内存模型，没有连接 PostgreSQL 或 Redis。版本冲突来自明确的 CAS 契约，并非宣称所有数据库事务都会拒绝第二次写入。真实隔离级别、驱动、NULL 与排序仍需固定兼容版本的集成测试。';
function LaneView({lane, title, lost}: {lane: Lane; title: string; lost: number}) {
  return <article className="d192-lane"><h4>{title}</h4><div className="d192-value">{lane.value}<small>版本 v{lane.version}</small></div><p>成功 {lane.successes} · 冲突 {lane.conflicts}</p><p className={lost ? 'd192-warning' : ''}>已报告成功但未体现在值中的增量：{lost}</p><div className="d192-readers">{(['A','B'] as const).map(actor => <span key={actor}>{actor} 快照：{lane.reads[actor] ? `${lane.reads[actor]!.value} / v${lane.reads[actor]!.version}` : '未读取'}</span>)}</div><p className="d192-evidence">{lane.log.at(-1) ?? '初始值 100，尚未执行'}</p></article>;
}
export default function Lesson192() {
  const [options,setOptions] = useState<Options>(defaults);
  const [cursor,setCursor] = useState(0);
  const [predictionLocked,setPredictionLocked] = useState(false);
  const [prediction,setPrediction] = useState('');
  const [reason,setReason] = useState('');
  const state = simulate(options,cursor);
  const configure = (patch: Partial<Options>) => {setOptions({...options,...patch}); setCursor(0);setPrediction('');setReason('');setPredictionLocked(false);};
  return <section className="d192" data-testid="delivery-lab-192"><h3>同一输入，两种成功含义</h3><p>A 与 B 各执行一次“读取后加值”。比较朴素 map 与承诺版本检查的存储接口，检查“成功”是否真的保留了每次增量。</p>
    <div className="d192-controls"><label>每次增加 <input aria-label="每次增加" type="range" min="1" max="50" value={options.delta} onChange={e => configure({delta:Number(e.target.value)})}/><strong>{options.delta}</strong></label><label><input type="checkbox" checked={options.concurrent} onChange={e=>configure({concurrent:e.target.checked})}/>两位写者先读再写（并发交错）</label><label><input type="checkbox" checked={options.retry} onChange={e=>configure({retry:e.target.checked})}/>修复：收到冲突后重新读取并重试</label></div>
    <details><summary>运行前，留下你的预测</summary><label>朴素 map 最终会保留几次增量？<select disabled={predictionLocked} value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">先选择</option><option value="1">一次</option><option value="2">两次</option></select></label><label>理由<textarea disabled={predictionLocked} value={reason} onChange={e=>setReason(e.target.value)} placeholder="B 写入使用的是哪个快照？"/></label>{state.done && prediction && <p>你的预测：{prediction} 次。观察结果：{(state.fake.value-100)/options.delta} 次。{reason ? '回看你写的理由，核对 B 的读取时刻。' : '试着用 B 的快照解释差异。'}这是已获得提示的探索记录，不计入独立掌握。</p>}</details>
    <div className="d192-actions"><button data-delivery-action="step" disabled={cursor>=5} onClick={()=>{setCursor(cursor+1);setPredictionLocked(true);}}>单步执行</button><button data-delivery-action="back" disabled={!cursor} onClick={()=>setCursor(cursor-1)}>回退一步</button><button data-delivery-action="reset" onClick={()=>{setCursor(0);setOptions(defaults);setPrediction('');setReason('');setPredictionLocked(false);}}>重置</button></div>
    <div data-testid="live-model" data-state={JSON.stringify(state)}><p role="status">第 {cursor}/5 步 · {state.event}</p><div className="d192-columns"><LaneView title="朴素 map fake：覆盖写" lane={state.fake} lost={state.fakeLost}/><LaneView title="参考语义：版本比较后写入" lane={state.reference} lost={state.referenceLost}/></div></div>
    <p className="d192-feedback">{cursor<4 ? '观察两个快照何时取得：读取与提交分开，旧快照可能在提交前失效。' : state.fakeLost ? `map 报告两次成功，却少保留 ${state.fakeLost} 的增量；参考模型用冲突暴露了旧版本。${options.retry && cursor===5 ? '调用方重读后重试，两次增量都保留。' : '勾选修复并重新执行，比较最终值与冲突证据。'}` : '串行时两种模型都可保留增量：这个通过样例仍没有覆盖并发冲突边界。切换并发交错再验证。'}</p><p className="d192-boundary">{boundary}</p></section>;
}

function Example() {
  const [fixed,setFixed]=useState(false), [extra,setExtra]=useState(false), [ran,setRan]=useState(false);
  const rows = [{id:'B',rank:2},{id:'A',rank:null},...(extra ? [{id:'D',rank:1}] : []),{id:'C',rank:1}];
  const expected = sortContract(rows,true), actual=sortContract(rows,fixed);
  const ids=(list: typeof rows)=>list.map(x=>`${x.id}:${x.rank===null?'NULL':x.rank}`).join(' → ');
  return <><h4>例子：接口承诺的顺序能被 fake 守住吗？</h4><p>契约明确要求 rank 升序、NULL 最后，同分按 id 升序。输入按插入顺序列出。</p><p>输入：{ids(rows)}</p><label><input type="checkbox" checked={extra} onChange={e=>{setExtra(e.target.checked);setRan(false);}}/>插入 D:1，检验同分排序</label><label><input type="checkbox" checked={fixed} onChange={e=>{setFixed(e.target.checked);setRan(false);}}/>修复 fake：显式实现契约排序</label><button onClick={()=>setRan(true)}>执行共享契约样例</button>{ran && <div role="status"><p>契约要求：{ids(expected)}</p><p>fake 输出：{ids(actual)}</p><p>{JSON.stringify(expected)===JSON.stringify(actual) ? '本样例通过：fake 已遵守这一排序契约。仍要对真实实现运行相同断言。' : '失败：插入顺序不等于承诺顺序。启用排序修复后重跑。'}</p></div>}<p className="d192-boundary">NULL 放最后是此接口显式定义的约定，不推断各数据库的默认顺序。</p></>;
}
function Diagram() {
  const [shared,setShared]=useState(true), [integration,setIntegration]=useState(false), [selected,setSelected]=useState('fake');
  const covered=coverage(shared,integration);
  return <><h4>追踪证据来自哪里</h4><p>连线表示“这套测试在哪个实现上运行”。启闭测试连接，观察证据缺口。</p><div className="d192-controls"><label><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/>共享契约连接</label><label><input type="checkbox" checked={integration} onChange={e=>setIntegration(e.target.checked)}/>真实边界测试连接</label></div><svg viewBox="0 0 520 225" role="img" aria-label="共享契约连接fake及真实实现，真实边界测试只连接真实实现"><path d="M 170 50 L 350 50 M 170 50 L 350 175" stroke={shared?'#78c7ed':'#485569'} strokeWidth={shared?4:1} strokeDasharray={shared?undefined:'6 5'} fill="none"/><path d="M 170 175 L 350 175" stroke={integration?'#f0c576':'#485569'} strokeWidth={integration?4:1} strokeDasharray={integration?undefined:'6 5'}/><text x="255" y="39" textAnchor="middle">运行于 →</text><text x="250" y="204" textAnchor="middle">运行于 →</text>{[{x:5,y:25,w:165,t:'共享契约'},{x:5,y:150,w:165,t:'真实边界测试'},{x:350,y:25,w:165,t:'内存 fake'},{x:350,y:150,w:165,t:'真实存储实现'}].map(n=><g key={n.t}><rect x={n.x} y={n.y} width={n.w} height="50" rx="9"/><text x={n.x+n.w/2} y={n.y+30} textAnchor="middle">{n.t}</text></g>)}</svg><div className="d192-actions"><button aria-pressed={selected==='fake'} onClick={()=>setSelected('fake')}>追踪 fake 证据</button><button aria-pressed={selected==='real'} onClick={()=>setSelected('real')}>追踪真实实现证据</button></div><div role="status"><p>{selected==='fake'?'fake':'真实实现'} 的证据：{(selected==='fake'?covered.fake:covered.real).join('、') || '没有连接测试'}</p><p>{selected==='fake' ? '即使共享契约全通过，fake 仍不承担真实隔离、驱动和网络事实。' : integration ? '已为真实边界安排测试；图中连接只是测试设计，不代表真实测试已执行通过。' : '缺口：需要在真实服务上补隔离、驱动错误与取消测试。'}</p></div></>;
}
function Steps() {
  const [step,setStep]=useState(0), [assertion,setAssertion]=useState<'value'|'calls'>('value');
  const observations=evaluateAssertions(assertion);
  const stages=['先写可观察契约','构造可复现的并发交错','对两个实现运行同一断言','为真实服务增加专属边界测试'];
  return <><h4>分步：把“测试绿了”变成可解释的证据</h4><ol className="d192-steps">{stages.map((name,i)=><li key={name} aria-current={i===step?'step':undefined}>{name}{i<step?' ✓':''}</li>)}</ol><label>你要断言什么？<select value={assertion} onChange={e=>{setAssertion(e.target.value as 'value'|'calls');setStep(0);}}><option value="value">成功写入必须保留增量；旧版本返回冲突</option><option value="calls">私有 save 函数恰好调用两次</option></select></label><div className="d192-feedback" role="status">{step===0 ? '把输入、输出、错误写入契约。函数调用次数不能说明并发写是否丢失。' : step===1 ? '让 A、B 都先读 v1，再提交 A，最后提交 B。固定交错避免只测到串行成功。' : step===2 ? assertion==='value' ? '执行结果：map 的 B 覆盖旧值却成功，违反契约；版本模型的 B 返回冲突，符合契约。失败行为也是承诺的一部分。' : '两者都调用 save 两次，断言全绿，却没检查丢失更新。回到第一步改用可观察契约。' : '在固定版本的真实服务运行事务隔离、错误映射、取消测试，记录服务/驱动版本。共享契约只覆盖它明确定义的承诺。'}</div>{step>=2 && <div className="d192-columns">{Object.entries(observations).map(([name,result])=><article className="d192-lane" key={name}><h4>{name==='fake'?'map fake':'版本参考模型'}</h4><p>写入尝试 {result.attempts} 次 · 成功 {result.successes} · 冲突 {result.conflicts} · 最终值 {result.value}</p><strong>{result.passed?'当前断言通过':'当前断言失败'}</strong></article>)}</div>}<div className="d192-actions"><button disabled={step===3} onClick={()=>setStep(step+1)}>执行下一步</button><button disabled={!step} onClick={()=>setStep(step-1)}>回看上一步</button><button onClick={()=>setStep(0)}>从契约开始</button></div></>;
}
function Try() {
  const [choice,setChoice]=useState(''), [reason,setReason]=useState(''), [submitted,setSubmitted]=useState(false);
  return <><h4>新情境：Redis 驱动升级后的过期承诺</h4><p>验证码仓储承诺“过期后读取返回未找到”。map fake 不模拟时钟，现有测试只检查写入后立即读取，全部通过。升级驱动后，你准备放行吗？</p><label>选择下一步<select disabled={submitted} value={choice} onChange={e=>setChoice(e.target.value)}><option value="">作出判断后再揭晓</option><option value="ship">直接放行：接口没变且 fake 全绿</option><option value="contract">只给 fake 加时钟，过期用例通过即可放行</option><option value="real">补过期契约，同时在固定版本的真实服务验证驱动与过期行为</option></select></label><label>你的理由<textarea disabled={submitted} value={reason} onChange={e=>setReason(e.target.value)} placeholder="现有测试证明了什么？还缺哪条证据？"/></label><button disabled={!choice || !reason.trim() || submitted} onClick={()=>setSubmitted(true)}>提交判断与理由</button>{submitted && <div className="d192-feedback" role="status"><strong>{choice==='real'?'判断符合当前证据边界。':'这个方案还留有证据缺口。'}</strong><p>{choice==='ship'?'立即读成功没有执行过期后的路径，不能支持过期承诺。':choice==='contract'?'fake 的时钟只能验证它自己实现的规则，无法验证升级后的驱动与真实服务交互。':'共享过期契约约束两个实现；真实测试继续验证时钟、驱动错误映射与服务版本行为。'}</p><p>你的理由：{reason}</p><p>自查理由是否同时提到“未覆盖过期”与“fake 无法证明真实驱动”。系统只核对选择，不自动评定文字推理。此练习不写入掌握记录。</p><button onClick={()=>{setSubmitted(false);setChoice('');setReason('');}}>清空后再练（已看过反馈）</button></div>}</>;
}
export function Help({mode}: {mode: string}) {
  return <section className="d192 d192-help" data-testid="delivery-help-192">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Try/>}</section>;
}


