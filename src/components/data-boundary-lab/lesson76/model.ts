export type Fault = 'none' | 'iteration' | 'scan';
export type Config = { count: number; fault: Fault; deferClose: boolean };
export type Action = 'next' | 'scan' | 'return' | 'close' | 'err';
export type State = { cursor: number; closed: boolean; returned: boolean; next: boolean | null; scanned: number[]; scanError: string | null; rowsError: string | null; errRead: boolean; inUse: number; code: string; reason: string; steps: number };
export const initialConfig: Config = { count: 2, fault: 'none', deferClose: false };
export const actionLabels: Record<Action, string> = { next: 'Next：移向下一行', scan: 'Scan：读取当前行', return: '提前返回', close: 'Close：释放 Rows', err: 'Err：检查遍历错误' };
export function initialState(): State { return { cursor: -1, closed: false, returned: false, next: null, scanned: [], scanError: null, rowsError: null, errRead: false, inUse: 1, code: 'rows, err := db.QueryContext(ctx, query)', reason: '查询成功，Rows 持有一条连接；还没有调用 Next。', steps: 0 }; }
export function allowed(s: State, a: Action): boolean { if (s.returned) return false; if (a === 'next' || a === 'close') return !s.closed; if (a === 'scan') return !s.closed && s.next === true; return true; }
export function advance(c: Config, before: State, a: Action): State {
 if (!allowed(before, a)) return before;
 const s = { ...before, scanned: [...before.scanned], steps: before.steps + 1 };
 if (a === 'next') {
  s.code = 'ok := rows.Next()'; s.errRead = false;
  if (c.fault === 'iteration' && s.cursor >= 0) { s.closed = true; s.inUse = 0; s.next = false; s.rowsError = 'driver: read failed'; s.reason = 'Next=false：驱动遍历失败，Rows 自动关闭并释放连接。需要 Err 才能区分它与正常结束。'; }
  else if (s.cursor + 1 >= c.count) { s.cursor = c.count; s.closed = true; s.inUse = 0; s.next = false; s.reason = 'Next=false：到达 EOF（本模型只有一个结果集），Rows 自动关闭；正常 EOF 不是错误。'; }
  else { s.cursor++; s.next = true; s.reason = `Next=true：游标移到第 ${s.cursor + 1} 行，尚未将这一行 Scan 到变量。`; }
 } else if (a === 'scan') {
  s.code = 'err := rows.Scan(&value)';
  if (c.fault === 'scan' && s.cursor === 0) { s.scanError = 'Scan: cannot convert "oops" to int'; s.reason = 'Scan 返回转换错误；Rows 仍占用连接。这是 Scan 的返回值，Rows.Err 不代替它。'; }
  else { s.scanError = null; if (!s.scanned.includes(s.cursor)) s.scanned.push(s.cursor); s.reason = `Scan 成功：value=${(s.cursor + 1) * 10}；读取一行不等于读到 EOF，连接仍被占用。`; }
 } else if (a === 'close') { s.code = 'err := rows.Close()'; s.closed = true; s.inUse = 0; s.next = false; s.reason = '显式 Close 释放 Rows 的连接。本模型 Close 成功；真实驱动的 Close 也可能返回错误。'; }
 else if (a === 'err') { s.code = 'err := rows.Err()'; s.errRead = true; s.reason = s.rowsError ? `Err 返回 ${s.rowsError}，遍历失败不能当作成功处理。` : 'Err=nil；它不代表 Scan 成功，也不会主动关闭尚未读完的 Rows。'; }
 else { s.code = c.deferClose ? 'return // 执行 defer rows.Close()' : 'return // 未安排关闭'; s.returned = true; if (c.deferClose) { s.closed = true; s.inUse = 0; s.next = false; } s.reason = s.closed ? '函数返回，连接已释放。若有错误，还必须将相应错误报告给调用者。' : '函数已经返回，未读完的 Rows 仍持有连接；本作用域再也无法主动关闭它。'; }
 return s;
}
export function replay(c: Config, actions: readonly Action[]): State { return actions.reduce((s, a) => advance(c, s, a), initialState()); }
export type Repair = { deferClose: boolean; checkScan: boolean; checkRows: boolean };
export function verifyRepair(p: Repair) {
 return (['early', 'scan', 'eof', 'iteration'] as const).map(kind => {
  const c: Config = { count: 2, fault: kind === 'scan' || kind === 'iteration' ? kind : 'none', deferClose: p.deferClose };
  let s = initialState(), reported: string | null = null;
  const actions: Action[] = [];
  const act = (a: Action) => { actions.push(a); s = advance(c, s, a); };
  for (let i = 0; i < 4 && !s.closed && !s.returned; i++) {
   act('next'); if (!s.next) break;
   act('scan'); if (s.scanError && p.checkScan) { reported = s.scanError; act('return'); break; }
   if (kind === 'early') { act('return'); break; }
  }
  if (!s.returned) { if (p.checkRows) { act('err'); reported = s.rowsError; } act('return'); }
  const expectedError = kind === 'scan' || kind === 'iteration';
  return { kind, state: s, actions, reported, pass: s.inUse === 0 && (expectedError ? reported !== null : reported === null) };
 });
}

