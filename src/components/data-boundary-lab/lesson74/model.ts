export interface Config { input: string; unknown: boolean; second: boolean }
export interface Frame { phase: number; cursor: number; n: number; first: string; second: string; outcome: 'pending' | 'accept' | 'reject'; reason: string; code: string }
export const presets = [
 { name: '两份配置', input: '{"n":1} {"n":2}' },
 { name: '正常配置', input: '{"n":1}' },
 { name: '未知字段', input: '{"n":1,"debug":true}' },
 { name: '尾部 null', input: '{"n":1} null' },
 { name: '尾部标量', input: '{"n":1} 42' },
 { name: '尾部空白', input: '{"n":1} \n\t' },
 { name: '非法尾部', input: '{"n":1} rubbish' },
 { name: '首值非法', input: '{"n":}' },
];
const ws = (c: string) => /[ \r\n\t]/.test(c);
// Scan exactly one complete JSON value. Parsing only that slice preserves the stream boundary.
export function scanValue(input: string, offset = 0): { kind: 'value'; end: number; value: unknown } | { kind: 'eof'; end: number } | { kind: 'syntax'; end: number } {
 let p = offset;
 const skip = () => { while (p < input.length && ws(input[p])) p++; };
 const bad = () => { throw new Error('syntax'); };
 const string = () => {
  if (input[p++] !== '"') bad();
  while (p < input.length) {
   const c = input[p++]; if (c === '"') return;
   if (c.charCodeAt(0) < 32) bad();
   if (c === '\\') { const e = input[p++]; if (e === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(input.slice(p,p+4))) bad(); p+=4; } else if (!e || !'"\\/bfnrt'.includes(e)) bad(); }
  }
  bad();
 };
 const value = (depth: number): void => {
  if (depth > 64) bad(); skip(); const c = input[p];
  if (c === '"') { string(); return; }
  if (c === '{' || c === '[') {
   const object = c === '{', close = object ? '}' : ']'; p++; skip(); if (input[p] === close) {p++; return;}
   while (p < input.length) {
    if (object) { string(); skip(); if(input[p++] !== ':') bad(); }
    value(depth+1); skip(); if (input[p] === close) {p++; return;} if (input[p++] !== ',') bad(); skip();
   } bad();
  }
  for (const literal of ['true','false','null']) if (input.startsWith(literal,p)) {p+=literal.length; return;}
  const number = input.slice(p).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
  if (number) {p+=number[0].length; if (input[p] === '.' || input[p] === 'e' || input[p] === 'E') bad(); return;} bad();
 };
 skip(); if (p === input.length) return {kind:'eof',end:offset}; const start=p;
 try { value(0); return {kind:'value',end:p,value:JSON.parse(input.slice(start,p))}; } catch {return {kind:'syntax',end:offset};}
}
export function trace(config: Config): Frame[] {
 const frames: Frame[] = [{phase:0,cursor:0,n:0,first:'尚未调用',second:'尚未调用',outcome:'pending',reason:'先判断：字段检查是否也能证明输入只有一份配置？',code:config.unknown?'d.DisallowUnknownFields()':'// 默认允许未知字段'}];
 const a=scanValue(config.input); const base=frames[0];
 let n=0, first='nil', reason='第一个完整 JSON 值已解码；尾部尚未验证。';
 if(a.kind==='eof') {first='io.EOF'; reason='没有第一个 JSON 值，配置缺失。';}
 else if(a.kind==='syntax') {first='SyntaxError'; reason='第一个值语法不合法。';}
 else if(a.value!==null && (typeof a.value!=='object'||Array.isArray(a.value))) {first='UnmarshalTypeError';reason='首值必须能解码到配置结构体。';}
 else if(a.value!==null) {
  const obj=a.value as Record<string, unknown>;
  for(const [k,v] of Object.entries(obj)) {
   if(k.toLowerCase()==='n') {if(v===null) continue; if(typeof v!=='number'||!Number.isInteger(v)||!Number.isSafeInteger(v)) {first='UnmarshalTypeError';reason='n 必须是本模型支持的安全整数；null 保留零值。';} else n=v;}
   else if(config.unknown && first==='nil') {first='unknown field';reason=`字段 ${k} 不属于配置结构体；这与尾部检查无关。`;}
  }
 }
 frames.push({...base,phase:1,cursor:a.kind==='value'?a.end:0,n,first,outcome:first==='nil'?'pending':'reject',reason,code:'err := d.Decode(&config) // 检查 err'});
 if(first!=='nil') return frames;
 const current=frames[1];
 if(!config.second) {frames.push({...current,phase:2,second:'跳过',outcome:'accept',reason:'入口直接接受；游标后仍可能存在额外 JSON 或非法字符。',code:'return accept(config) // 未检查尾部'});return frames;}
 const b=scanValue(config.input,current.cursor);
 frames.push({...current,phase:2,cursor:b.kind==='value'?b.end:current.cursor,second:b.kind==='eof'?'io.EOF':b.kind==='value'?'nil':'SyntaxError',outcome:b.kind==='eof'?'accept':'reject',reason:b.kind==='eof'?'尾部只有空白或为空；第二次 Decode 得到 io.EOF，接受单文档。':b.kind==='value'?'第二次 Decode 成功，证明存在额外值；即使该值是 null 也拒绝。':'第二次 Decode 返回语法错误，而不是 io.EOF；非法尾部必须拒绝。',code:'var extra any; err = d.Decode(&extra)\nif err != io.EOF { return reject }'});
 return frames;
}
export const finalFrame = (config: Config) => trace(config).at(-1)!;
