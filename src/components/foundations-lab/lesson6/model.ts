export interface RuneCell { text: string; code: string; offset: number; width: number; bytes: number[] }
export interface TextModel { text: string; bytes: number[]; runes: RuneCell[]; graphemes: string[] }
export const initialText = 'A中🙂';
const encoder = new TextEncoder();
export function inspectText(input: string): TextModel {
  // Browser text input cannot represent arbitrary Go bytes. Normalize lone UTF-16 surrogates explicitly.
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(encoder.encode(input));
  const bytes = [...encoder.encode(text)];
  let offset = 0;
  const runes = Array.from(text, character => {
    const encoded = [...encoder.encode(character)];
    const cell = { text: character, code: `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`, offset, width: encoded.length, bytes: encoded };
    offset += encoded.length;
    return cell;
  });
  const graphemes = Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text), item => item.segment);
  return { text, bytes, runes, graphemes };
}
export function rangeSnapshot(input: string, step: number) {
  const model = inspectText(input);
  if (!Number.isInteger(step) || step < 0 || step > model.runes.length) throw new RangeError('range step is outside the text');
  const current = step > 0 ? model.runes[step - 1] : null;
  return { current, visited: model.runes.slice(0, step), nextOffset: current ? current.offset + current.width : 0, done: step === model.runes.length };
}
export function ownerAt(model: TextModel, byteOffset: number) {
  return model.runes.findIndex(rune => byteOffset >= rune.offset && byteOffset < rune.offset + rune.width);
}
export function sliceBytes(input: string, end: number) {
  const model = inspectText(input);
  if (!Number.isInteger(end) || end < 0 || end > model.bytes.length) throw new RangeError('invalid byte boundary');
  const bytes = new Uint8Array(model.bytes.slice(0, end));
  let valid = true;
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { valid = false; }
  return { bytes: [...bytes], valid, display: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) };
}
export type CountUnit = 'bytes' | 'runes' | 'graphemes';
export function countText(input: string, unit: CountUnit) { return inspectText(input)[unit].length; }
export function hex(byte: number) { return byte.toString(16).toUpperCase().padStart(2, '0'); }

