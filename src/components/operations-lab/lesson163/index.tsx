import {useState} from 'react';
import {advance, boundary, initial, names, outcome, predictions, rss, runRounds, type Action, type Config, type Prediction, type State, type Workload} from './model';
import './styles.css';

function Board({state, coverage = 'rss'}: {state: State; coverage?: string}) {
  const buckets = [{key:'live', name:'Go 活跃对象', value:state.live}, {key:'garbage', name:'不可达待 GC', value:state.garbage}, {key:'idle', name:'空闲驻留页', value:state.idle}, {key:'stacks', name:'goroutine 栈', value:state.stacks}, {key:'native', name:'cgo 分配', value:state.native}, {key:'mapped', name:'文件映射', value:state.mapped}];
  return <div className="ops163-board" data-testid="live-model" data-state={JSON.stringify({...state, rss:rss(state)})}>
    <div className="ops163-metrics"><strong>RSS {rss(state)} MiB</strong><span>live heap {state.live} MiB</span><span>累计 Go 分配 {state.allocated} MiB</span><span>goroutine {state.goroutines} 个</span></div>
    <div className="ops163-buckets" aria-label="进程内存分桶图">{buckets.map(b => <div key={b.key} className={coverage === 'heap' && b.key !== 'live' ? 'ops163-dim' : ''}><span>{b.name}</span><div className="ops163-track"><i style={{width:(Math.min(100, b.value / 1000 * 100))+'%'}}/></div><b>{b.value} MiB</b></div>)}</div>
    <small>各条使用同一尺度：满格 1000 MiB。图上桶代表可区分来源；不代表真实地址布局。</small>
    <p className="ops163-change" aria-live="polite">{state.last}</p>
    <div className="ops163-table"><table><caption>相同请求量、GC 后取样；第 0 轮是基线（MiB）</caption><thead><tr><th>轮次</th><th>live heap</th><th>RSS</th><th>栈</th><th>cgo</th></tr></thead><tbody>{state.samples.map(s=><tr key={s.round}><td>{s.round}</td><td>{s.live}</td><td>{s.rss}</td><td>{s.stacks}</td><td>{s.native}</td></tr>)}</tbody></table></div>
  </div>;
}

