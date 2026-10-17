import type {ExperimentSpec,Frame} from '../content/types';
const numberValue=(text:string)=>{const match=text.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|%|个|条|次|MB|MiB|GiB|GB|核|连接|请求|单位)?$/);return match?{value:Number(match[1]),unit:match[2]??''}:null;};
export default function ArchitectureMetrics({spec,frame}:{spec:ExperimentSpec;frame:Frame}){
 const metrics=frame.nodes.flatMap(n=>{const parsed=numberValue(n.value);if(!parsed)return [];const candidates=spec.scenarios.flatMap(s=>s.frames.flatMap(f=>f.nodes.filter(x=>x.label===n.label).map(x=>numberValue(x.value)).filter(x=>x&&x.unit===parsed.unit).map(x=>x!.value)));return [{...n,...parsed,max:Math.max(1,...candidates)}];});
 if(!metrics.length)return null;
 return <div className="architecture-metrics" aria-label="教学模型资源变化"><small>同名指标在各分支使用同一比例；数值为本课模型，非实测。</small>{metrics.map(n=><div className="architecture-meter" key={n.id}><span>{n.label}</span><svg viewBox="0 0 240 20" role="img" aria-label={n.label+'：'+n.value+n.unit}><rect width="240" height="20" rx="5" fill="#e5eee8"/><rect data-testid="resource-bar" data-metric={n.label} width={240*n.value/n.max} height="20" rx="5" fill="#318b73"/></svg><strong>{n.value}{n.unit}</strong></div>)}</div>;
}
