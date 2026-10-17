import {useId} from 'react';
import './relations.css';
export type RelationNode={id:string;label?:string;detail?:string;x:number;y:number;w?:number;active?:boolean;missing?:boolean};
export type RelationEdge={from:string;to:string;active?:boolean};
export default function RelationGraph({nodes,edges,label,height=300,selected,onSelect}:{nodes:RelationNode[];edges:RelationEdge[];label:string;height?:number;selected?:string;onSelect?:(id:string)=>void}){
 const marker='relations-'+useId().replace(/[^a-zA-Z0-9]/g,'');
 return <svg className="architecture-relations" viewBox={`0 0 340 ${height}`} role={onSelect?'group':'img'} aria-label={label}>
  <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs>
  {edges.map((edge,i)=>{const a=nodes.find(n=>n.id===edge.from),b=nodes.find(n=>n.id===edge.to);if(!a||!b)return null;const aw=a.w??130,bw=b.w??130,ax=a.x+aw/2,ay=a.y+25,bx=b.x+bw/2,by=b.y+25,dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1;const start=Math.min(dx?aw/2/Math.abs(dx):Infinity,dy?25/Math.abs(dy):Infinity),end=Math.min(dx?bw/2/Math.abs(dx):Infinity,dy?25/Math.abs(dy):Infinity);const x1=ax+dx*start,y1=ay+dy*start,x2=bx-dx*end,y2=by-dy*end;const reverse=edges.some(e=>e.from===edge.to&&e.to===edge.from),offset=reverse?28:0;return <path key={i} d={`M${x1} ${y1}Q${(x1+x2)/2-dy/len*offset} ${(y1+y2)/2+dx/len*offset} ${x2} ${y2}`} className={edge.active?'cycle':selected&&(selected===edge.from||selected===edge.to)?'related':''} markerEnd={`url(#${marker})`}><title>{edge.from} → {edge.to}</title></path>})}
  {nodes.map(n=><g key={n.id} transform={`translate(${n.x} ${n.y})`} className={(n.active?'built ':'')+(n.missing?'missing ':'')+(selected===n.id?'selected':'')} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={n.label??n.id} aria-pressed={onSelect?selected===n.id:undefined} onClick={()=>onSelect?.(n.id)} onKeyDown={e=>{if(onSelect&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(n.id)}}}><rect width={n.w??130} height="50" rx="10"/><text x={(n.w??130)/2} y={n.detail?22:30} textAnchor="middle">{n.label??n.id}</text>{n.detail&&<text className="detail" x={(n.w??130)/2} y="40" textAnchor="middle">{n.detail}</text>}</g>)}
 </svg>;
}
