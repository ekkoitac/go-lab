export type Target = 'cpu' | 'network';
export type Config = { cpu: number; target: Target; speedup: number };
export const defaults: Config = { cpu: 10, target: 'cpu', speedup: 2 };
export function costs(config: Config) {
  if (!Number.isFinite(config.cpu) || config.cpu < 0 || config.cpu > 100 || !Number.isFinite(config.speedup) || config.speedup < 1) throw new Error('成本占比应为 0–100，加速倍数至少为 1');
  const before = { cpu: config.cpu, network: 100 - config.cpu };
  const after = { ...before, [config.target]: before[config.target] / config.speedup };
  const total = after.cpu + after.network;
  return { before, after, total, saved: 100 - total, unaffected: 100 - before[config.target], speedup: 100 / total };
}
export function snapshot(config: Config, step: number) {
  const result = costs(config);
  const cursor = Math.max(0, Math.min(3, Math.floor(step)));
  return { step: cursor, ...config, observed: cursor >= 2 ? result.after : result.before, total: cursor >= 2 ? result.total : 100, revealed: cursor >= 2, verified: cursor === 3 };
}
export function predictionMatches(prediction: string, actual: number) {
  return prediction.trim() !== '' && Number.isFinite(Number(prediction)) && Math.abs(Number(prediction) - actual) < 0.051;
}
