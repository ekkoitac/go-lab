export type Attempts = [number, number, number];
export type Config = {attempts: Attempts; successAt: number};
export type Leaf = {gateway: number; service: number; client: number; ordinal: number};
export type Timeline = {config: Config; cursor: number};
export const defaults: Config = {attempts: [3, 3, 3], successAt: 0};
export function normalize(config: Config): Config {
  return {attempts: config.attempts.map(n => Math.max(1, Math.min(4, Math.floor(n) || 1))) as Attempts,
    successAt: Math.max(0, Math.floor(config.successAt) || 0)};
}
export function leaves(config: Config): Leaf[] {
  const [g, s, c] = normalize(config).attempts, result: Leaf[] = [];
  for (let gateway = 1; gateway <= g; gateway++) for (let service = 1; service <= s; service++) for (let client = 1; client <= c; client++) {
    result.push({gateway, service, client, ordinal: result.length + 1});
  }
  return result;
}
export function initial(config: Config = defaults): Timeline {return {config: normalize(config), cursor: 0};}
export function inspect(timeline: Timeline) {
  const tree = leaves(timeline.config), successAt = timeline.config.successAt;
  const limit = successAt > 0 ? Math.min(successAt, tree.length) : tree.length;
  const count = Math.max(0, Math.min(timeline.cursor, limit));
  const visited = tree.slice(0, count), current = visited.at(-1) ?? null, previous = visited.at(-2);
  const succeeded = successAt > 0 && count === successAt;
  const done = count === limit;
  const gatewayCalls = new Set(visited.map(l => l.gateway)).size;
  const serviceCalls = new Set(visited.map(l => `${l.gateway}.${l.service}`)).size;
  let note = '尚未访问数据库。下一步从网关第 1 次 → 服务第 1 次 → 客户端第 1 次开始。';
  if (current) {
    const cause = !previous ? '首次调用展开三层链路' : previous.gateway !== current.gateway ? '上一轮网关内的全部服务尝试失败；网关再试，整条下游链重新开始' : previous.service !== current.service ? '客户端预算耗尽；服务再次调用客户端，客户端预算从 1 重新开始' : '上次底层失败；客户端仍有预算，再访问一次';
    note = `${cause}。数据库计数 ${count - 1} → ${count}。${succeeded ? '本次成功，逐层返回，剩余分支全部跳过。' : done ? '本次仍失败，所有层预算耗尽，向用户返回失败。' : '本次失败，下一步沿尚有预算的最近一层继续。'}`;
  }
  return {tree, count, current, limit, upperBound: tree.length, done, succeeded, gatewayCalls, serviceCalls, note};
}
export function step(timeline: Timeline): Timeline {return {...timeline, cursor: Math.min(timeline.cursor + 1, inspect(timeline).limit)};}
export function back(timeline: Timeline): Timeline {return {...timeline, cursor: Math.max(0, timeline.cursor - 1)};}
export function finish(config: Config) {const t = initial(config); return inspect({...t, cursor: leaves(config).length});}
export function repair(config: Config): Config {return {...normalize(config), attempts: [1, normalize(config).attempts[1], 1]};}
