export type Strategy = 'zero' | 'pointer' | 'presence';
export type Intent = 'keep' | 'clear' | 'set' | 'reject';
export interface Config { payload: string; current: string }
export interface LabState { config: Config; phase: number }
export const defaults: Config = { payload: '{}', current: 'Ada' };
export const presets = [
  { label: '字段缺失', payload: '{}' }, { label: '显式 null', payload: '{"name":null}' },
  { label: '空字符串', payload: '{"name":""}' }, { label: '正常字符串', payload: '{"name":"Lin"}' },
  { label: '错误类型', payload: '{"name":3}' },
];
export const strategies: Strategy[] = ['zero', 'pointer', 'presence'];
export const labels: Record<Strategy, string> = { zero: '零值 string', pointer: '指针 *string', presence: '键存在性 + RawMessage' };
export const intents: Record<Intent, string> = { keep: '保留旧值', clear: '显式清空', set: '设置字符串', reject: '拒绝更新' };
export function initial(config: Config = defaults): LabState { return { config: { ...config }, phase: 0 }; }
export function advance(state: LabState): LabState { return { ...state, phase: Math.min(3, state.phase + 1) }; }
export function rewind(state: LabState): LabState { return { ...state, phase: Math.max(0, state.phase - 1) }; }
export function configure(state: LabState, patch: Partial<Config>): LabState { return initial({ ...state.config, ...patch }); }
export function decode(payload: string): { present: boolean; value?: string | null; error?: string } {
  let object: unknown;
  try { object = JSON.parse(payload); } catch { return { present: false, error: 'JSON 语法错误' }; }
  if (typeof object !== 'object' || object === null || Array.isArray(object)) return { present: false, error: '请求必须是 JSON 对象' };
  const present = Object.prototype.hasOwnProperty.call(object, 'name');
  const value = (object as Record<string, unknown>).name;
  if (present && value !== null && typeof value !== 'string') return { present, error: 'name 必须是字符串或 null' };
  return { present, value: value as string | null | undefined };
}
export function outcome(config: Config, strategy: Strategy) {
  const input = decode(config.payload);
  let intent: Intent;
  if (input.error) intent = 'reject';
  else if (strategy === 'zero') intent = 'set';
  else if (strategy === 'pointer') intent = input.value == null ? 'keep' : 'set';
  else intent = !input.present ? 'keep' : input.value === null ? 'clear' : 'set';
  const value = intent === 'keep' || intent === 'reject' ? config.current : intent === 'clear' ? '' : input.value ?? '';
  const decoded = input.error ? input.error : strategy === 'zero' ? 'name = ' + JSON.stringify(input.value ?? '') : strategy === 'pointer' ? input.value == null ? 'name = nil' : 'name → ' + JSON.stringify(input.value) : 'present = ' + input.present + '; raw = ' + (input.present ? JSON.stringify(input.value) : '不存在');
  const expected: Intent = input.error ? 'reject' : !input.present ? 'keep' : input.value === null ? 'clear' : 'set';
  return { intent, value, decoded, expected, matches: intent === expected, error: input.error };
}
export function inspect(state: LabState) {
  return strategies.map(strategy => { const result = outcome(state.config, strategy); return { strategy, ...result, stored: state.phase === 3 ? result.value : state.config.current }; });
}

