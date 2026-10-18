export type Source = 'empty' | 'problem';
export type Policy = 'pointer' | 'guard' | 'discard';
export type Method = 'constant' | 'dereference';
export type Config = { source: Source; policy: Policy; method: Method };
export type Envelope = { type: null; value: null } | { type: '*Problem'; value: 'nil' | 'object' };
export type CallOutcome = 'skipped' | 'returned' | 'panic';
export const initial: Config = { source: 'empty', policy: 'pointer', method: 'constant' };
export function envelope(config: Config): Envelope {
  if (config.policy === 'discard' || (config.policy === 'guard' && config.source === 'empty')) return { type: null, value: null };
  return { type: '*Problem', value: config.source === 'empty' ? 'nil' : 'object' };
}
export function inspect(config: Config) {
  const slots = envelope(config);
  const isNil = slots.type === null;
  const call: CallOutcome = isNil ? 'skipped' : slots.value === 'nil' && config.method === 'dereference' ? 'panic' : 'returned';
  const output = call === 'skipped' ? '成功路径，未调用 Error()' : call === 'panic' ? 'panic：解引用 nil 接收者 p.Msg' : config.method === 'constant' ? 'problem' : '磁盘已满';
  const contract = (config.source === 'empty') === isNil;
  return { slots, isNil, call, output, contract,
    explanation: isNil ? '直接返回 nil 接口，动态类型和值都不存在；err == nil 为 true，调用方跳过 Error()。' : slots.value === 'nil' ? `return p 保留 *Problem 类型，即使 p 为 nil，err == nil 仍为 false。${config.method === 'constant' ? 'Error 不解引用 p，因此调用正常返回。' : 'Error 读取 p.Msg，解引用 nil 才导致 panic。'}` : 'return p 装入 *Problem 类型和真实对象；err != nil，Error 可读取有效接收者。',
  };
}
export function repair(config: Config): Config { return { ...config, policy: 'guard' }; }
export function returnCode(policy: Policy) {
  return policy === 'pointer' ? 'return p' : policy === 'guard' ? 'if p == nil { return nil }; return p' : 'return nil // 无条件丢弃结果';
}
export function contractCases(config: Config) {
  return (['empty', 'problem'] as const).map(source => ({ source, ...inspect({ ...config, source }) }));
}
