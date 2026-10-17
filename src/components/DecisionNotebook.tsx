import {useEffect,useRef,useState} from 'react';
import type {Lesson,Progress} from '../content/types';
import {api} from '../api';
const saves=new Map<string,Promise<void>>();
export async function flushDecisionSaves(){await Promise.all([...saves.values()]);}
export default function DecisionNotebook({lesson,p,onProgress,onError}:{lesson:Lesson;p:Progress;onProgress:(p:Progress)=>void;onError:(s:string)=>void}){
 const key='go100:decision:'+lesson.id+':'+lesson.version;
 const [value,setValue]=useState(()=>localStorage.getItem(key)??p.feynman??''),[status,setStatus]=useState('已保存');
 const latest=useRef(value),mounted=useRef(true),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function persist(){
  const snapshot=latest.current;
  const pending=(saves.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
   try{const result=await api<Progress>('/progress/'+lesson.id,'PATCH',{feynman:snapshot});
    if(localStorage.getItem(key)===snapshot)localStorage.removeItem(key);
    if(mounted.current){onProgress(result);if(latest.current===snapshot)setStatus('已保存');}
   }catch(e){if(mounted.current){setStatus('已缓存，待同步');onError(String(e));}}
  });
  saves.set(key,pending);void pending.finally(()=>{if(saves.get(key)===pending)saves.delete(key);});
 }
 useEffect(()=>{mounted.current=true;if(localStorage.getItem(key)!==null)persist();return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);if(localStorage.getItem(key)!==null)persist();}},[key]);
 function edit(text:string){latest.current=text;setValue(text);try{localStorage.setItem(key,text);setStatus('已缓存，保存中');}catch{setStatus('保存中');}if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(persist,300);}
 return <section className="decision-notebook"><div className="diagram-heading"><h3>我的决策记录</h3><small role="status">{status}</small></div><p>选择什么？依据哪些约束？接受什么代价？怎样验证？什么时候重新评估？</p><textarea aria-label="架构决策记录" value={value} maxLength={20000} onChange={e=>edit(e.target.value)} placeholder={'我的选择：\n约束与理由：\n接受的代价：\n验证办法：\n重新评估条件：'}/><small>这份记录与本课费曼复述共用，自动保存。开放回答采用自评，不自动计为独立通过。</small></section>;
}
