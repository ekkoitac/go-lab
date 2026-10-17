import {lazy, Suspense, type ComponentType} from 'react';
import type {Lesson} from '../../content/types';

type HelpMode = 'example' | 'diagram' | 'steps' | 'try';
type LessonModule = {default: ComponentType} & Record<string, ComponentType<{mode: HelpMode}>>;
const modules = import.meta.glob<LessonModule>('./lesson*/index.tsx');
const labs = Object.fromEntries(Object.entries(modules).map(([path, load]) => [Number(path.match(/lesson(\d+)/)![1]), lazy(load)]));
const helps = Object.fromEntries(Object.entries(modules).map(([path, load]) => {
  const id = Number(path.match(/lesson(\d+)/)![1]);
  return [id, lazy(async () => ({default: (await load())[`Lesson${id}Help`]}))];
}));

export default function SecurityChapterLab({lesson}: {lesson: Lesson}) {
  const Lab = labs[lesson.id];
  return <Suspense fallback={<p role="status">正在加载安全与隔离实验…</p>}><Lab key={lesson.id}/></Suspense>;
}
export function SecurityChapterHelp({lesson, mode}: {lesson: Lesson; mode: string}) {
  const Help = helps[lesson.id];
  if (!['example', 'diagram', 'steps', 'try'].includes(mode)) return null;
  return <Suspense fallback={<p role="status">正在加载本题帮助…</p>}><Help key={lesson.id + mode} mode={mode as HelpMode}/></Suspense>;
}
