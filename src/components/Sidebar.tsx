import {useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type RefObject} from 'react';
import {Code2, ChevronRight, PanelLeftClose, PanelLeftOpen, X, LayoutGrid, RefreshCw, GraduationCap} from 'lucide-react';
import {catalog, courses, modules, type CourseId} from '../content/catalog';
import type {Progress} from '../content/types';
import {independent} from '../learning';
import {readExpanded, writeSetting} from '../navigation';

export const navigationItems = [
  {key: 'map', label: '课程地图', icon: LayoutGrid},
  {key: 'review', label: '复习中心', icon: RefreshCw},
  {key: 'records', label: '学习记录', icon: GraduationCap},
];
export function followNavigation(event: MouseEvent<HTMLAnchorElement>, action: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  action();
}
type Props = {
  courseId: CourseId; route: string; mapModule: number; progress: Record<number, Progress>;
  collapsed: boolean; onToggle: () => void; mobile: boolean; open: boolean; onClose: () => void;
  opener: RefObject<HTMLButtonElement | null>; onNavigate: (route: string) => void;
  onModule: (id: number) => void; connected: boolean; goAvailable: boolean;
};
export default function Sidebar(props: Props) {
  const {courseId, route, mapModule, progress, mobile, open, collapsed} = props;
  const course = courses.find(c => c.id === courseId)!;
  const activeLesson = catalog.find(l => route === 'lesson/' + l.id);
  const currentModule = activeLesson?.module ?? mapModule;
  const [expandedByCourse, setExpanded] = useState<Record<CourseId, number[]>>(() => ({
    intro: readExpanded('intro', courseId === 'intro' ? currentModule : 0),
    architecture: readExpanded('architecture', courseId === 'architecture' ? currentModule : 10),
  }));
  const expanded = expandedByCourse[courseId];
  const aside = useRef<HTMLElement>(null), directory = useRef<HTMLDivElement>(null);
  const revealNeeded = useRef(true);
  const close = useRef<HTMLButtonElement>(null), toggle = useRef<HTMLButtonElement>(null);
  const latestProps = useRef(props);
  latestProps.current = props;
  const compact = !mobile && collapsed;
  const courseLessons = catalog.filter(l => course.moduleIds.includes(l.module));
  const completed = courseLessons.filter(l => progress[l.id]?.completed).length;

  useEffect(() => {
    if (!activeLesson) return;
    setExpanded(old => old[courseId].includes(activeLesson.module) ? old : {...old, [courseId]: [...old[courseId], activeLesson.module]});
  }, [courseId, activeLesson?.id]);
  useEffect(() => {
    for (const id of ['intro', 'architecture'] as const) writeSetting('go100:ui:expanded:' + id, JSON.stringify(expandedByCourse[id]));
  }, [expandedByCourse]);
  useLayoutEffect(() => {
    revealNeeded.current = true;
  }, [activeLesson?.id, courseId, compact, mobile, open]);
  useLayoutEffect(() => {
    if (!revealNeeded.current) return;
    if (compact || mobile && !open) return;
    const container = directory.current;
    const item = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !item || !item.getClientRects().length) return;
    revealNeeded.current = false;
    const bounds = container.getBoundingClientRect(), target = item.getBoundingClientRect();
    if (target.top < bounds.top) container.scrollTop -= bounds.top - target.top + 8;
    else if (target.bottom > bounds.bottom) container.scrollTop += target.bottom - bounds.bottom + 8;
  }, [activeLesson?.id, courseId, expanded, compact, mobile, open]);
  useEffect(() => {
    if (!mobile || !open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus({preventScroll: true});
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); latestProps.current.onClose(); return;}
      if (event.key !== 'Tab') return;
      const items = [...aside.current!.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')].filter(e => e.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || !aside.current?.contains(document.activeElement))) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && (document.activeElement === last || !aside.current?.contains(document.activeElement))) {event.preventDefault(); first?.focus();}
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      const opener = latestProps.current.opener.current;
      if (opener?.getClientRects().length) opener.focus({preventScroll: true});
      else toggle.current?.focus({preventScroll: true});
    };
  }, [mobile, open]);
  function toggleModule(id: number) {
    setExpanded(old => ({...old, [courseId]: old[courseId].includes(id) ? old[courseId].filter(x => x !== id) : [...old[courseId], id]}));
  }
  return <>
    <aside ref={aside} id="learning-navigation" className={'sidebar learning-sidebar' + (compact ? ' collapsed' : '') + (open && mobile ? ' open' : '')}
      inert={mobile && !open} aria-label="学习导航" role={mobile && open ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined}>
      <div className="sidebar-heading">
        <a className="brand" href="#map" aria-label="Go 100 Lab 课程地图" onClick={e => followNavigation(e, () => props.onNavigate('map'))}>
          <span className="brand-icon"><Code2 size={23}/></span><span className="brand-copy">Go 100<span className="brand-lab"> LAB</span><small>把 Go 弄明白</small></span>
        </a>
        {mobile ? <button ref={close} className="icon-button sidebar-toggle" aria-label="关闭导航" onClick={props.onClose}><X size={19}/></button>
          : <button ref={toggle} className="icon-button sidebar-toggle" aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'} title={collapsed ? '展开侧边栏' : '收起侧边栏'} aria-expanded={!collapsed} aria-controls={compact ? undefined : 'course-directory'} onClick={props.onToggle}>{collapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>}</button>}
      </div>
      <nav className="primary-navigation" aria-label="学习空间">
        {navigationItems.map(({key, label, icon: Icon}) => {
          const active = route === key || key === 'map' && !!activeLesson;
          return <a key={key} href={'#' + key} className={active ? 'active' : ''} aria-label={label} aria-current={route === key ? 'page' : undefined} onClick={e => followNavigation(e, () => props.onNavigate(key))}>
            <Icon size={19}/><span className="nav-text">{label}</span>{key === 'map' && <span className="nav-count">{courseLessons.length}</span>}{compact && <span className="rail-tooltip" aria-hidden="true">{label}</span>}
          </a>;
        })}
      </nav>
      {!compact && <>
        <div className="sidebar-label module-label">探索章节 <span>{course.moduleIds.length}</span></div>
        <div className="course-directory" id="course-directory" ref={directory}>
          {course.moduleIds.map((id, index) => {
            const chapter = modules[id], isExpanded = expanded.includes(id);
            return <section className="directory-chapter" key={id}>
              <button className={'chapter-toggle' + (currentModule === id ? ' selected' : '')} aria-expanded={isExpanded} aria-controls={'chapter-lessons-' + id} onClick={() => toggleModule(id)}>
                <span className="chapter-number">{String(index + 1).padStart(2, '0')}</span><span className="chapter-name">{chapter.name}</span>
                <small title="已浏览课程数">{chapter.lessonIds.filter(id => progress[id]?.completed).length}/{chapter.lessonIds.length}</small><ChevronRight size={14} className={isExpanded ? 'expanded-chevron' : ''}/>
              </button>
              <div id={'chapter-lessons-' + id} hidden={!isExpanded} className="chapter-lessons">
                <button className="chapter-map-link" aria-label={'查看本章：' + chapter.name} onClick={() => props.onModule(id)}>查看本章<ChevronRight size={12}/></button>
                {catalog.filter(l => l.module === id).map(l => {
                  const p = progress[l.id], status = p && independent(p) ? '独立通过' : p?.completed ? '已浏览' : p?.visited ? '学习中' : '未开始';
                  return <a className="directory-lesson" href={'#lesson/' + l.id} key={l.id} aria-current={activeLesson?.id === l.id ? 'page' : undefined} onClick={e => followNavigation(e, () => props.onNavigate('lesson/' + l.id))}>
                    <span className="directory-number">{String(l.id).padStart(3, '0')}</span><span className="directory-title">{l.title}</span><span className={'directory-status status-' + (p && independent(p) ? 'mastered' : p?.completed ? 'complete' : p?.visited ? 'learning' : 'new')}>{status}</span>
                  </a>;
                })}
              </div>
            </section>;
          })}
        </div>
        <div className="sidebar-bottom"><div className="progress-label"><span>学习足迹</span><b>{completed} <small>/ {courseLessons.length}</small></b></div><div className="progress-track"><i style={{width: completed / courseLessons.length * 100 + '%'}}/></div><div className="local-badge"><span className={props.goAvailable ? 'online-dot' : 'offline-dot'}/><span>{props.connected ? '本地学习 · 数据保存在此设备' : '连接本机服务中'}</span></div></div>
      </>}
    </aside>
    {mobile && open && <button className="sidebar-overlay" aria-label="点击遮罩关闭导航" tabIndex={-1} onClick={props.onClose}/>}
  </>;
}