export default function Lab() {
  const [config, setConfig] = useState<Config>({workload:'churn',allocation:300});
  const [history, setHistory] = useState<State[]>([initial()]);
  const [prediction, setPrediction] = useState<Prediction | ''>('');
  const [reason, setReason] = useState('');
  const state = history[history.length - 1];
  const started = history.length > 1, done = state.round >= 3 && !state.waitingGC;
  const ready = !!prediction && !!reason.trim();
  function reset() {setHistory([initial()]);setPrediction('');setReason('');}
  function configure(patch: Partial<Config>) {setConfig({...config,...patch});reset();}
  function act(action: Action) {setHistory([...history, advance(state, config, action)]);}
  return <section className="ops163" data-testid="operations-lab-163"><h3>163 · RSS 高，谁还活着？谁只是占着页？</h3>
    <p>控制每轮请求量，连续采样三轮。先区分累计分配、GC 后活跃对象与进程驻留内存，再寻找增长来源。</p>
    <div className="ops163-controls"><label>工作负载行为<select value={config.workload} onChange={e=>configure({workload:e.target.value as Workload})}>{Object.entries(names).map(([key,name])=><option value={key} key={key}>{name}</option>)}</select></label><label>每轮 Go 分配量 <input type="range" min="100" max="600" step="50" value={config.allocation} onChange={e=>configure({allocation:Number(e.target.value)})}/><output>{config.allocation} MiB</output></label></div>
    <fieldset disabled={started}><legend>预测三轮 GC 后的趋势</legend><label>我的预测<select value={prediction} onChange={e=>setPrediction(e.target.value as Prediction)}><option value="">请选择趋势</option>{Object.entries(predictions).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><label>预测理由<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="哪些对象还被引用？哪些来源不属于 Go 活跃堆？" rows={2}/></label></fieldset>
    <div className="ops163-actions"><button data-ops-action="back" disabled={!started} onClick={()=>setHistory(history.slice(0,-1))}>回退一步</button><button data-ops-action="step" disabled={!ready || done} onClick={()=>act(state.waitingGC?'gc':'load')}>{state.waitingGC?'执行本轮 GC':'执行下一轮请求'}</button><button disabled={!ready || !state.idle} onClick={()=>act('release')}>模拟归还空闲页</button><button data-ops-action="reset" onClick={reset}>重置实验</button></div>
    {!ready && <p>选择趋势并填写理由后执行。修改工作负载或分配量会重开本轮。</p>}
    <p>执行位置：第 {state.round} / 3 轮 · {state.waitingGC?'请求结束，等待 GC 后取样':'GC 后观察点'}。回退仅恢复教学快照。</p>
    <Board state={state}/>
    {done && <p className="ops163-feedback" aria-live="polite">{prediction===outcome(config)?'预测与三轮证据一致。':'预测与证据不同，请对照 GC 后样本修正解释。'}{predictions[outcome(config)]}。你的理由：{reason}。{config.workload==='retained'?'GC 不能回收被引用的对象；继续查持有链，并验证缓存是否有界。':config.workload==='native'?'Go heap profile 无法解释全部 cgo 分配，需外部分配工具。':config.workload==='stacks'?'goroutine 数与栈同步增长，检查阻塞与退出路径。':'累计分配持续增加，但活跃堆稳定；不能把 RSS 高位直接定性为泄漏。'}</p>}
    <p className="ops163-boundary">{boundary}</p>
  </section>;
}

function Example() {
  const config: Config = {workload:'churn',allocation:300};
  const [history,setHistory] = useState<State[]>([initial()]);
  const s=history[history.length-1], step=history.length-1;
  const actions: Action[]=['load','gc','release'];
  return <><h3>例子：用完的工位与仍租着的房间</h3><p>活跃对象像正在使用的工位；GC 清理无人的工位，空房间仍可能租着。退租才减少驻留占用。类比只解释“回收对象”与“归还页”的区别。</p><Board state={s}/><div className="ops163-actions"><button disabled={!step} onClick={()=>setHistory(history.slice(0,-1))}>回看例子</button><button disabled={step===3} onClick={()=>setHistory([...history,advance(s,config,actions[step])])}>{['接待一批请求','清理无人使用的工位','模拟退还空房间','例子结束'][step]}</button><button onClick={()=>setHistory([initial()])}>重看例子</button></div><p>观察：第二步 live heap 回到 200，RSS 仍为 900；第三步 RSS 降至 300。现实归还时机由运行时与 OS 决定。</p></>;
}
function Diagram() {
  const [coverage,setCoverage] = useState('heap');
  const [workload,setWorkload] = useState<Workload>('native');
  const s=runRounds({workload,allocation:300});
  return <><h3>图解：测量工具照亮哪一层？</h3><label>观察对象<select value={workload} onChange={e=>setWorkload(e.target.value as Workload)}>{Object.entries(names).map(([k,n])=><option key={k} value={k}>{n}</option>)}</select></label><label>测量视角<select value={coverage} onChange={e=>setCoverage(e.target.value)}><option value="heap">GC 后 heap profile（inuse_space）</option><option value="rss">进程 RSS 分桶</option></select></label><div className="ops163-flow">请求 → Go 分配 → [仍被引用：活跃堆] ／ [不可达：GC → 空闲页 → OS]<br/>进程 RSS ← Go 堆页 ＋ goroutine 栈 ＋ cgo ＋ 映射</div><Board state={s} coverage={coverage}/><p>{coverage==='heap'?'高亮的是 Go 活跃对象桶。这里用采样 profile 的理想化总量表示；真实 heap profile 有采样误差，不能覆盖全部 cgo、映射或 goroutine 栈。':'所有桶共同影响 RSS。累计分配是期间流量，不能加进此刻的 RSS。'}</p></>;
}
function Steps() {
  const [step,setStep]=useState(0);
  const config: Config={workload:'retained',allocation:300};
  const states=[initial()];
  for (let i=0;i<6;i++) states.push(advance(states[i],config,i%2?'gc':'load'));
  const notes=['先保留基线：负载阶段一致，记录 GC 后 live heap 与 RSS。','同样请求分配 300，其中 60 继续被业务引用；不要把全部分配都当保留。','完成 GC 后取样，确认 260 MiB 仍存活；一次上升还不能证明无界。','重复同量请求，保持比较条件一致。','再次 GC：活跃对象到 320 MiB，而 RSS 可能仍不变。','再补一轮负载，检验趋势能否复现。','三轮 live heap 为 260、320、380；转向 profile 对比和引用持有路径，并检查缓存上限。'];
  return <><h3>分步：把“泄漏猜测”变成可核查证据</h3><p>第 {step+1} / 7 步：{notes[step]}</p><Board state={states[step]}/><div className="ops163-actions"><button disabled={!step} onClick={()=>setStep(step-1)}>上一步证据</button><button disabled={step===6} onClick={()=>setStep(step+1)}>收集下一步证据</button><button onClick={()=>setStep(0)}>重走诊断</button></div></>;
}
function Try() {
  const [choice,setChoice]=useState(''),[reason,setReason]=useState(''),[revealed,setRevealed]=useState(false);
  const s=runRounds({workload:'native',allocation:450});
  return <><h3>动手诊断：heap profile 找不到增长</h3><p>新样本：同量负载、GC 后 live heap 200 → 200 → 200 → 200 MiB，RSS 900 → 940 → 980 → 1020 MiB；goroutine 数和栈均稳定。堆 profile 无明显差异。选择下一步取证方向并解释依据。</p><label>下一步取证<select disabled={revealed} value={choice} onChange={e=>setChoice(e.target.value)}><option value="">请选择</option><option value="gc">继续强制 GC，证明 Go 对象泄漏</option><option value="native">核对 cgo 分配与映射等外部来源</option><option value="stack">只查 goroutine 栈增长</option></select></label><label>诊断依据<textarea rows={2} disabled={revealed} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="ops163-actions"><button disabled={!choice||!reason.trim()||revealed} onClick={()=>setRevealed(true)}>提交判断并取证</button><button onClick={()=>{setChoice('');setReason('');setRevealed(false);}}>重新诊断</button></div>{revealed&&<><Board state={s}/><p className="ops163-feedback" aria-live="polite">{choice==='native'?'方向与证据相符。':'当前选择无法解释 RSS 与 live heap 的分离。'}本场景补充测量显示 cgo 40 → 80 → 120 → 160 MiB，映射保持 20 MiB；应继续定位外部分配与释放路径，不能仅凭前三项指标就直接断言 cgo 泄漏。你的依据：{reason}。</p></>}<p>这是辅助诊断练习，不写入独立掌握记录。</p></>;
}
export function Help({mode}:{mode:string}) {return <section className="ops163 ops163-help" data-testid="operations-help-163">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Try/>}<p className="ops163-boundary">{boundary}</p></section>;}
