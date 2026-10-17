export type Implementation = 'byte' | 'rune';
export type Property = 'utf8' | 'length';
export type InputMode = 'text' | 'hex';
export type Outcome = 'pass' | 'fail' | 'skip';
export interface ExperimentInput { input: string; mode: InputMode; implementation: Implementation; property: Property }
export interface Result { bytes: number[]; output: number[]; validInput: boolean; validOutput: boolean; outcome: Outcome; explanation: string }
const encoder = new TextEncoder();
export const hex = (bytes: readonly number[]) => bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') || '∅';
export function isValid(bytes: readonly number[]): boolean {
  try { new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(new Uint8Array(bytes)); return true; } catch { return false; }
}
export function parseInput(input: string, mode: InputMode): number[] {
  if (mode === 'hex') {
    if (!input.trim()) return [];
    const tokens = input.trim().split(/\s+/);
    if (tokens.some(token => !/^[\da-f]{2}$/i.test(token))) throw new Error('每个字节必须是两位十六进制，用空格分隔，例如 E7 8C AB 或 FF。');
    if (tokens.length > 80) throw new Error('教学台最多接收 80 字节。');
    return tokens.map(token => parseInt(token, 16));
  }
  // A JavaScript string can contain lone UTF-16 surrogates. Do not silently
  // replace these with U+FFFD and claim that arbitrary Go string bytes were tested.
  const scalars = Array.from(input);
  if (scalars.some(s => s.length === 1 && s.charCodeAt(0) >= 0xD800 && s.charCodeAt(0) <= 0xDFFF)) throw new Error('文本含孤立 UTF-16 代理项；请改用字节模式明确输入。');
  if (scalars.length > 20) throw new Error('教学台最多接收 20 个 Unicode 码点。');
  return Array.from(encoder.encode(input));
}
export function runExperiment(config: ExperimentInput): Result {
  const bytes = parseInput(config.input, config.mode);
  if (!isValid(bytes)) return {bytes, output: [], validInput: false, validOutput: true, outcome: 'skip', explanation: '输入不是合法 UTF-8。此性质有合法输入前提，因此跳过 first 和断言；跳过不是通过。生产 API 必须另行规定拒绝、替换或保留非法字节。'};
  const text = new TextDecoder('utf-8', {ignoreBOM: true}).decode(new Uint8Array(bytes));
  const output = config.implementation === 'byte' ? bytes.slice(0, 1) : Array.from(encoder.encode(Array.from(text)[0] ?? ''));
  const validOutput = isValid(output);
  const passes = config.property === 'utf8' ? validOutput : output.length <= bytes.length;
  const explanation = config.property === 'length'
    ? `输出 ${output.length} 字节 ≤ 输入 ${bytes.length} 字节，长度性质通过。${validOutput ? '这只提供长度证据，不能证明功能正确。' : '但输出已损坏！这个弱性质无法捕获切断 UTF-8 的缺陷。'}`
    : !validOutput ? `首码点需要多个字节，却仅留下 ${hex(output)}，后续字节丢失；输出无法独立解码，所以找到反例。`
    : bytes.length === 0 ? '空输入返回空输出，空字节序列是合法 UTF-8。'
    : config.implementation === 'rune' ? `保留首个完整 Unicode 码点的 ${output.length} 个字节，输出仍合法。一个码点不一定是一个视觉字符。`
    : '首码点恰好是单字节 ASCII，因此本例通过；尚不能推断多字节输入也通过。';
  return {bytes, output, validInput: true, validOutput, outcome: passes ? 'pass' : 'fail', explanation};
}
export function shrinkOnce(config: ExperimentInput): string | null {
  const result = runExperiment(config);
  if (result.outcome !== 'fail' || !result.validInput) return null;
  const text = new TextDecoder('utf-8', {ignoreBOM: true}).decode(new Uint8Array(result.bytes));
  const points = Array.from(text);
  // Remove one whole trailing code point, retaining only failing candidates.
  if (points.length <= 1) return null;
  const shorter = points.slice(0, -1).join('');
  const candidate = config.mode === 'text' ? shorter : hex(Array.from(encoder.encode(shorter)));
  return runExperiment({...config, input: candidate}).outcome === 'fail' ? candidate : null;
}
export function runeGroups(input: string) { return Array.from(input).map(rune => ({rune, bytes: Array.from(encoder.encode(rune))})); }
