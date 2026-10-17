export type Wrap = 'v' | 'w';
export type Labels = 'stage' | 'order';
export type Config = { wrap: Wrap; labels: Labels; requests: number; slow: 'inventory' | 'payment' };
export const initialConfig: Config = { wrap: 'v', labels: 'stage', requests: 4, slow: 'inventory' };
export type Observation = { phase: number; text: string; errorChain: string[]; isTimeout: boolean | null; series: { label: string; count: number }[]; spans: { name: string; start: number; duration: number }[] };
export function observe(config: Config, phase: number): Observation {
  const p = Math.max(0, Math.min(4, Math.floor(phase)));
  const text = p >= 2 ? 'load order-7: timeout' : p >= 1 ? 'timeout' : '';
  const counts = new Map<string, number>();
  if (p >= 3) for (let i = 0; i < config.requests; i++) {
    const label = config.labels === 'order' ? `order-${7 + i}` : 'load';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const inventory = config.slow === 'inventory' ? 90 : 10;
  const payment = config.slow === 'payment' ? 90 : 10;
  return {
    phase: p, text,
    errorChain: p < 1 ? [] : p === 1 ? ['timeout sentinel'] : config.wrap === 'w' ? [text, 'timeout sentinel'] : [text],
    isTimeout: p < 2 ? null : config.wrap === 'w',
    series: [...counts].map(([label, count]) => ({ label, count })),
    spans: p < 4 ? [] : [{ name: 'request', start: 0, duration: 110 }, { name: 'inventory', start: 5, duration: inventory }, { name: 'payment', start: 5 + inventory, duration: payment }],
  };
}
export const explanations = [
  '先预测：增加上下文之后，errors.Is 能否找到同一个 timeout 哨兵？',
  '依赖返回 timeout 哨兵。现在只有原因，还没有请求与操作上下文。',
  '两种格式的错误文本完全相同；%w 额外保存可解包的原因，%v 只留下文字。',
  '相同事件被聚合成计数。标签组合决定序列数，订单号越多，新增组合越多。',
  '同一请求的 span 按父子关系连接起来，阶段耗时可定位慢点；这不会修复丢失的错误链。',
];
