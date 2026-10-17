import {lazy,Suspense,type ComponentType} from 'react';
import type {Lesson} from '../../content/types';

// Each lesson owns its model and presentation; only loading is shared.
const modules=import.meta.glob<{default:ComponentType;Help:ComponentType<{mode:string}>}>('./lesson*/index.tsx');
const labs=Object.fromEntries(Object.entries(modules).map(([path,load])=>[Number(path.match(/lesson(\d+)/)![1]),lazy(load)]));
const helps=Object.fromEntries(Object.entries(modules).map(([path,load])=>[Number(path.match(/lesson(\d+)/)![1]),lazy(async()=>({default:(await load()).Help}))]));
export default function IOChapterLab({lesson}:{lesson:Lesson}){
 const Lab=labs[lesson.id];
 return <Suspense fallback={<p role="status">正在加载本题实验…</p>}><Lab key={lesson.id}/></Suspense>;
}
export function IOChapterHelp({lesson,mode}:{lesson:Lesson;mode:string}){
 const Help=helps[lesson.id];
 return <Suspense fallback={<p role="status">正在加载本题帮助…</p>}><Help key={lesson.id+mode} mode={mode}/></Suspense>;
}
