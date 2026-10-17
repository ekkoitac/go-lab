export type Input = 'missing' | 'null' | 'zero' | 'value';
export type Strategy = 'plain' | 'pointer' | 'presence';
export type Target = 'fresh' | 'reuse';
export interface Config { input: Input; strategy: Strategy; target: Target; old: number; value: number }
export interface Decoded { value: number | null; present: boolean | null; explicitNull: boolean | null }
export interface Frame { phase: number; stage: string; request: string; decoded: Decoded | null; result: number | null; applied: boolean; reason: string; code: string }
export const initialConfig: Config = { input: 'missing', strategy: 'plain', target: 'fresh', old: 100, value: 25 };
export const inputs: Record<Input, string> = { missing: '缺失字段 {}', null: '显式 null', zero: '明确设置 0', value: '明确设置 25' };
export const strategies: Record<Strategy, string> = { plain: '普通 int：直接覆盖', pointer: '*int：nil 时不更新', presence: '记录存在性：按意图更新' };
export const targetLabels: Record<Target, string> = { fresh: '新建零值目标', reuse: '重用已有值目标' };
export function request(c: Config): string { return c.input === 'missing' ? '{}' : JSON.stringify({ Limit: c.input === 'null' ? null : c.input === 'zero' ? 0 : c.value }); }
export function decode(c: Config): Decoded {
  if (c.strategy === 'presence') return { present: c.input !== 'missing', explicitNull: c.input === 'null', value: c.input === 'zero' ? 0 : c.input === 'value' ? c.value : null };
  const seed = c.target === 'reuse' ? c.old : c.strategy === 'plain' ? 0 : null;
  return { present: null, explicitNull: null, value: c.input === 'missing' ? seed : c.input === 'null' ? c.strategy === 'plain' ? seed : null : c.input === 'zero' ? 0 : c.value };
}
export function intended(c: Config): number | null { return c.input === 'missing' ? c.old : c.input === 'null' ? null : c.input === 'zero' ? 0 : c.value; }
export function apply(c: Config, d = decode(c)): number | null {
  if (c.strategy === 'plain') return d.value;
  if (c.strategy === 'pointer') return d.value === null ? c.old : d.value;
  return !d.present ? c.old : d.explicitNull ? null : d.value;
}
export function format(value: number | null): string { return value === null ? '已清除（无额度）' : String(value); }
export function resultKey(c: Config): string { const v = apply(c); return v === null ? 'clear' : v === c.old ? 'keep' : v === 0 ? 'zero' : 'value'; }
export function trace(c: Config): Frame[] {
  const d = decode(c), final = apply(c);
  const declaration = c.strategy === 'plain' ? `patch := struct{ Limit int }{${c.target === 'reuse' ? c.old : 0}}` : c.strategy === 'pointer' ? `var patch struct{ Limit *int }${c.target === 'reuse' ? '\nseed := ' + c.old + '; patch.Limit = &seed' : ''}` : 'var patch map[string]json.RawMessage // 每个请求新建';
  const rule = c.strategy === 'plain' ? 'limit = patch.Limit' : c.strategy === 'pointer' ? 'if patch.Limit != nil { limit = *patch.Limit }' : 'if raw, ok := patch["Limit"]; ok {\n  if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {\n    clearLimit() // 显式业务操作\n  } else { json.Unmarshal(raw, &limit) }\n}';
  const decodeReason = c.strategy === 'presence' ? '新的 RawMessage map 保留键存在性和 null 原文，三个意图不会合并。' : c.input === 'missing' ? '缺失字段不写入目标：新目标保留零值，重用目标保留原值。' : c.input === 'null' ? c.strategy === 'plain' ? 'JSON null 解码到 int 不产生作用；当前值保留。这不是自动清零。' : 'JSON null 将 *int 设为 nil；新目标下它与缺失字段的结果相同。' : '显式数字写入字段，0 也是实际提供的值。';
  return [
    { phase: 0, stage: '接收请求', request: request(c), decoded: null, result: c.old, applied: false, reason: '业务约定：缺失=保留，null=清除，数字=设置。先预测再追踪。', code: `// 请求 ${request(c)}\nlimit := ${c.old}` },
    { phase: 1, stage: '初始化目标', request: request(c), decoded: { value: c.strategy === 'presence' ? null : c.target === 'reuse' ? c.old : c.strategy === 'plain' ? 0 : null, present: c.strategy === 'presence' ? false : null, explicitNull: c.strategy === 'presence' ? false : null }, result: c.old, applied: false, reason: c.strategy === 'presence' ? 'map 每个请求新建，避免残留键；目标重用选项仅对 int 和 *int 生效。' : c.target === 'fresh' ? '解码目标与业务旧值独立：新 int 为 0，新 *int 为 nil。' : '实验把解码目标预先填为业务旧值；缺失字段将保持这个初始值。', code: declaration },
    { phase: 2, stage: '解码请求', request: request(c), decoded: d, result: c.old, applied: false, reason: decodeReason, code: 'err := json.Unmarshal(body, &patch)\nif err != nil { return err }' },
    { phase: 3, stage: '应用业务更新', request: request(c), decoded: d, result: final, applied: true, reason: c.strategy === 'plain' ? '普通 int 策略直接覆盖，无法从数值恢复字段是否出现。' : c.strategy === 'pointer' ? d.value === null ? 'nil 被当作不更新，无法表达此业务约定中的显式清除。' : '非 nil 指针被解引用写入；零值不会被跳过。' : c.input === 'missing' ? '键不存在，跳过更新，保留旧额度。' : c.input === 'null' ? '键存在且为 null，业务代码调用 clearLimit；清除不是 Go 自动赋零。' : '键存在且含数字，写入明确提供的值。', code: rule },
  ];
}
