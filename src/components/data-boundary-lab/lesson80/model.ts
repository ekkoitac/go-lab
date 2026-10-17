export type Context = 'html' | 'log' | 'command';
export type Method = 'raw' | 'context';
export type Outcome = 'unencoded' | 'data' | 'option';
export const contexts: Record<Context,string> = {html:'HTML 文本节点',log:'结构化 JSON 日志',command:'命令参数'};
export const outcomes:Record<Outcome,string>={unencoded:'未建立目标数据边界',data:'数据边界保持',option:'参数边界保持，但仍像选项'};
export const samples:Record<Context,string>={html:'<script>x</script>',log:'alice\nlevel=admin',command:'report.txt; echo injected'};
export function escapeHTML(raw:string):string {const replacements:Record<string,string>={'\0':'\uFFFD','&':'&amp;','<':'&lt;','>':'&gt;','"':'&#34;',"'":'&#39;','+':'&#43;'};return raw.replace(/[\0&<>"'+]/g,c=>replacements[c]);}
export interface Result {context:Context;method:Method;input:string;output:string;cells:{role:string;text:string}[];outcome:Outcome;reason:string;code:string}
export function evaluate(context:Context,method:Method,input:string):Result {
 const safe=method==='context';let output='',cells:Result['cells']=[],reason='',code='';
 if(context==='html'){
  const encoded=safe?escapeHTML(input):input;output=`<p>${encoded}</p>`;cells=[{role:'固定标签',text:'<p>'},{role:safe?'文本数据（编码后）':'未编码片段（可能成为语法）',text:encoded},{role:'固定标签',text:'</p>'}];
  reason=safe?'html/template 在这个文本节点编码特殊字符；标签样式输入仍是文字。URL、属性与 JavaScript 上下文需要各自的规则。':'拼接只形成源文本，不建立 HTML 文本节点边界。是否形成标签取决于输入；本实验不调用浏览器解析或执行它。';
  code=safe?'t := template.Must(template.New("p").Parse("<p>{{.}}</p>"))\nerr := t.Execute(w, input)':'output := "<p>" + input + "</p>"';
 }else if(context==='log'){
  output=safe?JSON.stringify({user:input}):'user='+input;
  cells=safe?[{role:'固定字段 user',text:JSON.stringify(input)}]:output.split('\n').map((text,i)=>({role:`物理行 ${i+1}`,text}));
  reason=safe?'JSON 编码把输入换行保存为字段中的转义序列；整条记录只有一行，解析该字段仍得到原输入。这里演示 JSON 字段边界，不逐字模拟某个日志库的元数据。':'直接拼接允许换行产生额外物理行。伪造字段看起来像日志结构，不能据此相信其来源。';
  code=safe?'logger := slog.New(slog.NewJSONHandler(w, nil))\nlogger.Info("request", "user", input)':'fmt.Fprintln(w, "user=" + input)';
 }else{
  output=safe?JSON.stringify(['viewer',input]):'viewer '+input;
  cells=safe?[{role:'固定可执行程序',text:'viewer'},{role:'单个参数 argv[1]',text:input}]:[{role:'交给 shell 的整段源码',text:output}];
  reason=safe?'exec.Command 不通过 shell 重新解释分号、空格等字符；输入保持一个参数。但目标程序仍解释选项，必须固定可信程序并验证参数业务含义。':'sh -c 会再次解释拼接字符串。此处只展示源码边界，不模拟完整 shell，也不运行命令。';
  code=safe?'cmd := exec.Command("viewer", input)\n// 检查 viewer 的选项与文件访问规则':'cmd := exec.Command("sh", "-c", "viewer " + input)';
 }
 const outcome:Outcome=!safe?'unencoded':context==='command'&&input.startsWith('-')?'option':'data';
 return {context,method,input,output,cells,outcome,reason,code};
}
export function snapshot(context:Context,method:Method,input:string,phase:number){const result=evaluate(context,method,input);const step=Math.max(0,Math.min(3,phase));return {context,method,input,phase:step,output:step>=2?result.output:null,cells:step>=2?result.cells:[],outcome:step>=3?result.outcome:null};}
