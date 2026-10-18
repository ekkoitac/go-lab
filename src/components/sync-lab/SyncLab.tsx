import {lazy, Suspense, type ComponentType} from 'react';
import type {Lesson} from '../../content/types';

// Preserve the existing chapter entry point and keep each lesson independently loaded.
const modules = import.meta.glob<{default: ComponentType; Help: ComponentType<{mode: string}>}>('./lesson*/index.tsx');
const labs = Object.fromEntries(Object.entries(modules).map(([path, load]) => [Number(path.match(/lesson(\d+)/)![1]), lazy(load)]));
const helps = Object.fromEntries(Object.entries(modules).map(([path, load]) => [Number(path.match(/lesson(\d+)/)![1]), lazy(async () => ({default: (await load()).Help}))]));

export default function SyncLab({lesson}: {lesson: Lesson}) {
  const Lab = labs[lesson.id];
  return <Suspense fallback={<p role="status">正在加载本题同步实验…</p>}><Lab key={lesson.id}/></Suspense>;
}

export function SyncHelp({lesson, mode}: {lesson: Lesson; mode: string}) {
  const Help = helps[lesson.id];
  return <Suspense fallback={<p role="status">正在加载本题帮助…</p>}><div data-help-mode={mode}><Help key={lesson.id + mode} mode={mode}/></div></Suspense>;
}
