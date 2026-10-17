import {useMemo,useState} from 'react';
import {preset,scenarioNames,trace,verdict,type Input,type ReadState,type Scenario} from './model';
import './style.css';

type Choice='both'|'different'|'reject';
const choices:Record<Choice,string>={both:'两边完整接受',different:'只读 N 误接受，N+1 拒绝',reject:'两边都拒绝'};
function outcome(c:Input):Choice {
  const n=trace(c,'n').at(-1)!,p=trace(c,'probe').at(-1)!;
  return n.result==='rejected'&&p.result==='rejected'?'reject':n.result==='accepted'&&n.read<c.bytes?'different':'both';
}
function Prediction({choice,reason,onChoice,onReason}:{choice:Choice;reason:string;onChoice:(v:Choice)=>void;onReason:(v:string)=>void}) {
  return <div className="sec184-prediction"><label>预测两边最终结果<select value={choice} onChange={e=>onChoice(e.target.value as Choice)}>{Object.entries(choices).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>预测理由<textarea rows={2} placeholder="哪一次读取或哪一道预算能提供证据？" value={reason} onChange={e=>onReason(e.target.value)}/></label></div>;
}
function NumberChoice({label,value,onChange,max=12}:{label:string;value:number;onChange:(n:number)=>void;max?:number}) {
  return <label>{label}<select value={value} onChange={e=>onChange(Number(e.target.value))}>{Array.from({length:max+1},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>;
}
function View({c,n,p,index}:{c:Input;n:ReadState;p:ReadState;index:number}) {
  return <div data-testid="live-model" data-state={JSON.stringify({index,input:c,n,p})}><div className="sec184-compare">{([{name:'只读 N 字节',s:n},{name:'最多读 N+1 字节',s:p}]).map(({name,s})=><article key={name} data-result={s.result}><h4>{name}</h4><strong>{verdict(s,c)}</strong><div className="sec184-cells" aria-label={'已读取 '+s.read+' 个字节，共 '+c.bytes+' 字节'}>{Array.from({length:c.bytes},(_,i)=><span key={i} data-read={i<s.read} data-probe={i===c.limit}>{i+1}</span>)}{c.bytes===0&&<span>空</span>}</div><p>上传实际读取：{s.read} / 上限 {c.limit}</p>{c.archive&&<><p>累计解压：{s.expanded} / 上限 {c.expandedLimit}</p><meter className="sec184-meter" min={0} max={Math.max(c.expandedLimit+1,1)} value={s.expanded} aria-label={name+'的累计解压字节'}/><p>已检查条目：{s.inspected} / 上限 {c.entryLimit}</p></>}<p>业务获得：{s.result==='pending'?'等待完整校验':s.result==='rejected'?'0（丢弃暂存）':s.returned+' 字节输入'}</p><p role="status">{s.note}</p></article>)}</div></div>;
}
function Workbench({guided=false}:{guided?:boolean}) {
  const initialScenario:Scenario=guided?'exact':'over';
  const [scenario,setScenario]=useState<Scenario>(initialScenario);
  const [c,setC]=useState<Input>(()=>preset(initialScenario));
  const [index,setIndex]=useState(0);
  const [choice,setChoice]=useState<Choice>('both');
  const [reason,setReason]=useState('');
  const [submitted,setSubmitted]=useState<{choice:Choice;reason:string}|null>(null);
  const n=useMemo(()=>trace(c,'n'),[c]),p=useMemo(()=>trace(c,'probe'),[c]);
  const last=Math.max(n.length,p.length)-1,complete=index===last;
  const change=(next:Input)=>{setC(next);setIndex(0);setReason('');setSubmitted(null);};
  return <div><p>{guided?'分步任务：4 字节输入恰好等于上限。读满 N 后还需哪一个证据？随后改成 5 字节，比较同一检查为何改变结果。':'同一条输入流，比较只读 N 与探测 N+1。数字方块是源流中的字节，蓝色表示已经消费；橙框是可能存在的额外字节。'}</p><div className="sec184-controls"><label>输入情境<select value={scenario} onChange={e=>{const s=e.target.value as Scenario;setScenario(s);change(preset(s));}}>{Object.entries(scenarioNames).map(([s,t])=><option value={s} key={s}>{t}</option>)}</select></label><NumberChoice label="上传上限 N（字节）" value={c.limit} onChange={limit=>change({...c,limit})}/><label>Content-Length 预检<select value={c.declared===null?'unknown':String(c.declared)} onChange={e=>change({...c,declared:e.target.value==='unknown'?null:Number(e.target.value)})}><option value="unknown">未知 / 未提供</option>{Array.from({length:13},(_,i)=><option key={i} value={i}>声称 {i} 字节</option>)}</select></label>{c.archive&&<><NumberChoice label="解压总量上限（字节）" value={c.expandedLimit} onChange={expandedLimit=>change({...c,expandedLimit})}/><NumberChoice label="归档条目数上限" value={c.entryLimit} onChange={entryLimit=>change({...c,entryLimit})} max={4}/></>}</div>{c.archive&&<p>归档清单（教学已知输入）：{c.archive.map(e=>e.name+' / '+e.bytes+' 字节'+(e.link?' / 链接':'')).join('；')}</p>}
  {submitted?<p>已记录：{choices[submitted.choice]}。理由：{submitted.reason}</p>:<Prediction choice={choice} reason={reason} onChoice={setChoice} onReason={setReason}/>}
  <div className="sec184-actions"><button data-security-action="step" disabled={complete||(!submitted&&!reason.trim())} onClick={()=>{if(!submitted)setSubmitted({choice,reason:reason.trim()});setIndex(index+1);}}>{index===0?'提交预测并单步':'单步读取 / 检查'}</button><button data-security-action="back" disabled={index===0} onClick={()=>setIndex(index-1)}>回退一步</button><button data-security-action="reset" onClick={()=>change(c)}>重置实验</button></div><p>步骤 {index} / {last}。每步最多消费一个上传或解压字节；两边已结束的读取器保持终态。</p>
  <View c={c} n={n[Math.min(index,n.length-1)]} p={p[Math.min(index,p.length-1)]} index={index}/>
  {complete&&submitted&&<p className="sec184-feedback" role="status">{submitted.choice===outcome(c)?'预测与本次证据一致。':'需要修正预测。'}实际为：{choices[outcome(c)]}。{outcome(c)==='different'?'右边在额外字节出现时拒绝；左边的 EOF 来自限额，不是源流结束。把情境切换到恰好 4 字节，检验是否仍应拒绝。':outcome(c)==='reject'?'依据各侧最后一条证据定位最先失败的边界；提高上传限额不会自动解除路径、条目或解压限制。':'完整接受只适用于本次配置；等于 N 可以合法，通过真实 EOF 与超额探测区分。'}</p>}</div>;
}
export default function Lesson184Lab(){return <section className="sec184" data-testid="security-lab-184"><h3>两道字节预算实验台</h3><Workbench/><p className="sec184-boundary">模型边界：小整数代表字节，每步读取一个字节，不实现网络协议、真实压缩、CPU/时间限制或安全落盘。Content-Length 与源流是刻意解耦的教学输入，并非模拟 HTTP 报文定界。字节输入总量由教学视图知道，读取器只能依靠读取获得证据。归档要求完整输入，并模拟预算、路径和链接拒绝；生产还需格式解析、文件系统隔离与竞态防护。探索不写入掌握记录。</p></section>;}

function Example(){
  const [packages,setPackages]=useState(5),[capacity,setCapacity]=useState(4),[ran,setRan]=useState(false);
  const c={...preset('over'),bytes:packages,limit:capacity};
  const n=trace(c,'n').at(-1)!,p=trace(c,'probe').at(-1)!;
  return <div><p>把上传流想成一列待验收包裹。仓库容量为 N，只把门关上并不能证明门外没有第 N+1 件；检查员可以临时探测一件，超额就拒收整单。临时探测不等于额外入库。</p><div className="sec184-controls"><NumberChoice label="队列包裹数" value={packages} onChange={v=>{setPackages(v);setRan(false);}} max={8}/><NumberChoice label="仓库容量" value={capacity} onChange={v=>{setCapacity(v);setRan(false);}} max={8}/></div><div className="sec184-actions"><button onClick={()=>setRan(true)}>让两位检查员验收</button><button onClick={()=>{setPackages(5);setCapacity(4);setRan(false);}}>恢复包裹基线</button></div>{ran?<View c={c} n={n} p={p} index={Math.max(trace(c,'n').length,trace(c,'probe').length)-1}/>:<div data-testid="live-model" data-state={JSON.stringify({packages,capacity,ran})}>待验收队列：{'□ '.repeat(packages)||'空队列'} · 可入库容量 {capacity}</div>}<p>映射：包裹数 → 字节数，库容 → N，探测下一件或确认队尾 → N+1 或真实 EOF。类比不代表可将已写出的文件自动撤回；实现中需暂存后提交。</p></div>;
}
function Diagram(){
  const [upload,setUpload]=useState(4),[expanded,setExpanded]=useState(8),[path,setPath]=useState('report.txt');
  const c:Input={...preset('bomb'),limit:upload,expandedLimit:expanded,archive:[{name:path,bytes:10}]};
  const states=trace(c,'probe'),final=states.at(-1)!;
  const reachedEntry=states.some(s=>s.phase==='entry'),reachedExpand=states.some(s=>s.phase==='expand');
  return <div><p>改变闸门预算，观察拒绝路径迁移。箭头表示只有前一道通过，后一道才会消费资源；上传大小与解压大小各有自己的计数边。</p><div className="sec184-controls"><NumberChoice label="图中上传预算" value={upload} onChange={setUpload}/><NumberChoice label="图中解压预算" value={expanded} onChange={setExpanded}/><label>图中归档路径<select value={path} onChange={e=>setPath(e.target.value)}><option>report.txt</option><option>../secret</option></select></label></div><div data-testid="live-model" data-state={JSON.stringify({input:c,reachedEntry,reachedExpand,final})}><div className="sec184-flow"><div className="sec184-gate">源流：2 字节压缩内容 → {path} 解压 10 字节</div><span className="sec184-arrow" aria-hidden="true">↓ 实际上传计数</span><div className="sec184-gate" data-pass={reachedEntry}>上传闸门：消费 {final.read} 字节 / 上限 {upload} → {reachedEntry?'通过':'拒绝；后续未执行'}</div><span className="sec184-arrow" aria-hidden="true">↓ 通过后才能解析条目</span><div className="sec184-gate" data-pass={!reachedEntry||reachedExpand}>路径闸门：{path} → {!reachedEntry?'未到达':reachedExpand?'通过':'拒绝；解压未执行'}</div><span className="sec184-arrow" aria-hidden="true">↓ 实际解压计数</span><div className="sec184-gate" data-pass={!reachedExpand||final.result==='accepted'}>解压闸门：消费 {final.expanded} 字节 / 上限 {expanded} → {!reachedExpand?'未到达':final.result==='accepted'?'通过':'拒绝'}</div></div><p role="status">{final.note}</p></div><p>尝试把上传预算从 4 提高到 12：解压仍超额。只提高解压预算到 10 后，再切换 ../secret，解释为什么字节预算都够仍拒绝。</p></div>;
}
const challenges:{title:string;c:Input;explanation:string}[]=[
  {title:'音频流：未知长度，实际 6 字节，上传上限 6。',c:{...preset('exact'),bytes:6,limit:6},explanation:'真实 EOF 在第 6 字节之后出现，没有第 7 字节。等于上限可以成功。'},
  {title:'导入备份：上传 2 字节，上限 4；解压 9 字节，上限 8，路径安全且只有 1 个条目。',c:{...preset('bomb'),archive:[{name:'backup.json',bytes:9}]},explanation:'两边都在第 9 个解压字节拒绝。上传预算通过不能代替解压预算。'},
  {title:'禁收内容的端点：未知长度，实际 1 字节，上传上限 0。',c:{...preset('over'),bytes:1,limit:0},explanation:'只读 N 直接得到限额 EOF，误报空输入成功；N+1 读到一个字节即可证明超额。'}
];
function Try(){
  const [index,setIndex]=useState(0),[choice,setChoice]=useState<Choice>('both'),[reason,setReason]=useState(''),[submitted,setSubmitted]=useState(false);
  const task=challenges[index];
  return <div><p>{task.title}</p><p>先给出两种读取方式的最终结果与理由；提交之前不显示执行结果。</p><Prediction choice={choice} reason={reason} onChoice={v=>{setChoice(v);setSubmitted(false);}} onReason={v=>{setReason(v);setSubmitted(false);}}/><div className="sec184-actions"><button disabled={!reason.trim()||submitted} onClick={()=>setSubmitted(true)}>验证新情境</button><button onClick={()=>{setIndex((index+1)%challenges.length);setReason('');setSubmitted(false);}}>换一个情境</button></div><div data-testid="live-model" data-state={JSON.stringify({scenario:index,submitted,result:submitted?outcome(task.c):null})}>{submitted&&<p className="sec184-feedback" role="status">{choice===outcome(task.c)?'判断一致。':'需要修正。'}{choices[outcome(task.c)]}。{task.explanation}你的理由：{reason}</p>}</div><p className="sec184-boundary">新情境验证与上方探索状态独立，不计入测验和掌握进度。</p></div>;
}
export function Lesson184Help({mode}:{mode:'example'|'diagram'|'steps'|'try'}){return <section className="sec184" data-testid="security-help-184" key={mode}>{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Workbench guided/>:<Try/>}</section>;}


