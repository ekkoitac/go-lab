export type Scope = 'outer' | 'iteration';
export type Phase = 'open' | 'register' | 'process' | 'iterationReturn' | 'outerReturn' | 'close' | 'done';
export interface Config { total: number; limit: number; scope: Scope }
export interface State extends Config {
  phase: Phase; file: number; open: number[]; deferred: number[]; closed: number[];
  processed: number; peak: number; failedAt: number | null; returning: Scope | null; event: string; step: number;
}
export const scopeName = (scope: Scope) => scope === 'outer' ? '批次函数内 defer' : '每轮独立函数内 defer';
export function initial(config: Config): State {
  if (![config.total, config.limit].every(n => Number.isInteger(n) && n >= 1 && n <= 8)) throw new RangeError('文件数和资源上限须为 1–8 的整数');
  return { ...config, phase: 'open', file: 1, open: [], deferred: [], closed: [], processed: 0, peak: 0, failedAt: null, returning: null, event: '批次函数开始；还没有打开任何文件。', step: 0 };
}
export function advance(state: State): State {
  if (state.phase === 'done') return state;
  const s = { ...state, open: [...state.open], deferred: [...state.deferred], closed: [...state.closed], step: state.step + 1 };
  switch (s.phase) {
    case 'open':
      if (s.open.length === s.limit) {
        s.failedAt = s.file; s.phase = 'outerReturn';
        s.event = `打开 F${s.file} 失败：已有 ${s.open.length} 个句柄占满上限 ${s.limit}。本模型遇到打开错误后返回批次函数。`;
      } else {
        s.open.push(s.file); s.peak = Math.max(s.peak, s.open.length); s.phase = 'register';
        s.event = `打开 F${s.file} 成功：打开数 ${s.open.length}，峰值 ${s.peak}。`;
      }
      break;
    case 'register':
      s.deferred.push(s.file); s.phase = 'process';
      s.event = `为 F${s.file} 注册 Close，归属于${s.scope === 'outer' ? '批次函数' : '当前单文件函数'}；注册不等于执行，句柄仍打开。`;
      break;
    case 'process':
      s.processed++;
      s.phase = s.scope === 'iteration' ? 'iterationReturn' : s.file === s.total ? 'outerReturn' : 'open';
      s.event = `F${s.file} 处理完成，循环体结束。${s.scope === 'outer' ? '批次函数还没返回，所以 Close 尚未执行。' : '下一步返回单文件函数，触发它的 defer。'}`;
      if (s.scope === 'outer' && s.file < s.total) s.file++;
      break;
    case 'iterationReturn':
      s.returning = 'iteration'; s.phase = 'close';
      s.event = `单文件函数 F${s.file} 开始返回：它注册的 defer 现在可以执行。`;
      break;
    case 'outerReturn':
      s.returning = 'outer'; s.phase = s.deferred.length ? 'close' : 'done';
      s.event = `批次函数开始返回：${s.deferred.length ? `按后进先出执行剩余 ${s.deferred.length} 个 Close。` : '没有等待执行的 Close。'}`;
      break;
    case 'close': {
      const id = s.deferred.pop();
      if (id === undefined) throw new Error('Close 必须对应已注册的 defer');
      s.open = s.open.filter(n => n !== id); s.closed.push(id);
      s.event = `执行 F${id}.Close()：打开数降为 ${s.open.length}。${s.returning === 'iteration' ? '本轮函数结束后才进入下一轮。' : '最后注册的 Close 最先执行。'}`;
      if (s.returning === 'iteration') {
        s.returning = null;
        if (s.file === s.total) s.phase = 'outerReturn';
        else { s.file++; s.phase = 'open'; }
      } else s.phase = s.deferred.length ? 'close' : 'done';
      break;
    }
  }
  return s;
}
export function timeline(config: Config): State[] {
  const frames = [initial(config)];
  while (frames.at(-1)!.phase !== 'done') frames.push(advance(frames.at(-1)!));
  return frames;
}
export interface Prediction { outcome: 'complete' | 'limit'; peak: number; reason: string }
export function feedback(prediction: Prediction, result: State): { correct: boolean; text: string } {
  const actual = result.failedAt === null ? 'complete' : 'limit';
  const correct = prediction.outcome === actual && prediction.peak === result.peak;
  return { correct, text: `${correct ? '结果和峰值都吻合。' : '预测与结果有差异。'}你预测${prediction.outcome === 'complete' ? '全部完成' : '触及上限失败'}、峰值 ${prediction.peak}；实际${result.failedAt === null ? `完成 ${result.processed} 个文件` : `在 F${result.failedAt} 打开时失败，只完成 ${result.processed} 个文件`}、峰值 ${result.peak}。${result.scope === 'outer' ? '循环体结束不会执行批次函数的 defer，句柄会跨轮保留。' : '每轮独立函数返回时执行 Close，所以串行处理的峰值为 1。'}最终打开数 ${result.open.length} 与处理期间的峰值不同。` };
}
