import {useEffect,useRef,useState} from 'react';
import type {DiagramSpec,DecisionSpec} from '../content/types';

let engine:Promise<typeof import('mermaid')['default']>|undefined;
let queue:Promise<unknown>=Promise.resolve();
let sequence=0;
const cache=new Map<string,string>();
async function render(source:string){
 const cached=cache.get(source);if(cached)return cached;
 engine??=import('mermaid').then(({default:m})=>{m.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',fontFamily:'Arial, Microsoft YaHei, sans-serif',themeVariables:{primaryColor:'#e7f3ee',primaryTextColor:'#244d46',primaryBorderColor:'#80afa1',lineColor:'#47796b',fontSize:'15px'},flowchart:{htmlLabels:false},suppressErrorRendering:true});return m;}).catch(error=>{engine=undefined;throw error;});
 const work=queue.catch(()=>{}).then(async()=>{
  const m=await engine!;await m.parse(source);
  const host=document.createElement('div');host.style.cssText='position:fixed;top:0;left:-10000px;width:1000px;visibility:hidden;pointer-events:none;';document.body.append(host);
  try{const {svg}=await m.render('architecture-diagram-'+(++sequence),source,host);cache.set(source,svg);return svg;}finally{host.remove();}
 });
 queue=work;return work;
}
export function MermaidDiagram({diagram}:{diagram:DiagramSpec}){
 const [svg,setSvg]=useState(''),[error,setError]=useState(false),[retry,setRetry]=useState(0),[expanded,setExpanded]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{let active=true;setSvg('');setError(false);void render(diagram.source).then(result=>{if(active)setSvg(result)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[diagram.source,retry]);
 const picture=<div className="mermaid-svg" data-testid="mermaid-diagram" role="img" aria-label={diagram.title} dangerouslySetInnerHTML={{__html:svg}}/>;
 return <figure className="diagram-card"><div className="diagram-heading"><h3>{diagram.title}</h3>{svg&&<button className="ghost" onClick={()=>{setExpanded(true);dialog.current?.showModal()}} aria-label={'放大图解：'+diagram.title}>放大查看</button>}</div>
 {svg?(expanded?<p>图解已在放大窗口中打开。</p>:picture):error?<div className="diagram-fallback" role="status"><strong>图形暂时未能渲染</strong><p>{diagram.caption}</p><button onClick={()=>setRetry(n=>n+1)}>重试图形</button></div>:<p role="status">正在绘制图解…</p>}
 <figcaption>{diagram.caption}</figcaption><p className="diagram-legend">读图提示：节点表示组件或状态；箭头及其标签表示依赖、流向或先后顺序。图示用于解释本课条件。</p>
 <dialog ref={dialog} className="diagram-dialog" onClose={()=>setExpanded(false)} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}><div><button className="ghost" autoFocus onClick={()=>dialog.current?.close()}>关闭放大图解</button><h2>{diagram.title}</h2>{expanded&&svg&&picture}<p>{diagram.caption}</p></div></dialog>
 </figure>;
}
export default function Diagrams({diagrams}:{diagrams:DiagramSpec[]}){return <div className="lesson-diagrams">{diagrams.map((diagram,i)=><MermaidDiagram key={i+diagram.source} diagram={diagram}/>)}</div>}
export function DecisionComparison({decision}:{decision:DecisionSpec}){return <section className="decision-comparison"><h3>方案、代价与适用条件</h3><div className="decision-options">{decision.options.map(option=><article key={option.title}><h4>{option.title}</h4><p><b>收益：</b>{option.benefits}</p><p><b>代价：</b>{option.costs}</p><p><b>适用条件：</b>{option.when}</p></article>)}</div><div className="decision-mnemonic"><strong>记住这句话</strong><p>{decision.mnemonic}</p><small>失效边界：{decision.revisitWhen.join('；')}</small></div></section>}
