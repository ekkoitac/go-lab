export type Strategy = 'slice' | 'limited' | 'copy';
export interface Config { size: number; keep: number; strategy: Strategy; other: boolean }
export interface Snapshot {
  step: number; source: boolean; other: boolean; cache: 'none' | 'large' | 'small';
  largeReachable: boolean; retainedBytes: number; copyBytes: number; allocatedBytes: number;
  len: number; cap: number; event: string;
}
export const initialConfig: Config = { size: 1024, keep: 4, strategy: 'limited', other: false };
export const stages = ['建立原缓冲', '缓存前缀', '释放 data 引用', '释放其他持有者', '清空缓存'];
export function buildTrace(c: Config): Snapshot[] {
  if (!Number.isInteger(c.size) || !Number.isInteger(c.keep) || c.keep <= 0 || c.keep > c.size) throw new Error('需要 0 < keep <= size 的整数字节数');
  return stages.map((_, step) => {
    const source = step < 2;
    const other = c.other && step < 3;
    const cache = step === 0 || step === 4 ? 'none' : c.strategy === 'copy' ? 'small' : 'large';
    const largeReachable = source || other || cache === 'large';
    const copied = step >= 1 && c.strategy === 'copy' ? c.keep : 0;
    const retainedBytes = (largeReachable ? c.size : 0) + (cache === 'small' ? c.keep : 0);
    const event = step === 0 ? `data${c.other ? ' 和其他持有者' : ''} 指向 ${c.size} B 原数组。`
      : step === 1 ? c.strategy === 'copy' ? `新建 ${c.keep} B 数组并复制 ${c.keep} B；原 data 还活着，因此此刻两个数组都可达。` : `缓存指向原数组；${c.strategy === 'limited' ? '三索引仅把 cap 限为 ' + c.keep : 'cap 为 ' + c.size}，没有复制字节。`
      : step === 2 ? largeReachable ? `data 已移除，但${other ? '其他持有者' : '缓存'}仍指向原数组，所以原数组依然可达。` : `data 已移除，原数组再无可达引用；缓存只保留独立的 ${c.keep} B 数组。`
      : step === 3 ? largeReachable ? '其他持有者已移除，但缓存仍指向原数组；缩短 len/cap 没有切断这条边。' : '原数组已无可达引用，满足本模型的可回收条件；实际回收时间由运行时决定。'
      : '缓存引用也已移除，所有已分配数组都不可达；此前发生的复制和分配成本不会因此消失。';
    return { step, source, other, cache, largeReachable, retainedBytes, copyBytes: copied, allocatedBytes: c.size + copied, len: cache === 'none' ? 0 : c.keep, cap: cache === 'none' ? 0 : c.strategy === 'slice' ? c.size : c.keep, event };
  });
}

