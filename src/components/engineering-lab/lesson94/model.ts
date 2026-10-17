export const utf8Length = (value: string) => new TextEncoder().encode(value).length;
export interface CopyRow {part: string; bytes: number; prefix: number; concatDelta: number; builderDelta: number; moved: number; capacity: number; concatTotal: number; builderTotal: number}
export function copyRows(parts: string[], grow: boolean): CopyRow[] {
  let prefix = 0, concatTotal = 0, builderTotal = 0;
  let capacity = grow ? parts.reduce((sum, part) => sum + utf8Length(part), 0) : 0;
  return parts.map(part => {
    const bytes = utf8Length(part), nextLength = prefix + bytes;
    const moved = nextLength > capacity ? prefix : 0;
    if (nextLength > capacity) capacity = Math.max(nextLength, Math.max(1, capacity * 2));
    // Teaching policy, not compiler or Builder capacity measurements.
    const concatDelta = bytes === 0 ? 0 : nextLength, builderDelta = moved + bytes;
    prefix = nextLength; concatTotal += concatDelta; builderTotal += builderDelta;
    return {part, bytes, prefix, concatDelta, builderDelta, moved, capacity, concatTotal, builderTotal};
  });
}
export function copySnapshot(parts: string[], grow: boolean, step: number) {
  const rows = copyRows(parts, grow), cursor = Math.max(0, Math.min(parts.length, Math.trunc(step)));
  const row = rows[cursor - 1];
  return {step: cursor, done: cursor === parts.length, output: parts.slice(0, cursor).join(''), bytes: row?.prefix ?? 0, concatTotal: row?.concatTotal ?? 0, builderTotal: row?.builderTotal ?? 0, capacity: row?.capacity ?? (grow ? parts.reduce((n, p) => n + utf8Length(p), 0) : 0), rows: rows.slice(0, cursor)};
}
