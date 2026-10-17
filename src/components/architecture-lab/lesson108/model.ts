export type Strategy = 'explicit' | 'generated' | 'runtime';
export type Node = 'DB' | 'Client' | 'Service';
export type Config = { strategy: Strategy; missingClient: boolean; cycle: boolean; failAt: 'none' | 'Client' | 'Service'; cleanup: boolean };
export const defaults: Config = { strategy: 'explicit', missingClient: false, cycle: false, failAt: 'Client', cleanup: true };
export const strategyNames: Record<Strategy, string> = { explicit: '显式构造', generated: '生成式装配', runtime: '运行时容器' };
export type Graph = Record<Node, Node[] | null>;
export function graph(config: Config): Graph { return { DB: config.cycle ? ['Service'] : [], Client: config.missingClient ? null : [], Service: ['DB', 'Client'] }; }
export type Issue = { kind: 'missing' | 'cycle'; path: Node[] };
export function validate(dependencies: Graph): Issue | null {
  const complete = new Set<Node>();
  function visit(node: Node, path: Node[]): Issue | null {
    if (path.includes(node)) return { kind: 'cycle', path: [...path, node] };
    const children = dependencies[node];
    if (children === null) return { kind: 'missing', path: [...path, node] };
    if (complete.has(node)) return null;
    for (const child of children) { const issue = visit(child, [...path, node]); if (issue) return issue; }
    complete.add(node);
    return null;
  }
  return visit('Service', []);
}
export function detectionStage(config: Config): string {
  const issue = validate(graph(config));
  if (!issue) return config.failAt === 'none' ? '无失败' : '启动期构造';
  if (config.strategy === 'generated') return '生成期图验证';
  if (config.strategy === 'runtime') return '启动期图解析';
  return issue.kind === 'missing' ? '编译期：缺失构造函数' : '装配计划审查';
}
export type Frame = { stage: string; message: string; active: Node[]; closed: Node[]; built: Node[]; failed: boolean; running: boolean; done: boolean };
export function timeline(config: Config): Frame[] {
  const frames: Frame[] = [];
  let current: Frame = { stage: '待验证', message: '先检查构造图，再获取资源。箭头表示「需要」。', active: [], closed: [], built: [], failed: false, running: false, done: false };
  const add = (patch: Partial<Frame>) => { current = { ...current, ...patch }; frames.push(current); };
  add({});
  const issue = validate(graph(config));
  if (issue) {
    add({ stage: detectionStage(config), message: `${issue.kind === 'missing' ? '缺少提供者' : '依赖环'}：${issue.path.join(' → ')}。无法排出构造顺序，本轮尚未打开资源。`, failed: true, done: true });
    return frames;
  }
  add({ stage: config.strategy === 'generated' ? '生成构造代码' : config.strategy === 'runtime' ? '启动期解析通过' : '装配计划检查通过', message: '构造顺序为 DB、Client、Service。图正确不代表网络配置有效。' });
  for (const node of ['DB', 'Client', 'Service'] as Node[]) {
    if (config.failAt === node) {
      add({ stage: '启动期构造', message: `${node} 构造失败：${node === 'Client' ? '外部服务地址不可达' : '服务启动检查拒绝配置'}。只有成功获取的资源进入清理栈。`, failed: true });
      break;
    }
    add({ stage: '启动期构造', message: `${node} 构造成功${node === 'Service' ? '，接收已建好的 DB 与 Client' : '，装配点取得资源所有权并压入清理栈'}。`, built: [...current.built, node], active: node === 'Service' ? current.active : [...current.active, node] });
  }
  if (!current.failed) add({ stage: '运行中', message: '服务已就绪；下一步触发退出，装配点负责关闭资源。', running: true });
  add({ stage: current.failed ? '失败回滚' : '退出清理', message: config.cleanup ? '按成功获取的逆序调用清理函数。' : '未登记清理职责：资源仍处于打开状态。', running: false });
  if (config.cleanup) {
    for (const node of [...current.active].reverse()) add({ message: `关闭 ${node}；从清理栈弹出。`, active: current.active.filter(item => item !== node), closed: [...current.closed, node] });
  }
  add({ stage: '结束', done: true, message: current.active.length ? `本轮结束仍遗留 ${current.active.length} 个资源：${current.active.join('、')}。补上集中清理后重跑。` : '本轮结束，已成功获取的资源全部关闭。' });
  return frames;
}
export type LabState = { config: Config; phase: number };
export function initial(config: Config = defaults): LabState { return { config: { ...config }, phase: 0 }; }
export function inspect(state: LabState): Frame { const frames = timeline(state.config); return frames[Math.max(0, Math.min(state.phase, frames.length - 1))]; }
export function advance(state: LabState): LabState { return { ...state, phase: Math.min(state.phase + 1, timeline(state.config).length - 1) }; }
export function rewind(state: LabState): LabState { return { ...state, phase: Math.max(0, state.phase - 1) }; }
