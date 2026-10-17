import {lazy, Suspense, type ComponentType} from 'react';
import type {Lesson} from '../../content/types';
import './surface.css';

const modules = import.meta.glob<{default: ComponentType; Help: ComponentType<{mode: string}>}>('./lesson*/index.tsx');
const labs = Object.fromEntries(Object.entries(modules).map(([path, load]) => [Number(path.match(/lesson(\d+)/)![1]), lazy(load)]));
const helps = Object.fromEntries(Object.entries(modules).map(([path, load]) => [Number(path.match(/lesson(\d+)/)![1]), lazy(async () => ({default: (await load()).Help}))]));

export default function ObservabilityChapterLab({lesson}: {lesson: Lesson}) {
  const Lab = labs[lesson.id];
  return <Suspense fallback={<p role="status">正在加载可观测性实验…</p>}><div className="observability-surface"><Lab key={lesson.id}/></div></Suspense>;
}

export function ObservabilityChapterHelp({lesson, mode}: {lesson: Lesson; mode: string}) {
  const Help = helps[lesson.id];
  return <Suspense fallback={<p role="status">正在加载本题帮助…</p>}><div className="observability-surface" data-help-mode={mode}><Help key={lesson.id + mode} mode={mode}/></div></Suspense>;
}