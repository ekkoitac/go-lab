export type RequestKind = 'normal' | 'slow' | 'missing';
export type Segment = {id: string; name: string; start: number; duration: number; kind: 'execute' | 'wait'; critical: boolean; log: string};
export type Trace = {duration: number; attempts: number; success: boolean; segments: Segment[]};
export function retryLimit(value: number): number {return Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 2;}
export function traceFor(kind: RequestKind, maxRetries = 2): Trace {
  const slow = kind !== 'normal';
  const retries = slow ? Math.min(2, retryLimit(maxRetries)) : 0;
  const inventoryDuration = 80 + retries * 200;
  const criticalInventory = inventoryDuration > 120;
  const segments: Segment[] = [{id: 'gateway', name: '入口处理', start: 0, duration: 20, kind: 'execute', critical: true, log: 'order.accepted：请求进入订单服务'}];
  for (let i = 0; i <= retries; i++) {
    const conflict = slow && i < 2;
    segments.push({id: `inventory-${i}`, name: `库存尝试 ${i + 1}`, start: 20 + i * 200, duration: 80, kind: 'execute', critical: criticalInventory, log: conflict ? `inventory.conflict：attempt=${i + 1}，库存版本冲突${i < retries ? '，进入退避' : '，重试预算耗尽'}` : `inventory.reserved：attempt=${i + 1}，预留成功`});
    if (i < retries) segments.push({id: `wait-${i}`, name: `重试退避 ${i + 1}`, start: 100 + i * 200, duration: 120, kind: 'wait', critical: true, log: `retry.scheduled：attempt=${i + 2}，backoff_ms=120，等待不等于 CPU 执行`});
  }
  segments.push({id: 'shipping', name: '运费查询（并行）', start: 20, duration: 120, kind: 'execute', critical: !criticalInventory, log: 'shipping.quote：耗时 120ms，与库存同时开始'});
  const duration = 20 + Math.max(inventoryDuration, 120) + 20;
  segments.push({id: 'finish', name: '汇合并响应', start: duration - 20, duration: 20, kind: 'execute', critical: true, log: slow && retries < 2 ? 'order.failed：库存冲突未恢复，返回失败' : 'order.completed：两个依赖已完成，返回成功'});
  return {duration, attempts: retries + 1, success: !slow || retries === 2, segments};
}
export function percentile(values: number[], quantile: number): number | null {
  if (!values.length) return null;
  if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) throw new RangeError('分位点须在 0 到 1 之间');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)];
}
export function metricsFor(maxRetries = 2) {
  const slow = traceFor('slow', maxRetries);
  const values = Array.from({length: 1000}, (_, i) => i < 20 ? slow.duration : 160);
  return {count: values.length, slowCount: 20, mean: values.reduce((a, b) => a + b, 0) / values.length, p99: percentile(values, .99)!, errors: slow.success ? 0 : 20};
}
export function visibleTrace(kind: RequestKind, retries: number): Trace | null {return kind === 'missing' ? null : traceFor(kind, retries);}
export function moveStage(stage: number, delta: number): number {return Math.max(0, Math.min(3, stage + delta));}
