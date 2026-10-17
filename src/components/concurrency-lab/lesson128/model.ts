export interface Config128 { outside: boolean; sharded: boolean; sameKey: boolean; validate: boolean; delay: number }
export const default128: Config128 = { outside: true, sharded: false, sameKey: false, validate: false, delay: 4 };
export const stages128 = ['请求尚未进入', 'A 锁内读取版本', 'A 回源；B 与更新者到达', '网络仍未返回', 'A 尝试提交回源结果', '等待者继续执行'];
export function model128(config: Config128, inputStep: number) {
  const step = Math.max(0, Math.min(5, Math.floor(inputStep)));
  const delay = Math.max(1, Math.min(8, Math.round(config.delay)));
  const blocksB = !config.outside && (!config.sharded || config.sameKey);
  const inFlight = step >= 2 && step <= 3;
  const committed = step >= 4;
  const conflictingUpdate = config.outside && step >= 2;
  const version = committed ? (config.outside && config.validate ? 2 : 3) : conflictingUpdate ? 2 : 1;
  const value = committed ? (config.outside && !config.validate ? '旧回源结果' : '新业务值') : conflictingUpdate ? '新业务值' : '原始值';
  const bStatus = step < 2 ? '未到达' : blocksB && step < 5 ? '等待锁' : '读取完成';
  const result = !committed ? '尚未提交' : config.outside ? config.validate ? '版本 1 ≠ 2，丢弃旧结果' : '未检查版本，覆盖了新业务值' : '先提交回源结果，再执行等待中的业务更新';
  return { step, config: { ...config, delay }, stage: stages128[step], snapshot: step >= 1 ? 1 : null, version, value, bStatus, waitUnits: step >= 3 && blocksB ? delay : 0, lock: step === 1 || (inFlight && !config.outside) ? 'A 持有' : '空闲', updater: step < 2 ? '未到达' : !config.outside && !committed ? '等待 A 释放锁' : '新业务值已写入', result, stale: committed && config.outside && !config.validate };
}
export function compare128(config: Config128, step: number) {
  return { baseline: model128({ ...config, outside: false, sharded: false }, step), candidate: model128(config, step) };
}
