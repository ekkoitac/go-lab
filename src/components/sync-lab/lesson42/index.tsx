import {useState} from 'react';
import {advance, autoRun, complete, initialState, readyTasks, type State, type TaskId} from './model';
import './style.css';

function Timeline({state}:{state:State}) {
  return <div className="sync42-timeline" aria-label="计算时间线"><div className="sync42-key">■ 计算　◷ I/O 等待　· 未获分配或已完成；同一列表示同一格</div><div className="sync42-scroll"><table><caption>累计 {state.tick} 格 · {state.units} 个执行单元</caption><thead><tr><th scope="col">任务</th>{state.timeline.map(s=><th scope="col" key={s.tick}>{s.tick}</th>)}</tr></thead><tbody>{state.tasks.map(t=><tr key={t.id}><th scope="row">{t.id}</th>{state.timeline.map(s=><td key={s.tick} className={s.running.includes(t.id)?'sync42-running':s.waiting.includes(t.id)?'sync42-waiting':''} aria-label={`任务 ${t.id} 第 ${s.tick} 格：${s.running.includes(t.id)?'计算':s.waiting.includes(t.id)?'I/O 等待':'未计算'}`}>{s.running.includes(t.id)?'■':s.waiting.includes(t.id)?'◷':'·'}</td>)}</tr>)}</tbody></table></div></div>;
}
export default function Lab() {
  const [history,setHistory]=useState<State[]>([initialState()]);
  const state=history.at(-1)!;
  const [first,setFirst]=useState<string>('A');
  const [second,setSecond]=useState<string>('B');
  const [prediction,setPrediction]=useState('');
  const [result,setResult]=useState('');
  const ready=readyTasks(state);
  const selected=[first,...(state.units===2?[second]:[])].filter(Boolean) as TaskId[];
  const valid=new Set(selected).size===selected.length && selected.every(id=>ready.includes(id));
  const reset=(units=state.units,io=state.io)=>{setHistory([initialState(units,io)]);setFirst('A');setSecond('B');setResult('');setPrediction('');};
  function step(){
    const next=advance(state,selected);
    setHistory([...history,next]);
    setResult(`你的预测：${prediction} 个；实际：${selected.length} 个同时计算。${Number(prediction)===selected.length?'相符。':'请数同一列的计算方格，I/O 等待不算计算。'}`);
    setPrediction('');
    const nextReady=readyTasks(next);setFirst(nextReady[0]??'');setSecond(nextReady[1]??'');
  }
  return <section className="sync42" data-testid="lesson42-lab"><h3>你来排下一格：交错，还是同时？</h3><p>任务 A、B 各做 3 格计算。将任务分配给执行单元，先预测，再推进一格。</p><div className="sync42-controls"><label>执行单元 <select aria-label="执行单元" value={state.units} onChange={e=>reset(Number(e.target.value) as 1|2)}><option value="1">1 个</option><option value="2">2 个</option></select></label><label><input type="checkbox" checked={state.io} onChange={e=>reset(state.units,e.target.checked)}/>每个任务算完第 1 格后等待 I/O 两格</label></div><p className="sync42-note">改变条件会重新开始。I/O 等待与计算可重叠；可回退后改派任务，比较另一条路径。</p><div data-testid="live-model" data-state={JSON.stringify(state)} className="sync42-tasks">{state.tasks.map(t=><div key={t.id} className="sync42-task"><strong>任务 {t.id}</strong><progress max={3} value={t.work} aria-label={`任务 ${t.id} 计算进度`}/><span>{t.work}/3 格 · {t.work===3?'完成':t.wait>0?`等待 I/O：${t.wait} 格`:'就绪'}</span></div>)}</div><div className="sync42-controls">{Array.from({length:state.units},(_,i)=><label key={i}>执行单元 {i+1}<select aria-label={`执行单元 ${i+1} 分配`} value={i===0?first:second} onChange={e=>(i===0?setFirst:setSecond)(e.target.value)} disabled={complete(state)}><option value="">空闲</option>{ready.map(id=><option key={id} value={id}>任务 {id}</option>)}</select></label>)}<label>预测下一格同时计算几个任务？<select aria-label="预测同时计算数量" value={prediction} onChange={e=>setPrediction(e.target.value)} disabled={complete(state)}><option value="">先预测</option>{[0,1,2].map(n=><option key={n} value={n}>{n} 个</option>)}</select></label></div>{!valid&&<p role="alert">同一任务不能分给两个执行单元，请修改分配。</p>}<div className="sync42-controls"><button onClick={step} disabled={!valid||prediction===''||complete(state)}>提交预测并推进一格</button><button disabled={history.length===1} onClick={()=>{const previous=history.at(-2)!;setHistory(history.slice(0,-1));const ids=readyTasks(previous);setFirst(ids[0]??'');setSecond(ids[1]??'');setPrediction('');setResult('已回退，可改派任务再验证。');}}>回退一格</button><button onClick={()=>reset()}>重置</button></div><div className="sync42-feedback" aria-live="polite"><p>{result}</p><p>{state.feedback}</p>{complete(state)&&<p>两项任务已完成。时间线里是否有同列两块计算？资源充足仍需实际分配，才出现并行。</p>}</div><Timeline state={state}/><p className="sync42-note">教学模型：每格计算等长、无调度开销，I/O 等待固定。格数不代表 Go 实际耗时或加速承诺；真实调度由运行时决定。GOMAXPROCS 限制同时执行 Go 代码的线程数量，不限制 goroutine 总数。</p></section>;
}

