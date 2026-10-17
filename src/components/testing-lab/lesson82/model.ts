export type Version = 'original' | 'formula' | 'complete';
export type Category = '普通页' | '第一页' | '非法页码' | '非法页大小';
export interface Case { id: string; name: string; page: number; size: number; want: number }
export const versions: Version[] = ['original', 'formula', 'complete'];
export const labels: Record<Version, string> = { original: '原公式', formula: '只修复公式', complete: '公式 + 输入校验' };
export const cases: Case[] = [
  { id: 'second', name: '普通页', page: 2, size: 10, want: 10 },
  { id: 'third', name: '再加普通页', page: 3, size: 10, want: 20 },
  { id: 'first', name: '第一页', page: 1, size: 10, want: 0 },
  { id: 'zero-page', name: '页码为零', page: 0, size: 10, want: -1 },
  { id: 'negative-page', name: '负页码', page: -2, size: 10, want: -1 },
  { id: 'zero-size', name: '页大小为零', page: 2, size: 0, want: -1 },
  { id: 'negative-size', name: '负页大小', page: 2, size: -3, want: -1 },
];
export function categoryOf(c: Pick<Case, 'page' | 'size'>): Category[] {
  const invalid: Category[] = [];
  if (c.page < 1) invalid.push('非法页码');
  if (c.size < 1) invalid.push('非法页大小');
  return invalid.length ? invalid : [c.page === 1 ? '第一页' : '普通页'];
}
export const categories: Category[] = ['普通页', '第一页', '非法页码', '非法页大小'];
export function coverage(rows: Case[]) { return categories.filter(category => rows.some(row => categoryOf(row).includes(category))); }
export function offset(version: Version, page: number, size: number): number {
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(size) || Math.abs(page) > 1000 || Math.abs(size) > 1000) throw new RangeError('教学模型只接受 -1000 到 1000 的整数');
  if (version === 'complete' && (page < 1 || size < 1)) return -1;
  return version === 'original' ? page * size : (page - 1) * size;
}
export function runTable(version: Version, rows: Case[]) {
  return rows.map(row => { const actual = offset(version, row.page, row.size); return { ...row, actual, pass: actual === row.want }; });
}
export function trace(version: Version, c: Case) {
  if (version === 'complete' && (c.page < 1 || c.size < 1)) return `${c.page} < 1 或 ${c.size} < 1 → 拒绝输入 → -1`;
  return version === 'original' ? `${c.page} × ${c.size} = ${c.page * c.size}` : `(${c.page} − 1) × ${c.size} = ${(c.page - 1) * c.size}`;
}
