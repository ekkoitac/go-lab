export type Strategy = 'float64' | 'number' | 'int64' | 'string';
export type Outcome = 'exact' | 'changed' | 'error';
export const strategies: Record<Strategy,string> = {float64:'默认 any → float64',number:'UseNumber → Int64',int64:'明确 int64 字段',string:'字符串 ID'};
export const outcomeLabels:Record<Outcome,string> = {exact:'逐位保持',changed:'编号改变',error:'拒绝或转换错误'};
export const MIN_INT64=-(1n<<63n), MAX_INT64=(1n<<63n)-1n;
export function validateInput(raw:string):string|null {
 if(raw.length>120)return '教学输入最多 120 位字符。';
 if(!/^-?(0|[1-9]\d*)$/.test(raw))return '请输入 JSON 十进制整数：不含空格、小数、指数、前导零或加号。';
 return null;
}
export interface Result {raw:string;strategy:Strategy;decoded:string;converted:string;outcome:Outcome;reason:string;error:string|null;delta:string|null}
export function evaluate(raw:string,strategy:Strategy):Result {
 const invalid=validateInput(raw);
 if(invalid)return {raw,strategy,decoded:'未解码',converted:'未转换',outcome:'error',reason:invalid,error:invalid,delta:null};
 const integer=BigInt(raw),inRange=integer>=MIN_INT64&&integer<=MAX_INT64;
 if(strategy==='float64'){
  const rounded=BigInt(Number(raw)),delta=(rounded-integer).toString(),safe=rounded>=MIN_INT64&&rounded<=MAX_INT64;
  return {raw,strategy,decoded:rounded.toString(),converted:safe?rounded.toString():'超出 int64：不展示平台相关转换值',outcome:safe?(rounded===integer?'exact':'changed'):'error',error:safe?null:'舍入后的值超出 int64 范围',delta,reason:`float64 实际表示的整数是 ${rounded}，与输入差 ${delta}。${safe?'转回整数不会找回已丢失的位。':'浮点数转 int64 超范围的结果依赖实现，必须先检查范围。'}`};
 }
 if(strategy==='string')return {raw,strategy,decoded:raw,converted:raw,outcome:'exact',reason:'发送端使用带引号的 JSON 字符串，接收端用 string；编号不参与数字转换。',error:null,delta:'0'};
 if(!inRange)return {raw,strategy,decoded:strategy==='number'?raw:'解码失败',converted:'错误：超出 int64 范围',outcome:'error',reason:strategy==='number'?'UseNumber 保留了数字文本；Int64() 的范围检查仍失败，必须处理 err。':'明确 int64 字段会在 JSON 解码时报告范围错误；不得使用失败后的值。',error:'超出 int64 范围',delta:null};
 return {raw,strategy,decoded:strategy==='number'?raw:integer.toString(),converted:integer.toString(),outcome:'exact',reason:strategy==='number'?'先保留 json.Number 文本，再经 Int64() 验证范围；两步都未经过 float64。':'JSON 数字直接解析为 int64，且位于有符号 64 位整数范围。',error:null,delta:'0'};
}
export interface State {raw:string;strategy:Strategy;phase:number;decoded:string|null;converted:string|null;outcome:Outcome|null;error:string|null;delta:string|null}
export function snapshot(raw:string,strategy:Strategy,phase:number):State {
 const result=evaluate(raw,strategy),p=Math.max(0,Math.min(3,Math.trunc(phase)));
 return {raw,strategy,phase:p,decoded:p>=1?result.decoded:null,converted:p>=2?result.converted:null,outcome:p>=3?result.outcome:null,error:p>=2?result.error:null,delta:p>=3?result.delta:null};
}
export function changeDigit(raw:string,amount:bigint){return validateInput(raw)?raw:(BigInt(raw)+amount).toString();}
export function changedPositions(a:string,b:string){const size=Math.max(a.length,b.length);return [...b.padStart(size,' ')].map((char,index)=>({char,changed:char!==a.padStart(size,' ')[index]}));}
export const code:Record<Strategy,string[]>={
 float64:['var v any // 输入是 JSON 数字','json.Unmarshal(data, &v) // v: float64','// 检查范围后才可转换\nid := int64(v.(float64))','// 比较 id 与原始输入，丢失的信息无法恢复'],
 number:['dec := json.NewDecoder(reader)','dec.UseNumber(); err := dec.Decode(&v)','id, err := v.(json.Number).Int64()','if err != nil { return err } // 不忽略范围错误'],
 int64:['var v struct { ID int64 }','err := json.Unmarshal(data, &v)','if err != nil { return err }','id := v.ID // 无 float64 中转'],
 string:['var v struct { ID string } // JSON ID 必须带引号','err := json.Unmarshal(data, &v)','if err != nil { return err }','id := v.ID // 原样保留标识文本']
};
