import {useId,useState} from 'react';
import {guides,replay,routeFor} from './guides';
import {metrics} from './model';
import {drawing,type DiagramNode,type DiagramEdge} from './diagrams';
import './sync-diagram.css';

function focusStep(id:number,length:number){return [44,48,50].includes(id)?Math.min(2,length-1):length-1;}
function port(a:DiagramNode,b:DiagramNode){
 const dx=b.x-a.x,dy=b.y-a.y;
 const factor=Math.min(dx? a.w/2/Math.abs(dx):Infinity,dy?a.h/2/Math.abs(dy):Infinity);
 return {x:a.x+dx*factor,y:a.y+dy*factor};
}
function edgeLayout(edge:DiagramEdge,nodes:DiagramNode[]){
 const a=nodes.find(n=>n.id===edge.from)!,b=nodes.find(n=>n.id===edge.to)!;
 const start=port(a,b),end=port(b,a);
 return {path:edge.path??'M '+start.x+' '+start.y+' L '+end.x+' '+end.y,x:edge.labelX??(start.x+end.x)/2,y:edge.labelY??(start.y+end.y)/2-8};
}
export default function SyncDiagram({lessonId}:{lessonId:number}){
 const [fixed,setFixed]=useState(false),[cursor,setCursor]=useState(()=>focusStep(lessonId,replay(lessonId,false,2,routeFor(lessonId,false,2)).length));
 const [selected,setSelected]=useState<string|null>(null);
 const prefix='sync-graph-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const frames=replay(lessonId,fixed,2,routeFor(lessonId,fixed,2)),state=frames[cursor],graph=drawing(state),guide=guides[lessonId];
 const selectedNode=graph.nodes.find(n=>n.id===selected),incident=graph.edges.filter(e=>e.from===selected||e.to===selected);
 function chooseCondition(next:boolean){if(next===fixed)return;setFixed(next);setSelected(null);setCursor(focusStep(lessonId,replay(lessonId,next,2,routeFor(lessonId,next,2)).length));}
 function seek(index:number){setCursor(index);setSelected(null);}
 return <section className="sync-diagram" data-testid="sync-diagram" data-state={JSON.stringify(state)}>
  <h4>{graph.title}</h4><p>{graph.description}</p>
  <div className="sync-diagram-conditions" role="group" aria-label="图解条件">{guide.conditions.map((condition,i)=><button key={condition} aria-pressed={fixed===(i===1)} onClick={()=>chooseCondition(i===1)}>{condition}</button>)}</div>
  <svg className="sync-diagram-canvas" viewBox="0 0 400 350" role="group" aria-labelledby={prefix+'-title'} aria-describedby={prefix+'-desc'} data-testid="sync-diagram-svg">
   <title id={prefix+'-title'}>{graph.title}</title><desc id={prefix+'-desc'}>{graph.description} 当前：{metrics(state).map(([key,value])=>key+'：'+value).join('；')}。可聚焦节点并按回车追踪关系。</desc>
   <defs>{['normal','wait'].map(tone=><marker key={tone} id={prefix+'-'+tone} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={tone==='wait'?'#b66536':'#568875'}/></marker>)}</defs>
   {graph.marks.map((mark,i)=><g key={i} className="sync-drawing-mark"><rect x={mark.x} y={mark.y} width={mark.w} height={mark.h} rx={mark.round?mark.w/2:6} fill={mark.fill} stroke={mark.outline?"#7f9c76":undefined} strokeDasharray={mark.outline?"5 4":undefined}/>{mark.label&&<text x={mark.x+mark.w/2} y={mark.y+mark.h/2+5} textAnchor="middle">{mark.label}</text>}</g>)}
   {graph.edges.map((edge,i)=>{const layout=edgeLayout(edge,graph.nodes),highlight=selected!==null&&(edge.from===selected||edge.to===selected);return <g key={i} className={'sync-drawing-edge '+(edge.wait?'waiting ':'')+(highlight?'highlight':'')} data-from={edge.from} data-to={edge.to}>
    <path d={layout.path} markerEnd={'url(#'+prefix+'-'+(edge.wait?'wait':'normal')+')'}/>
    <text x={layout.x} y={layout.y} textAnchor="middle">{Array.from(edge.label).reduce<string[]>((lines,char,index)=>{if(index%10===0)lines.push('');lines[lines.length-1]+=char;return lines;},[]).map((line,j)=><tspan key={j} x={layout.x} dy={j?16:0}>{line}</tspan>)}</text>
   </g>;})}
   {graph.nodes.map(node=><g key={node.id} className={'sync-drawing-node '+(node.tone??'')+(selected===node.id?' selected':'')} data-node={node.id} role="button" tabIndex={0} aria-label={node.lines.filter(Boolean).join('，')} aria-pressed={selected===node.id} onClick={()=>setSelected(selected===node.id?null:node.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(selected===node.id?null:node.id);}}}>
    <rect x={node.x-node.w/2} y={node.y-node.h/2} width={node.w} height={node.h} rx={node.shape==='round'?node.h/2:8}/>
    {node.shape==='lock'&&<path className="sync-lock-shackle" d={'M '+(node.x-10)+' '+(node.y-node.h/2)+' v -7 a 10 10 0 0 1 20 0 v 7'}/>}
    <text textAnchor="middle" x={node.x} y={node.y-(node.lines.filter(Boolean).length-1)*10+5}>{node.lines.filter(Boolean).map((line,i)=><tspan key={i} x={node.x} dy={i?20:0}>{line}</tspan>)}</text>
   </g>)}
   {graph.labels.map((label,i)=><text className="sync-drawing-label" key={i} x={label.x} y={label.y} textAnchor="middle">{label.text}</text>)}
  </svg>
  <p className="sync-diagram-legend">实线箭头：图中标注的执行或引用关系；虚线箭头：{lessonId===49?"跳过范围":"等待或无法通过"}。点击节点可突出关联连线。</p>
  {selectedNode&&<div className="sync-diagram-inspect" aria-live="polite"><strong>{selectedNode.lines.filter(Boolean).join(' · ')}</strong><p>{selectedNode.note}</p>{incident.length>0&&<ul>{incident.map((edge,i)=><li key={i}>{graph.nodes.find(n=>n.id===edge.from)!.lines[0]} → {edge.label} → {graph.nodes.find(n=>n.id===edge.to)!.lines[0]}</li>)}</ul>}</div>}
  <div className="sync-diagram-controls"><button disabled={cursor===0} onClick={()=>seek(cursor-1)}>上一帧</button><span>{cursor} / {frames.length-1}</span><button disabled={cursor===frames.length-1} onClick={()=>seek(cursor+1)}>下一帧</button><button onClick={()=>seek(0)}>从头看</button></div>
  <label className="sync-diagram-slider">过程位置<input aria-label="图解步骤" type="range" min="0" max={frames.length-1} value={cursor} onChange={event=>seek(Number(event.target.value))}/></label>
  <div className="sync-diagram-caption" aria-live="polite"><strong>{state.line}</strong><p>{state.message}</p></div>
  <details><summary>本图的简化与边界</summary><p>{guide.boundary}</p><p>图解使用固定输入和示例顺序。可在「动手观察」自由安排调度、改变参数。</p></details>
 </section>;
}

