export type Strategy = 'direct' | 'data' | 'port' | 'merge';
export type Payload = 'minimal' | 'full';
export type Config = { strategy: Strategy; payload: Payload; sameConcept: boolean };
export type Edge = { from: string; to: string; why: string };
export const initialConfig: Config = { strategy: 'direct', payload: 'minimal', sameConcept: false };
export const strategyNames: Record<Strategy, string> = { direct: '保留相互导入', data: '移动消息数据', port: '订单侧定义端口', merge: '重新合并职责' };
export function findCycle(edges: Edge[]): string[] {
  const done = new Set<string>();
  const path: string[] = [];
  function visit(node: string): string[] {
    const index = path.indexOf(node);
    if (index >= 0) return [...path.slice(index), node];
    if (done.has(node)) return [];
    path.push(node);
    for (const e of edges.filter(edge => edge.from === node)) {
      const cycle = visit(e.to);
      if (cycle.length) return cycle;
    }
    path.pop(); done.add(node); return [];
  }
  for (const node of new Set(edges.flatMap(e => [e.from, e.to]))) {
    const cycle = visit(node); if (cycle.length) return cycle;
  }
  return [];
}
export function inspect(config: Config) {
  const edges: Edge[] = [];
  const add = (from: string, to: string, why: string) => edges.push({ from, to, why });
  if (config.strategy === 'merge') add('main', 'fulfillment', '装配合并后的订单通知职责');
  else {
    add('main', 'order', '创建订单用例');
    if (config.strategy === 'direct') {
      add('order', 'notification', '直接调用具体通知实现');
      add('notification', 'order', '从订单类型拼装消息');
    } else if (config.strategy === 'data') {
      add('order', 'notification', '仍直接调用具体渠道');
      add('order', 'message', '构造消息数据');
      add('notification', 'message', '读取消息数据');
      if (config.payload === 'full') add('message', 'order', '消息保留 *order.Service，反向引用订单');
    } else {
      add('main', 'notification', '把通知实现注入订单');
      add('notification', 'order', 'Notify 接收 order.Result，满足订单定义的端口');
      if (config.payload === 'full') add('order', 'notification', '端口参数泄漏 notification.Envelope');
    }
  }
  const cycle = findCycle(edges);
  const builds = cycle.length === 0;
  const independent = config.strategy === 'port' && config.payload === 'minimal';
  const fits = builds && (config.sameConcept ? config.strategy === 'merge' : independent);
  const runtime = !builds ? [] : config.strategy === 'merge'
    ? ['main', 'fulfillment.Place', 'fulfillment.Send']
    : config.strategy === 'port' ? ['main 注入', 'order.Place', 'order.Notifier.Notify', 'notification.Send']
      : ['main', 'order.Place', 'notification.Send'];
  const advice = !builds ? `导入路径闭环：${cycle.join(' → ')}。修改数据或依赖方向后重新检查。`
    : config.strategy === 'data' ? '可编译，但 order 仍导入 notification；移动数据只修复了环，未隔离渠道实现。'
      : config.strategy === 'merge' ? config.sameConcept ? '在同一概念、共同变化的假设下，合并移除了人为包边界。' : '可编译，但订单与渠道被放在同一职责包，独立变化仍相互牵连。'
        : config.sameConcept ? '端口消除了环，但两部分若持续共同变化，还应比较合并能否减少无意义边界。' : '订单仅依赖自己的需求；通知适配器实现端口，main 完成装配。';
  return { ...config, edges, cycle, builds, independent, fits, runtime, advice, fields: config.payload === 'minimal' ? ['ID', 'Result'] : ['ID', 'Result', 'Service / Envelope 实现引用'] };
}