export function Help({mode}:{mode:string}) {
  const [units,setUnits]=useState<1|2>(1);
  const [step,setStep]=useState(0);
  const [choice,setChoice]=useState('');
  const [submitted,setSubmitted]=useState(false);
  const [round,setRound]=useState(0);
  const challenge=round%3===0?advance(initialState(2,true),['A']):round%3===1?initialState(2):advance(initialState(2,true),['A','B']);
  const challengeNext=advance(challenge,readyTasks(challenge));
  const actual=readyTasks(challenge).length;
  const stepped=step===0?initialState():step===1?advance(initialState(),['A']):step===2?(['A','B','A','B'] as TaskId[]).reduce((s,id)=>advance(s,[id]),initialState()):advance(initialState(2),['A','B']);
  const steps=['先看任务：A 与 B 都能独立推进，因此可以组织并发。','再看资源：只有一个执行单元时，一格只能计算一个任务。','安排 A → B → A → B，任务交错推进；同一列仍只有一个计算方格。','增加到两个执行单元，并将 A、B 分别分配，才会在一列出现两个计算方格。'];
  return <section className="sync42" data-testid="lesson42-help"><h3>{mode==='example'?'同一份计算，改变执行资源':mode==='diagram'?'把任务、资源与现象连起来':mode==='steps'?'四步辨认并发与并行':'新条件：空着的单元能做什么？'}</h3>{mode==='example'?<><p>两位厨师各有 3 格切菜工作，不等待锅具。任务工作量固定，只改变执行单元。</p><div className="sync42-controls"><button aria-pressed={units===1} onClick={()=>setUnits(1)}>一位厨师</button><button aria-pressed={units===2} onClick={()=>setUnits(2)}>两位厨师</button></div><Timeline state={autoRun(units)}/><p>{units===1?'A 做完才做 B，是本例所选的串行调度；也可以改成 A、B 交错，但不会有同列两块计算。':'A 与 B 在同一列各做一格，出现计算并行。理想模型从 6 格降到 3 格。'}</p><p className="sync42-note">这是带解释的示例，不计作独立掌握；现实速度还受通信、争用与调度开销影响。</p></>:mode==='diagram'?<><div className="sync42-map"><div><strong>任务结构</strong><p>A ↔ B：可独立推进</p><span>组织并发工作</span></div><b aria-hidden="true">↓ 交给调度</b><div><strong>执行资源</strong><p>1 个单元 → 每格最多算 1 个</p><p>2 个单元 → 每格最多算 2 个</p></div><b aria-hidden="true">↓ 看实际时间线</b><div><strong>观察证据</strong><p>A、B 分列计算 → 交错</p><p>A、B 同列计算 → 并行</p></div></div><p>增加 goroutine 只增加任务；“有两个资源”也不保证它们始终被同时使用。等待 I/O 的任务不占本图的计算单元。</p></>:mode==='steps'?<><ol className="sync42-steps">{steps.slice(0,step+1).map((text,i)=><li key={text} aria-current={i===step?'step':undefined}>{text}</li>)}</ol><Timeline state={stepped}/><div className="sync42-controls"><button disabled={step===0} onClick={()=>setStep(step-1)}>上一步</button><button disabled={step===3} onClick={()=>setStep(step+1)}>下一步</button></div><p className="sync42-note">辨认顺序：独立任务 → 执行资源 → 实际分配 → 同一格的工作。</p></>:<><p>{round%3===0?'有 2 个执行单元，A 尚需等待 I/O 两格，B 已就绪。下一格把所有可运行任务分配出去，会有几个任务计算？':round%3===1?'有 2 个执行单元，A、B 都已就绪且工作尚未完成。下一格把所有可运行任务分配出去，会有几个任务计算？':'有 2 个执行单元，A、B 都还需等待 I/O 两格。下一格把所有可运行任务分配出去，会有几个任务计算？'}</p><label>提交前先作判断<select aria-label="新情境预测" value={choice} disabled={submitted} onChange={e=>setChoice(e.target.value)}><option value="">选择数量</option><option value="0">0 个</option><option value="1">1 个</option><option value="2">2 个</option></select></label><div className="sync42-controls"><button disabled={!choice||submitted} onClick={()=>setSubmitted(true)}>提交判断</button><button onClick={()=>{setRound(round+1);setChoice('');setSubmitted(false);}}>换一组条件</button></div>{submitted&&<><p className="sync42-feedback" role="status">{Number(choice)===actual?'判断正确。':`需要修正：实际是 ${actual} 个。`}{round%3===0?'只有 B 就绪；A 的 I/O 等待不能用空闲计算单元直接消除。第二个单元因此空闲。':round%3===1?'两个任务就绪且资源够用，分别分配后这一格出现并行。':'两个任务都在等待，计算单元空闲；时间推进只让等待各减少一格。'}看时间线最后一列核对本次结果；此作答与示例探索分开。</p><Timeline state={challengeNext}/></>}</>}</section>;
}
