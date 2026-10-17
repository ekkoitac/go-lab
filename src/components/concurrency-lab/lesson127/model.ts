export type Strategy = 'deep' | 'shallow' | 'inplace';
export type Route = { version: number; nested: string };
export type Reader = { root: string; versionSeen: number; backendSeen: string | null };
export type Model = { strategy: Strategy; phase: number; published: string; roots: Record<string, Route>; nested: Record<string, string>; writer: string | null; old: Reader | null; fresh: Reader | null; log: string[] };
export const labels: Record<Strategy, string> = { deep: '完整复制后发布', shallow: '只复制外层（共享嵌套对象）', inplace: '原地修改已发布对象' };
export const events = ['旧读者加载一次快照', '写者准备新版本', '写者更新嵌套路由；旧读者继续读取', '发布当前引用', '新读者加载并读取', '旧读者完成并释放引用'];
export function initial(strategy: Strategy = 'shallow'): Model {
  return { strategy, phase: 0, published: 'R1', roots: { R1: { version: 1, nested: 'N1' } }, nested: { N1: 'blue' }, writer: null, old: null, fresh: null, log: [] };
}
export function step(input: Model): Model {
  if (input.phase >= events.length) return input;
  const s: Model = structuredClone(input);
  if (s.phase === 0) s.old = { root: s.published, versionSeen: s.roots[s.published].version, backendSeen: null };
  if (s.phase === 1) {
    s.writer = s.strategy === 'inplace' ? 'R1' : 'R2';
    if (s.strategy !== 'inplace') s.roots.R2 = { version: 2, nested: s.strategy === 'deep' ? 'N2' : 'N1' };
    if (s.strategy === 'deep') s.nested.N2 = s.nested.N1;
  }
  if (s.phase === 2) {
    const root = s.roots[s.writer!];
    root.version = 2;
    s.nested[root.nested] = 'green';
    s.old!.backendSeen = s.nested[s.roots[s.old!.root].nested];
  }
  if (s.phase === 3) s.published = s.writer!;
  if (s.phase === 4) {
    const root = s.roots[s.published];
    s.fresh = { root: s.published, versionSeen: root.version, backendSeen: s.nested[root.nested] };
  }
  if (s.phase === 5) {
    s.old = null;
    if (s.published !== 'R1') delete s.roots.R1;
    const retained = new Set(Object.values(s.roots).map(root => root.nested));
    for (const key of Object.keys(s.nested)) if (!retained.has(key)) delete s.nested[key];
  }
  s.log.push(events[s.phase]); s.phase++;
  return s;
}
export function run(strategy: Strategy, until = 5): Model {
  let s = initial(strategy); for (let i = 0; i < until; i++) s = step(s); return s;
}
export function consistent(reader: Reader | null): boolean | null {
  if (!reader || reader.backendSeen === null) return null;
  return (reader.versionSeen === 1 && reader.backendSeen === 'blue') || (reader.versionSeen === 2 && reader.backendSeen === 'green');
}
