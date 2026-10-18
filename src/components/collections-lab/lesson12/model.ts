export type Descriptor = { start: number; length: number; capacity: number };
export type Operation = { kind: 'index'; index: number } | { kind: 'reslice'; low: number; high: number };
export type Result = { ok: boolean; descriptor: Descriptor; value?: number; reason: string; code: string };
export const storage = [65, 66, 0, 0, 0, 0];
export const initialDescriptor: Descriptor = { start: 0, length: 2, capacity: 4 };
export function validDescriptor(d: Descriptor, size = storage.length): boolean {
  return [d.start, d.length, d.capacity].every(Number.isInteger) && d.start >= 0 && d.length >= 0 && d.capacity >= d.length && d.start + d.capacity <= size;
}
export function descriptorCode(d: Descriptor): string {
  return `s := backing[${d.start}:${d.start + d.length}:${d.start + d.capacity}]`;
}
export function operate(d: Descriptor, op: Operation, backing: readonly number[] = storage): Result {
  if (!validDescriptor(d, backing.length)) throw new RangeError('非法切片描述符');
  if (op.kind === 'index') {
    const ok = Number.isInteger(op.index) && op.index >= 0 && op.index < d.length;
    return { ok, descriptor: { ...d }, value: ok ? backing[d.start + op.index] : undefined,
      code: `i := ${op.index}; value := s[i]`, reason: ok ? `0 ≤ ${op.index} < len(s)=${d.length}，读取 backing[${d.start + op.index}]=${backing[d.start + op.index]}。容量不参与索引检查。` : `索引要求 0 ≤ i < len(s)=${d.length}；i=${op.index} 越界，Go 运行时会 panic。cap=${d.capacity} 不能让这次访问合法。` };
  }
  const ok = Number.isInteger(op.low) && Number.isInteger(op.high) && 0 <= op.low && op.low <= op.high && op.high <= d.capacity;
  return { ok, descriptor: ok ? { start: d.start + op.low, length: op.high - op.low, capacity: d.capacity - op.low } : { ...d },
    code: `low, high := ${op.low}, ${op.high}; s = s[low:high]`, reason: ok ? `0 ≤ ${op.low} ≤ ${op.high} ≤ cap(s)=${d.capacity}；起点 +${op.low}，len=${op.high}-${op.low}=${op.high - op.low}，cap=${d.capacity}-${op.low}=${d.capacity - op.low}。底层数组未复制、未填入新数据。` : `重新切片要求 0 ≤ low ≤ high ≤ cap(s)=${d.capacity}；本次 [${op.low}:${op.high}] 不满足，Go 运行时会 panic，不会自动扩容。` };
}

