import {lazy,Suspense,type ComponentType} from 'react';
import type {Lesson} from '../../content/types';
import './channel-lessons.css';

const modules = {
  51:()=>import('./Lesson51'), 52:()=>import('./Lesson52'),
  53:()=>import('./Lesson53'), 54:()=>import('./Lesson54'),
  55:()=>import('./Lesson55'), 56:()=>import('./Lesson56'),
  57:()=>import('./Lesson57'), 58:()=>import('./Lesson58'),
  59:()=>import('./Lesson59'), 60:()=>import('./Lesson60'),
};
const labs=Object.fromEntries(Object.entries(modules).map(([id,load])=>[id,lazy(load)]));
const helps=Object.fromEntries(Object.entries(modules).map(([id,load])=>[id,lazy(async()=>{
  const module=await load();
  return {default:(module as unknown as Record<string,ComponentType<{mode:string}>>)[`Help${id}`]};
})]));
export default function ChannelLessons({lesson}:{lesson:Lesson}){
  const Lab=labs[lesson.id];
  return <Suspense fallback={<p>正在加载本题实验…</p>}><Lab key={lesson.id}/></Suspense>;
}
export function ChannelHelp({lesson,mode}:{lesson:Lesson;mode:string}){
  const Help=helps[lesson.id];
  return <Suspense fallback={<p>正在加载本题帮助…</p>}><Help key={`${lesson.id}:${mode}`} mode={mode}/></Suspense>;
}
