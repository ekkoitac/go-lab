import {lazy, Suspense, type ComponentType} from 'react';
import type {Lesson} from '../../content/types';
type Module = {default: ComponentType; Help: ComponentType<{mode: string}>};
const modules = import.meta.glob<Module>('./lesson*/index.tsx');
const labs = Object.fromEntries(Object.entries(modules).map(([path, load]) => [Number(path.match(/lesson(\d+)/)![1]), lazy(load)]));
const helps = Object.fromEntries(Object.entries(modules).map(([path, load]) => [Number(path.match(/lesson(\d+)/)![1]), lazy(async () => ({default: (await load()).Help}))]));
export default function DataBoundaryChapter({lesson}: {lesson: Lesson}) {
  const Lab = labs[lesson.id];
  return <Suspense fallback={<p role="status">正在加载数据边界实验…</p>}><Lab key={lesson.id}/></Suspense>;
}
export function DataBoundaryHelp({lesson, mode}: {lesson: Lesson; mode: string}) {
  const Help = helps[lesson.id];
  return <Suspense fallback={<p role="status">正在加载本题帮助…</p>}><Help key={lesson.id + mode} mode={mode}/></Suspense>;
}
