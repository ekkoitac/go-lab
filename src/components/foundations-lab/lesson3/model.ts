export type Policy = 'direct' | 'before' | 'after' | 'constant';
export type Config = { input: number; policy: Policy };
export function validInput(n: number) { return Number.isInteger(n) && n >= -32768 && n <= 32767; }
export function narrow(n: number) {
  if (!validInput(n)) throw new RangeError('本模型只接受 int16 范围内的整数');
  return ((n % 256) + 256) % 256;
}
export function bits16(n: number) {
  narrow(n);
  return (((n % 65536) + 65536) % 65536).toString(2).padStart(16, '0');
}
export function inspect({ input, policy }: Config) {
  const byte = narrow(input);
  const inRange = input >= 0 && input <= 255;
  const output = policy === 'constant' && !inRange ? '编译错误' : policy === 'before' && !inRange ? '拒绝' : String(byte);
  const encoded = output === '拒绝' || output === '编译错误' ? null : byte;
  return { byte, inRange, output, encoded, sourceBits: bits16(input), lowBits: byte.toString(2).padStart(8, '0'), lost: input !== byte };
}
export function snapshot(config: Config, phase: number) {
  const r = inspect(config);
  const step = Math.max(0, Math.min(3, Math.trunc(phase)));
  const { input, policy } = config;
  const guard = policy === 'before' ? (r.inRange ? '原值在 0..255，允许转换。' : `原值 ${input} 越界，拒绝；不会执行转换。`) : policy === 'constant' ? (r.inRange ? '常量可表示，编译检查通过。' : '常量超出 uint8 范围，编译检查失败；无运行时输出。') : '没有在转换前检查原值，进入变窄步骤。';
  const conversion = r.encoded === null ? '转换未执行，高位没有被丢弃，也没有生成字节。' : `保留低 8 位 ${r.lowBits}，结果 ${r.byte}。${input < 0 ? '负数使用二进制补码，截断后按无符号数解释。' : `${input} = ${Math.floor(input / 256)} × 256 + ${r.byte}。`}`;
  const finish = policy === 'after' ? `转换后检查 ${r.byte}：一定在 0..255，检查通过；原值 ${input} ${r.lost ? '已无法从这个字节恢复' : '在本例恰好未变'}。` : r.encoded === null ? `结束：${r.output}；协议中没有发送字节。` : `发送 ${r.byte}；${r.lost ? `与原始数量 ${input} 不同，类型转换不会自动返回 error。` : '与原始数量一致。'}`;
  return { step, title: ['准备输入', '检查转换前提', '保留低 8 位', '观察发送结果'][step], note: [`原值 ${input}；先预测最终结果，再开始执行。`, guard, conversion, finish][step], encoded: step >= 2 ? r.encoded : null, output: step === 3 ? r.output : null };
}
