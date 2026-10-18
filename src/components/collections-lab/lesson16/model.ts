export type Config = { srcLength: number; dstLength: number; capacity: number };
export const baseline: Config = { srcLength: 3, dstLength: 0, capacity: 3 };
export function copyCount(srcLength: number, dstLength: number) {
  if (![srcLength, dstLength].every(n => Number.isInteger(n) && n >= 0)) throw new Error('长度必须是非负整数');
  return Math.min(srcLength, dstLength);
}
export function snapshot(config: Config, phase: number) {
  const { srcLength, dstLength, capacity } = config;
  const count = copyCount(srcLength, dstLength);
  if (!Number.isInteger(capacity) || capacity < dstLength || capacity > 8 || srcLength > 8) throw new Error('模型长度或容量越界');
  const finalPhase = count + 1 + (dstLength > 0 ? 1 : 0);
  if (!Number.isInteger(phase) || phase < 0 || phase > finalPhase) throw new Error('阶段越界');
  const src = Array.from({ length: srcLength }, (_, i) => (i + 1) * 3);
  const storage = Array<number>(capacity).fill(0);
  const copied = Math.min(phase, count);
  for (let i = 0; i < copied; i++) storage[i] = src[i];
  const edited = phase === count + 2;
  if (edited) storage[0] = 99;
  const complete = phase >= count + 1;
  return { ...config, src, dst: storage.slice(0, dstLength), storage, count, copied, phase, finalPhase, complete, edited, returned: complete ? count : null, operation: phase === 0 ? 'make 已完成，copy 尚未执行' : edited ? 'dst[0] = 99：只写入独立数组 B' : complete ? `copy 返回 ${count}，两个切片长度不变` : `复制第 ${copied} 项：A[${copied - 1}] → B[${copied - 1}]` };
}
export function overlap(direction: 'right' | 'left', phase: number) {
  const initial = [2, 4, 6, 8];
  if (!Number.isInteger(phase) || phase < 0 || phase > 3) throw new Error('阶段越界');
  const source = direction === 'right' ? initial.slice(0, 3) : initial.slice(1);
  const array = [...initial];
  for (let i = 0; i < phase; i++) array[i + (direction === 'right' ? 1 : 0)] = source[i];
  return { direction, phase, source, array, returned: phase === 3 ? 3 : null };
}
export function pointerCopy(action: 'none' | 'edit' | 'replace') {
  return { src: ['X', 'Y'], dst: [action === 'replace' ? 'Z' : 'X', 'Y'], objects: { X: action === 'edit' ? 99 : 3, Y: 6, Z: 12 } };
}
