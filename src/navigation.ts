import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {catalog, courses, courseForLesson, type CourseId} from './content/catalog';

export function readSetting(key: string, session = false): string | null {
  try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; }
}
export function writeSetting(key: string, value: string, session = false) {
  try { (session ? sessionStorage : localStorage).setItem(key, value); } catch { /* Keep the in-memory state usable. */ }
}
function readJSON(key: string, session = false): unknown {
  try { return JSON.parse(readSetting(key, session) ?? 'null'); } catch { return null; }
}
export const readRoute = () => location.hash.slice(1) || 'map';
export function readCourse(): CourseId {
  const entry = catalog.find(l => readRoute() === 'lesson/' + l.id);
  return entry ? courseForLesson(entry.id).id : readSetting('go100:course') === 'architecture' ? 'architecture' : 'intro';
}
export type MapContext = {module: number; query: string; filter: string; scrollY: number | null};
const mapKey = (id: CourseId) => 'go100:ui:map:' + id;
function validMap(value: unknown, course: CourseId, fallbackModule = courses.find(c => c.id === course)!.moduleIds[0]): MapContext {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<MapContext>;
  return {
    module: courses.find(c => c.id === course)!.moduleIds.includes(v.module!) ? v.module! : fallbackModule,
    query: typeof v.query === 'string' ? v.query : '',
    filter: ['all', 'favorite', 'unstarted', 'learning'].includes(v.filter!) ? v.filter! : 'all',
    scrollY: v.scrollY === null ? null : typeof v.scrollY === 'number' && Number.isFinite(v.scrollY) ? Math.max(0, v.scrollY) : 0,
  };
}
type View = {route: string; courseId: CourseId; map: MapContext; revision: number};
type Entry = {courseId: CourseId; map?: MapContext};
function historyEntry(): Entry | undefined {
  const entry = history.state?.go100Navigation;
  return entry && (entry.courseId === 'intro' || entry.courseId === 'architecture') ? entry : undefined;
}

// Map context is distinct from the lesson being viewed. History entries keep their
// own map snapshot so back/forward also works across learning-path switches.
export function useNavigation(mapReady: boolean) {
  const [view, setView] = useState<View>(() => {
    const route = readRoute(), entry = historyEntry();
    const courseId = route.startsWith('lesson/') ? readCourse() : entry?.courseId ?? readCourse();
    const saved = readJSON(mapKey(courseId), true);
    const lesson = catalog.find(l => route === 'lesson/' + l.id);
    const map = validMap(route === 'map' && entry?.map ? entry.map : saved, courseId, lesson?.module);
    if (!saved && lesson) map.scrollY = null;
    return {route, courseId, map, revision: 0};
  });
  const current = useRef(view);
  const maps = useRef<Partial<Record<CourseId, MapContext>>>({[view.courseId]: view.map});
  const restoring = useRef(false);
  const listRef = useRef<HTMLElement>(null);
  function remember(v: View) {
    maps.current[v.courseId] = v.map;
    writeSetting(mapKey(v.courseId), JSON.stringify(v.map), true);
  }
  function stamp(v: View) {
    history.replaceState({...history.state, go100Navigation: {courseId: v.courseId, ...(v.route === 'map' ? {map: v.map} : {})}}, '');
  }
  function commit(v: View) {
    current.current = v;
    remember(v);
    writeSetting('go100:course', v.courseId);
    setView(v);
  }
  function cachedMap(id: CourseId, route: string): MapContext {
    const saved = maps.current[id] ?? readJSON(mapKey(id), true);
    const lesson = catalog.find(l => route === 'lesson/' + l.id);
    return {...validMap(saved, id, lesson?.module), ...(!saved && lesson ? {scrollY: null} : {})};
  }
  function capture() {
    const v = current.current;
    if (v.route !== 'map' || readRoute() !== 'map' || restoring.current) return;
    const snapshot = {...v, map: {...v.map, scrollY: window.scrollY}};
    current.current = snapshot;
    remember(snapshot);
    stamp(snapshot);
  }
  function navigate(route: string, courseId = current.current.courseId, map?: MapContext) {
    capture();
    const v = current.current;
    if (route.startsWith('lesson/')) courseId = courseForLesson(Number(route.split('/')[1])).id;
    const next = {route, courseId, map: map ?? cachedMap(courseId, route), revision: v.revision + 1};
    if (route !== v.route || courseId !== v.courseId) {
      history.pushState({go100Navigation: {courseId, ...(route === 'map' ? {map: next.map} : {})}}, '', '#' + route);
    }
    commit(next);
    stamp(next);
  }
  function updateMap(patch: Partial<MapContext>) {
    const v = current.current;
    const next = {...v, map: {...v.map, ...patch}};
    commit(next);
    stamp(next);
  }
  function showModule(module: number) {
    navigate('map', current.current.courseId, {module, query: '', filter: 'all', scrollY: null});
  }
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    remember(current.current);
    writeSetting('go100:course', current.current.courseId);
    stamp(current.current);
    const onHashChange = () => {
      const route = readRoute(), entry = historyEntry(), old = current.current;
      const courseId = route.startsWith('lesson/') ? readCourse() : entry?.courseId ?? old.courseId;
      const map = route === 'map' && entry?.map ? validMap(entry.map, courseId) : cachedMap(courseId, route);
      // A history traversal can emit both popstate and hashchange. Same-hash
      // path switches emit only popstate, so listen to both and commit once.
      if (route === old.route && courseId === old.courseId && JSON.stringify(map) === JSON.stringify(old.map)) return;
      const next = {route, courseId, map, revision: old.revision + 1};
      commit(next);
      stamp(next);
    };
    let timer: number | undefined;
    const onScroll = () => {
      // Avoid writing storage and history at the display's frame rate.
      if (timer === undefined) timer = window.setTimeout(() => {timer = undefined; capture();}, 200);
    };
    const onScrollEnd = () => {clearTimeout(timer); timer = undefined; capture();};
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('scrollend', onScrollEnd);
    window.addEventListener('pagehide', capture);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd);
      window.removeEventListener('pagehide', capture);
      history.scrollRestoration = previous;
    };
  }, []);
  useLayoutEffect(() => {
    restoring.current = true;
    const v = current.current;
    if (v.route === 'map') {
      // Favorites and learning filters need progress before the list has its
      // final height. Do not overwrite a saved offset with an empty-list clamp.
      if (!mapReady) return;
      if (v.map.scrollY === null) listRef.current?.scrollIntoView({block: 'start', behavior: 'instant'});
      else window.scrollTo({top: v.map.scrollY, behavior: 'instant'});
    } else window.scrollTo({top: 0, behavior: 'instant'});
    const frame = requestAnimationFrame(() => {restoring.current = false; capture();});
    return () => cancelAnimationFrame(frame);
  }, [view.revision, view.route === 'map' && mapReady]);
  return {...view, listRef, navigate, showModule, updateMap};
}

export function useMobileNavigation() {
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 720px)').matches);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = matchMedia('(max-width: 720px)');
    const update = () => {setMobile(media.matches); setOpen(false);};
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return {mobile, open, setOpen};
}

export function readExpanded(courseId: CourseId, currentModule: number): number[] {
  const value = readJSON('go100:ui:expanded:' + courseId);
  return Array.isArray(value) ? value.filter(id => courses.find(c => c.id === courseId)!.moduleIds.includes(id)) : [currentModule];
}
