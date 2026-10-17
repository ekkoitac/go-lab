export type Policy = 'data-first' | 'error-first';
export type ReadError = 'EOF' | 'network' | null;
export interface ReadInput { bytes: string; n: number; error: ReadError }
export const cases: Record<string, ReadInput> = {
  final: {bytes:'XYZ?',n:3,error:'EOF'},
  partial: {bytes:'AB??',n:2,error:'network'},
  empty: {bytes:'????',n:0,error:null},
  eof: {bytes:'????',n:0,error:'EOF'},
  normal: {bytes:'OK??',n:2,error:null},
};
export function readState(input: ReadInput, policy: Policy, step: number) {
  if (!Number.isInteger(input.n) || input.n < 0 || input.n > input.bytes.length || !/^[\x20-\x7e]*$/.test(input.bytes)) throw new Error('本模型只接受 ASCII 字节且 0 ≤ n ≤ len(p)');
  const phase = Math.max(0, Math.min(3, Math.floor(step)));
  const processed = policy === 'data-first' ? phase >= 2 : phase >= 3 && input.error === null;
  const checked = policy === 'error-first' ? phase >= 2 : phase >= 3;
  const saved = processed ? input.bytes.slice(0,input.n) : '';
  const status = checked && input.error ? input.error === 'EOF' ? 'eof' : 'error' : phase === 3 ? input.n === 0 ? 'no-progress' : 'continue' : 'running';
  const lost = checked && input.error && !processed ? input.bytes.slice(0,input.n) : '';
  return {phase, policy, n:input.n, error:input.error, saved, lost, status, processed, checked};
}
