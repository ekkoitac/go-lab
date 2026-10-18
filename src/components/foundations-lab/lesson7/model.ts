export type Strategy = 'value' | 'pointer' | 'return' | 'rebind';
export type Address = 'A' | 'B';
export interface Input { balance: number; amount: number; strategy: Strategy; receive: boolean }
export interface Snapshot {
  a: number; b: number; local: number | null; callerPointer: 'A'; localPointer: Address | null;
  returned: number | null; active: boolean; operation: string; code: string; cause: string;
}
export const initialInput: Input = { balance: 50, amount: 20, strategy: 'value', receive: true };
export function writeAddress(accounts: { a: number; b: number }, target: Address, amount: number) {
  return target === 'A' ? { ...accounts, a: accounts.a + amount } : { ...accounts, b: accounts.b + amount };
}
export function trace(input: Input): Snapshot[] {
  if (!Number.isInteger(input.balance) || input.balance < 0 || input.balance > 500 || !Number.isInteger(input.amount) || input.amount < 0 || input.amount > 100) throw new RangeError('余额需为 0–500 整数，充值需为 0–100 整数');
  const frames: Snapshot[] = [];
  let state: Snapshot = { a: input.balance, b: 500, local: null, callerPointer: 'A', localPointer: null, returned: null, active: false, operation: '调用前', code: `a := Account{Balance: ${input.balance}}`, cause: '账户 A 属于调用者。B 是另外一个账户；字母是对象身份，不是实际内存地址。' };
  const push = (patch: Partial<Snapshot>) => { state = { ...state, ...patch }; frames.push(state); };
  push({});
  const pointer = input.strategy === 'pointer' || input.strategy === 'rebind';
  push({ active: true, local: pointer ? null : input.balance, localPointer: pointer ? 'A' : null, operation: pointer ? '复制地址值' : '复制结构体值', code: pointer ? 'deposit(&a) // p 得到 &A 的副本' : 'deposit(a) // local 得到 a 的副本', cause: pointer ? '调用者与局部 p 都指向 A，但两个指针变量各自独立。Go 仍然按值传参。' : `A.Balance=${input.balance} 被复制到 local.Balance。两个结构体的标量字段各自存储。` });
  if (input.strategy === 'rebind') push({ localPointer: 'B', operation: '局部指针重新绑定', code: 'p = &other // other 是账户 B', cause: '只把函数内 p 改为 &B；调用者的指针仍为 &A，A 和 B 的余额都还没有改变。' });
  const before = pointer ? (state.localPointer === 'A' ? state.a : state.b) : state.local!;
  push({ ...(pointer ? writeAddress(state, state.localPointer!, input.amount) : { local: state.local! + input.amount }), operation: pointer ? `写入账户 ${state.localPointer}` : '写入局部副本', code: `${pointer ? 'p.Balance' : 'local.Balance'} += ${input.amount}`, cause: `${pointer ? `地址 ${state.localPointer} 指向的账户` : '副本'}余额 ${before} → ${before + input.amount}。${input.amount === 0 ? '充值 0 仍执行了写入，所以数值不变。' : pointer && state.localPointer === 'A' ? '调用者通过 A 立即看见变化。' : '调用者的账户 A 没有被这条写入修改。'}` });
  push({ active: false, returned: input.strategy === 'return' ? state.local : null, operation: input.strategy === 'return' ? '返回新账户值' : '函数返回', code: input.strategy === 'return' ? 'return local' : 'return', cause: input.strategy === 'return' ? `返回值带着 Balance=${state.local}，但接收前 A 仍为 ${state.a}。` : '函数调用结束。下方保留局部变量的历史快照；它们已不再是活动参数。' });
  push({ a: input.strategy === 'return' && input.receive ? state.returned! : state.a, operation: input.strategy === 'return' && input.receive ? '调用者接收返回值' : '调用者观察结果', code: input.strategy === 'return' ? input.receive ? 'a = deposit(a)' : 'deposit(a) // 丢弃返回值' : 'fmt.Println(a.Balance)', cause: input.strategy === 'return' ? input.receive ? `调用者赋值把返回的新账户写入 A：${input.balance} → ${state.returned}。` : `返回值被丢弃，A 仍为 ${input.balance}。返回新值需要配合调用者接收。` : `最终 A.Balance=${state.a}；p 的局部绑定不会改调用者的指针变量。` });
  return frames;
}
