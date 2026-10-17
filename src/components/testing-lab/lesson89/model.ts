export type Tool = 'format' | 'vet' | 'test';
export type Assertion = 'none' | 'output' | 'boundary' | 'both';
export interface Config { formatted: boolean; verbFixed: boolean; boundaryFixed: boolean; assertion: Assertion; input: number; threshold: number; enabled: Record<Tool, boolean>; }
export interface Evidence { tool: Tool; status: 'pass' | 'fail' | 'skipped'; detail: string; }
export const tools: Tool[] = ['format', 'vet', 'test'];
export const labels: Record<Tool, string> = {format: 'gofmt -l main.go', vet: 'go vet ./...', test: 'go test -vet=off ./...'};
export function initialConfig(threshold = 100): Config { return {formatted:false, verbFixed:false, boundaryFixed:false, assertion:'both', input:threshold, threshold, enabled:{format:true,vet:true,test:true}}; }
export function values(c: Config) {
  const eligible = c.boundaryFixed ? c.input >= c.threshold : c.input > c.threshold;
  return {text:c.verbFixed ? '7' : '%!d(string=7)', eligible, expectedEligible:c.input >= c.threshold};
}
export function inspect(c: Config, tool: Tool): Evidence {
  if (!c.enabled[tool]) return {tool,status:'skipped',detail:'未配置此检查：没有这类证据。'};
  if (tool === 'format') return {tool,status:c.formatted?'pass':'fail',detail:c.formatted?'列表为空：源码排版已规范；没有检查业务行为。':'列表输出 main.go：存在格式差异。检查本身不改文件；CI 需将非空列表判为失败。'};
  if (tool === 'vet') return {tool,status:c.verbFixed?'pass':'fail',detail:c.verbFixed?'本模型未发现格式串风险；无法判断满额优惠规则。':'Printf 风格静态检查发现：%d 需要整数，参数 "7" 是 string。'};
  const v = values(c);
  const failures:string[] = [];
  if ((c.assertion==='output'||c.assertion==='both') && v.text!=='7') failures.push('文本断言：got '+v.text+'，want 7');
  if ((c.assertion==='boundary'||c.assertion==='both') && v.eligible!==v.expectedEligible) failures.push('满额断言：输入 '+c.input+'，got '+v.eligible+'，want '+v.expectedEligible);
  return {tool,status:failures.length?'fail':'pass',detail:failures.length?failures.join('；'):c.assertion==='none'?'未添加行为断言；命令成功不构成行为正确的证据。':'已选择的断言通过；未选择的断言和其他输入仍未验证。'};
}
export function firstFailure(c: Config): Tool | 'none' { return tools.find(t=>inspect(c,t).status==='fail') ?? 'none'; }
export function source(c:Config) {
  const expression='total '+(c.boundaryFixed?'>=':'>')+' '+c.threshold;
  return c.formatted ? 'func eligible(total int) bool {\n\treturn '+expression+'\n}\nfunc label() string {\n\treturn fmt.Sprintf("'+(c.verbFixed?'%s':'%d')+'", "7")\n}' : 'func eligible(total int)bool{return '+expression+'}\nfunc label()string{return fmt.Sprintf("'+(c.verbFixed?'%s':'%d')+'","7")}';
}

