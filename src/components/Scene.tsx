import {useEffect, useId, useRef, useState} from 'react';
import type {Frame} from '../content/types';
import {layoutScene, nodeChange} from './scene-layout';

export default function Scene({frame, previous, kind}: {frame: Frame; previous?: Frame; kind: string}) {
  const marker = useId().replace(/:/g, '');
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(620);
  useEffect(() => {
    const element = container.current!;
    const observer = new ResizeObserver(entries => setWidth(Math.min(620, entries[0].contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const layout = layoutScene(frame, width, kind);
  return <div ref={container} className="scene-viewport" tabIndex={frame.edges?.length ? 0 : undefined} aria-label={frame.edges?.length ? '关系图，可横向滚动查看完整图示' : undefined}>
    <svg className={'scene ' + kind} viewBox={`0 0 ${layout.width} ${layout.height}`} style={{minWidth: frame.edges?.length ? layout.width : undefined}} role="img" aria-label={frame.label} data-testid="experiment-scene" data-state={JSON.stringify(frame)}>
      <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#66a4ac"/></marker></defs>
      {frame.edges?.map((edge, i) => {
        const a = layout.nodes.find(n => n.id === edge.from), b = layout.nodes.find(n => n.id === edge.to);
        if (!a || !b) return null;
        const x1=a.x+a.w/2, y1=a.y+a.h, x2=b.x+b.w/2, y2=b.y;
        return <g key={i}><path className="scene-edge" d={`M ${x1} ${y1} C ${x1} ${(y1+y2)/2} ${x2} ${(y1+y2)/2} ${x2} ${y2-4}`} markerEnd={`url(#${marker})`}/>{edge.label&&<text x={(x1+x2)/2} y={(y1+y2)/2-5} textAnchor="middle" className="edge-label">{edge.label}</text>}</g>;
      })}
      {layout.nodes.map(n => <g key={n.id} className={'scene-node '+(n.active?'active ':'')+(nodeChange(n,previous)?'changed ':'')+(n.tone??'')} data-change={nodeChange(n,previous)} transform={`translate(${n.x},${n.y})`}>
        <rect width={n.w} height={n.h} rx={kind==='interface'?4:12}/>
        <text x="12" y="22" className="node-label">{n.labels.map((line,i)=><tspan key={i} x="12" dy={i?18:0}>{line}</tspan>)}</text>
        {n.cells?.length ? n.cells.map((cell,i) => {
          const cw=(n.w-24)/n.perRow;
          return <g key={i} transform={`translate(${12+(i%n.perRow)*cw},${n.valueY+Math.floor(i/n.perRow)*40})`}><rect className="memory-cell" width={cw-4} height="34" rx="4"/><text x={(cw-4)/2} y="23" textAnchor="middle">{cell}</text></g>;
        }) : <text x="12" y={n.valueY+16} className="node-value">{n.values.map((line,i)=><tspan key={i} x="12" dy={i?21:0}>{line}</tspan>)}</text>}
        <title>{n.label}：{n.value}{nodeChange(n,previous)?' · '+nodeChange(n,previous):''}</title>
        {n.active&&<circle cx={n.w-14} cy="16" r="4" fill="#0a8b80"/>}
      </g>)}
    </svg>
  </div>;
}
