export const methods = ['Name', 'Save', 'Delete'] as const;
export type Method = typeof methods[number];
export type Provider = 'Guest' | 'Editor' | 'Store';
export const providers: Record<Provider, readonly Method[]> = { Guest:['Name'], Editor:['Name','Save'], Store:['Name','Save','Delete'] };
export const signatures: Record<Method,string> = { Name:'Name() string', Save:'Save()', Delete:'Delete()' };
export interface Config { needs: Method[]; contract: Method[]; provider: Provider }
export type Outcome = 'ready' | 'provider-missing' | 'contract-missing' | 'both-missing';
export const initial: Config = { needs:['Name'], contract:[...methods], provider:'Guest' };
export function toggle(list: readonly Method[], method: Method): Method[] { return methods.filter(m => m === method ? !list.includes(m) : list.includes(m)); }
export function inspect(config: Config) {
  const available = providers[config.provider];
  const omitted = config.needs.filter(m => !config.contract.includes(m));
  const unnecessary = config.contract.filter(m => !config.needs.includes(m));
  const missing = config.contract.filter(m => !available.includes(m));
  const unavailableNeeds = config.needs.filter(m => !available.includes(m));
  const outcome: Outcome = omitted.length ? (missing.length ? 'both-missing' : 'contract-missing') : missing.length ? 'provider-missing' : 'ready';
  return { omitted, unnecessary, missing, unavailableNeeds, outcome, output:outcome === 'ready' ? config.needs.map(m => m === 'Name' ? 'hello Ada' : m === 'Save' ? 'saved Ada' : 'deleted Ada').join(' → ') || '没有业务操作' : '编译检查失败，未执行业务' };
}
export function repair(config: Config): Config { return {...config, needs:[...config.needs], contract:[...config.needs]}; }
export const outcomeLabels: Record<Outcome,string> = { ready:'接口与调用都合法', 'provider-missing':'提供者缺少接口方法', 'contract-missing':'接口遗漏业务所需方法', 'both-missing':'两种编译问题同时存在' };
export function contractCode(config: Config) { return `type Consumer interface {\n${config.contract.map(m => `  ${signatures[m]}`).join('\n')}\n}\nfunc consume(s Consumer) {\n${config.needs.map(m => m === 'Name' ? '  fmt.Println("hello " + s.Name())' : `  s.${m}()`).join('\n')}\n}\n// 传入 ${config.provider}{}，其方法集：${providers[config.provider].join(', ') || '空'}`; }
