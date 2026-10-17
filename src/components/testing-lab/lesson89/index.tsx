import {useState} from 'react';
import {initialConfig, inspect, firstFailure, labels, source, tools, values, type Config, type Tool, type Assertion} from './model';
import './style.css';

function Pipeline({transfer=false}:{transfer?:boolean}) {
  const threshold=transfer?50:100;
  const [config,setConfig]=useState(()=>initialConfig(threshold));
  const [step,setStep]=useState(0);
  const [prediction,setPrediction]=useState('');
  const [reason,setReason]=useState('');
  const update=(patch:Partial<Config>)=>{setConfig({...config,...patch});setStep(0);setPrediction('');setReason('');};
  const reset=()=>{setConfig(initialConfig(threshold));setStep(0);setPrediction('');setReason('');};
  const v=values(config);
  return <><h3>{transfer?'迁移挑战：满 50 可用优惠券':'三道检查，三种证据'}</h3>
    <p>{transfer?'把优惠券门槛设为 50，尝试构造“所有已启用检查通过，但规则仍错”的组合，再补上缺失证据。':'规则：满 100 获得优惠资格；标签必须输出字符串 7。先配置检查，再逐道观察同一份源码。'}</p>
    <p className="l89-note">教学模型，不执行真实 Go 命令。为分开观察静态分析与断言，测试显式使用 -vet=off；真实 go test 默认也会执行部分 vet 检查。本练习与帮助均不记录掌握成绩。</p>
    <div className="l89-columns"><fieldset><legend>源码与输入 · 修改后重新预测</legend>
      <label><input type="checkbox" checked={config.formatted} onChange={e=>update({formatted:e.target.checked})}/>应用 gofmt -w 格式化修改</label>
      <label><input type="checkbox" checked={config.verbFixed} onChange={e=>update({verbFixed:e.target.checked})}/>修复格式动词：%d → %s</label>
      <label><input type="checkbox" checked={config.boundaryFixed} onChange={e=>update({boundaryFixed:e.target.checked})}/>修复满额判断：&gt; → &gt;=</label>
      <label>传入金额<select value={config.input} onChange={e=>update({input:Number(e.target.value)})}>{[threshold-1,threshold,threshold+1].map(n=><option key={n} value={n}>{n}{n===threshold?' · 恰好门槛':''}</option>)}</select></label>
    </fieldset><fieldset><legend>检查配置 · 每道独立运行</legend>
      {tools.map(t=><label key={t}><input type="checkbox" checked={config.enabled[t]} onChange={e=>update({enabled:{...config.enabled,[t]:e.target.checked}})}/>{labels[t]}</label>)}
      <label>测试断言<select value={config.assertion} onChange={e=>update({assertion:e.target.value as Assertion})}><option value="none">不添加断言</option><option value="output">仅检查标签 == "7"</option><option value="boundary">仅检查满额资格</option><option value="both">标签 + 满额资格</option></select></label>
    </fieldset></div>
    <pre aria-label="当前模拟源码"><code>{source(config)}</code></pre>
    <fieldset disabled={step>0}><legend>先预测第一道报告问题的检查</legend><label>你的预测<select value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">请选择</option>{tools.map(t=><option key={t} value={t}>{labels[t]}</option>)}<option value="none">没有检查报告问题</option></select></label><label>为什么？<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="联系源码、工具职责与断言说明"/></label></fieldset>
    <div className="l89-actions"><button data-testing-action="step" disabled={!prediction||!reason.trim()||step===3} onClick={()=>setStep(s=>Math.min(3,s+1))}>{step===0?'提交预测，检查格式':step===1?'下一道：静态分析':step===2?'下一道：运行断言':'本轮完成'}</button><button data-testing-action="reset" onClick={reset}>重置实验</button></div>
    <div data-testid="live-model" data-state={JSON.stringify({config,step})} aria-live="polite">
      <ol className="l89-pipeline">{tools.map((t,i)=>{const result=inspect(config,t);return <li key={t} data-status={i<step?result.status:'waiting'}><strong>{i+1}. {labels[t]}</strong><span>{i<step?result.status==='pass'?'检查通过':result.status==='fail'?'发现问题':'已跳过':'等待检查'}</span><p>{i<step?result.detail:'尚未收集这类证据。'}</p></li>;})}</ol>
      {step===3&&<div className="l89-result"><p>同一输入 {config.input} 的运行值：标签 {v.text}；资格 {String(v.eligible)}，规格要求 {String(v.expectedEligible)}。</p><p>你的预测：{prediction==='none'?'没有检查报告问题':labels[prediction as Tool]}；理由：{reason}</p><p>{prediction===firstFailure(config)?'预测吻合。':'预测与观察不同。'}实际第一道报告问题的检查：{firstFailure(config)==='none'?'没有':labels[firstFailure(config) as Tool]}。</p><p>格式检查不改变源码；静态分析不认识优惠门槛；行为测试只能核对所选输入与断言。逐项修复后重跑，保留各自证据。</p></div>}
    </div></>;
}
export default function Lab(){return <section className="l89" data-testid="testing-lab-89"><Pipeline/></section>;}
function Example(){
  const [fixed,setFixed]=useState(false);
  const c={...initialConfig(),formatted:true,verbFixed:fixed};
  return <><h4>排版整齐，为什么输出仍错？</h4><p>固定已格式化的源码，只改变格式动词，比较三种证据。</p><label><input type="checkbox" checked={fixed} onChange={e=>setFixed(e.target.checked)}/>把 %d 改为 %s</label><div data-testid="live-model" data-state={String(fixed)}><pre>{source(c)}</pre><p>标签运行值：<strong>{values(c).text}</strong></p><ul><li>gofmt：始终通过，空格和缩进已规范。</li><li>vet：{fixed?'类型匹配，无此风险':'发现 %d 与 string 不匹配'}。</li><li>文本断言：{fixed?'7 == 7，通过':'诊断字符串不等于 7，失败'}。</li></ul><p>类比：排版编辑整理版面，校对员检查可疑用法，事实核对员按明确标准核对结果。任何角色都不能包办全部正确性。</p></div></>;
}
function Diagram(){
 const [tool,setTool]=useState<Tool>('format');
 const descriptions:Record<Tool,string>={format:'源码空格与缩进 → 格式差异列表；不会修复 %d，也不会改 >。',vet:'格式串 %d + string 参数 → 静态类型风险；不需要先执行 label。',test:'输入 total=100 → eligible=false → 与规格 true 比较；没有这条断言便没有此证据。'};
 return <><h4>点击检查节点，追踪它读取什么</h4><div className="l89-actions">{tools.map(t=><button key={t} aria-pressed={tool===t} onClick={()=>setTool(t)}>{labels[t]}</button>)}</div><div className="l89-map" data-testid="live-model" data-state={tool}><span>同一份源码</span><b>↓</b><strong>{labels[tool]}</strong><b>↓</b><p>{descriptions[tool]}</p></div><p>箭头表示证据来源。三条支路互相补充；检查通过只能说明各自检查范围内未发现问题。</p></>;
}
function Steps(){
 const [stage,setStage]=useState(0);
 const c={...initialConfig(),formatted:stage>=1,verbFixed:stage>=2,boundaryFixed:stage>=3};
 const tasks=['先运行格式检查：发现 main.go 有格式差异。','已应用 gofmt -w：排版修好，%d 仍接收字符串；查看 vet 证据。','已改为 %s：vet 通过，但 total=100 时业务资格仍为 false；边界断言失败。','已改为 >=：三道检查通过，仅代表本次配置和输入已验证。'];
 return <><h4>按证据修复，每次只改一处</h4><div data-testid="live-model" data-state={String(stage)} aria-live="polite"><pre>{source(c)}</pre><p>{tasks[stage]}</p><ul>{tools.map(t=><li key={t}>{labels[t]}：{inspect(c,t).status==='pass'?'通过':'发现问题'} — {inspect(c,t).detail}</li>)}</ul></div><div className="l89-actions"><button data-testing-action="step" disabled={stage===3} onClick={()=>setStage(s=>s+1)}>{['应用格式化，重查','修复格式动词，重查','修复业务边界，重查','修复完成'][stage]}</button><button data-testing-action="reset" onClick={()=>setStage(0)}>回到原始缺陷</button></div></>;
}
export function Help({mode}:{mode:string}){return <section className="l89" data-testid="testing-help-89">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Pipeline transfer/>}</section>;}

