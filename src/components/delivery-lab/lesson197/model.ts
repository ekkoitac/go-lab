export type Strategy = 'shared' | 'snapshot';
export type Config = {strategy: Strategy; limit: number; burst: number; parseError: boolean; endpoint: 'db-a' | 'db-b'};
export type Snapshot = {version: number; limit: number; burst: number; endpoint: string};
export const defaults: Config = {strategy: 'shared', limit: -1, burst: 8, parseError: false, endpoint: 'db-b'};
export const stages = ['请求 A 持有 v1', '解析输入 / 写 Limit', '准备完整候选 / 写 Burst', '完整校验', '发布或拒绝', '请求 B 读取'] as const;
export const baseline = (): Snapshot => ({version: 1, limit: 2, burst: 4, endpoint: 'db-a'});
export function validate(value: Pick<Snapshot, 'limit' | 'burst'>): string[] {
 const errors: string[] = [];
 if (!Number.isInteger(value.limit) || value.limit < 1 || value.limit > 100) errors.push('Limit 必须是 1～100 的整数');
 if (!Number.isInteger(value.burst) || value.burst < 1 || value.burst > 100) errors.push('Burst 必须是 1～100 的整数');
 if (value.burst < value.limit) errors.push('Burst 必须大于等于 Limit（跨字段约束）');
 return errors;
}
export function frame(config: Config, at: number, resourceSwitched = false) {
 const stage = Math.min(5, Math.max(0, Math.trunc(at)));
 const old = baseline();
 const candidate: Snapshot = {version: 2, limit: config.limit, burst: config.burst, endpoint: config.endpoint};
 const errors = config.parseError ? ['JSON 解析失败；没有可发布候选'] : validate(candidate);
 const accepted = stage >= 4 && errors.length === 0;
 let current = {...old};
 if (config.strategy === 'shared' && !config.parseError) {
  if (stage >= 1) current.limit = config.limit;
  if (stage >= 2) { current.burst = config.burst; current.endpoint = config.endpoint; }
  if (accepted) current.version = 2;
 } else if (config.strategy === 'snapshot' && accepted) current = {...candidate};
 const requestA = config.strategy === 'shared' ? {...current} : {...old};
 const resource = resourceSwitched && accepted ? current.endpoint : old.endpoint;
 const phaseNotes = config.strategy === 'snapshot' ? [
  '请求 A 只加载一次 v1 指针；其 Limit=2、Burst=4。',
  config.parseError ? '解析失败：独立候选未建立，已发布快照仍为 v1。' : '在私有候选中解析输入，读者仍然只能读 v1。',
  config.parseError ? '没有候选；跳过构造。v1 保持有效。' : '候选 v2 完整，但尚未验证，不允许新请求读取它。',
  errors.length ? `校验拒绝：${errors.join('；')}。v1 不受影响。` : '所有字段及跨字段约束通过；当前仍是 v1。',
  accepted ? '一次原子交换：current 指向 v2；请求 A 仍指向 v1。' : '拒绝发布：保留最后有效 v1，未污染旧请求。',
  accepted ? '请求 B 加载 v2；请求 A 继续使用 v1。连接池仍需独立切换。' : '请求 B 仍读取有效 v1；失败原因留在记录中。',
 ] : [
  '请求 A 指向共享对象，初始 Limit=2、Burst=4。',
  config.parseError ? '本模型将语法错误视为写入前失败；共享对象未改动。' : '只写 Limit：请求可以读到新 Limit 与旧 Burst 的组合。',
  config.parseError ? '解析中止，没有字段写入。' : 'Burst 和地址也写入共享对象，校验前已经暴露候选值。',
  errors.length ? `校验失败：${errors.join('；')}。已经写入的共享字段不会自动回滚。` : '校验成功，但前面的半更新窗口已经存在。',
  accepted ? '标记 v2；请求 A 所引用的对象也已改变，无法保持原始视图。' : '更新返回错误，但共享对象可能已污染；错误返回不恢复旧配置。',
  '请求 B 读取当前共享对象；与请求 A 一样可能看到污染后的值。',
 ];
 return {stage, current, requestA, requestB: stage === 5 ? {...current} : null, candidate: stage >= 2 && !config.parseError ? candidate : null, errors: stage >= 3 ? errors : [], validation: stage < 3 ? 'pending' : errors.length ? 'rejected' : 'valid', accepted, resource, resourceMatches: resource === current.endpoint, halfUpdated: config.strategy === 'shared' && stage === 1 && !config.parseError && config.limit !== old.limit, note: phaseNotes[stage]};
}
export function aliasExample(deepCopy: boolean, mutation: number) {
 const old = {limits: {guest: 2}};
 const next = {limits: deepCopy ? {...old.limits} : old.limits};
 next.limits.guest = mutation;
 return {old: old.limits.guest, next: next.limits.guest, shared: next.limits === old.limits};
}
export type ProtocolAction = 'parse' | 'validate' | 'publish';
export function protocol(actions: ProtocolAction[], invalid: boolean) {
 let parsed = false; let valid = false; let current = 2; const events: string[] = [];
 for (const action of actions) {
  if (action === 'parse') { parsed = true; valid = false; events.push('私有候选建立，Limit=' + (invalid ? '-3' : '7')); }
  if (action === 'validate') { valid = parsed && !invalid; events.push(!parsed ? '没有候选，无法校验' : invalid ? '校验拒绝负数；候选不能发布' : '完整校验通过'); }
  if (action === 'publish') {
   if (parsed && valid) {current = 7; events.push('原子发布 v2，旧引用保留 2');}
   else events.push('发布门禁拦截：需要完整且通过校验的候选');
  }
 }
 return {parsed, valid, current, events};
}
