export type KeyMode = 'id' | 'joined' | 'tuple';
export type Operation = 'writeA' | 'writeB' | 'readA' | 'readB' | 'invalidateA';
export type Outcome = 'written' | 'overwritten' | 'own' | 'foreign' | 'miss' | 'removed' | 'unchanged' | 'denied';
export type RecordValue = {tenant: string; id: string; value: string};
export type CacheState = {entries: Record<string, RecordValue>; message: string; outcome: Outcome | null; key: string | null};
export type Config = {write: KeyMode; read: KeyMode; invalidate: KeyMode; boundary: boolean; actor: 'A' | 'B'; authorize: boolean};
export const initialConfig: Config = {write: 'id', read: 'id', invalidate: 'id', boundary: false, actor: 'A', authorize: true};
export const emptyCache = (): CacheState => ({entries: {}, message: '缓存为空。先写入，再读取或失效，追踪同一个键。', outcome: null, key: null});
export const keyOf = (record: Pick<RecordValue, 'tenant' | 'id'>, mode: KeyMode): string => mode === 'id' ? record.id : mode === 'joined' ? `${record.tenant}:${record.id}` : JSON.stringify([record.tenant, record.id]);
export function records(boundary: boolean): [RecordValue, RecordValue] {
  return boundary ? [{tenant: 'a:b', id: 'c', value: 'A 的发票'}, {tenant: 'a', id: 'b:c', value: 'B 的发票'}] : [{tenant: 'A', id: '42', value: 'A 的发票'}, {tenant: 'B', id: '42', value: 'B 的发票'}];
}
export function execute(state: CacheState, config: Config, operation: Operation): CacheState {
  const target = records(config.boundary)[operation.endsWith('B') ? 1 : 0];
  const path = operation.startsWith('write') ? 'write' : operation.startsWith('read') ? 'read' : 'invalidate';
  const key = keyOf(target, config[path]);
  const entries = {...state.entries};
  // Writes stand for trusted background cache fills. User reads/invalidation require authorization.
  if (path !== 'write' && config.authorize && target.tenant !== records(config.boundary)[config.actor === 'A' ? 0 : 1].tenant) {
    return {...state, outcome: 'denied', key: null, message: '授权拒绝：可信主体无权访问目标租户；未接触缓存。'};
  }
  const previous = entries[key];
  if (path === 'write') {
    entries[key] = target;
    return {entries, key, outcome: previous ? 'overwritten' : 'written', message: previous ? `写入 ${key}：${previous.value} → ${target.value}，原值被覆盖。` : `写入 ${key}：空槽 → ${target.value}。`};
  }
  if (path === 'invalidate') {
    delete entries[key];
    return {entries, key, outcome: previous ? 'removed' : 'unchanged', message: previous ? `失效 ${key}：删除了 ${previous.value}。` : `失效 ${key}：键不存在，缓存未变化；检查写入与失效是否采用同一规则。`};
  }
  return {entries, key, outcome: !previous ? 'miss' : previous.tenant === target.tenant && previous.id === target.id ? 'own' : 'foreign', message: !previous ? `读取 ${key}：未命中。本模型停在缓存边界，不模拟数据库回源。` : `读取 ${key}：得到 ${previous.value}；${previous.tenant === target.tenant && previous.id === target.id ? '与目标资源一致。' : '与目标资源不符，发生串数据。'}`};
}
export const outcomeLabels: Record<Outcome, string> = {written: '新增缓存槽', overwritten: '覆盖已有值', own: '读到目标资源', foreign: '读到其他资源', miss: '未命中', removed: '删除已有缓存', unchanged: '没有删除任何缓存', denied: '授权拒绝'};
