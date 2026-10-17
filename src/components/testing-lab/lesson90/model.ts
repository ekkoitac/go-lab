export type Version = '1.21.3' | '1.22.0' | '1.22.6';
export type GoLine = '1.21.0' | '1.22.0';
export type Outcome = 'bundled' | 'path' | 'download' | 'blocked';
export interface Config { go: GoLine; suggested: boolean; bundled: '1.21.3' | '1.22.6'; policy: 'local' | 'auto'; onPath: boolean; online: boolean }
export interface Resolution { outcome: Outcome; selected: Version | null; target: Version; language: string; trace: string[] }
export const initialConfig: Config = {go:'1.21.0',suggested:true,bundled:'1.21.3',policy:'auto',onPath:false,online:false};
export const transferConfig: Config = {go:'1.22.0',suggested:false,bundled:'1.21.3',policy:'local',onPath:false,online:false};
export const labels: Record<Outcome,string> = {bundled:'使用随命令附带的工具链',path:'切换到 PATH 上的工具链',download:'需要下载目标工具链',blocked:'无法启动构建'};
export function compare(a:string,b:string):number { const x=a.split('.').map(Number),y=b.split('.').map(Number); for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]-y[i];}return 0; }
export function resolve(c:Config):Resolution {
 const target:Version=c.suggested?'1.22.6':compare(c.bundled,c.go)>=0?c.bundled:'1.22.0';
 const trace=[`go ${c.go}：最低工具链要求；本模块语言版本为 ${c.go.slice(0,4)}。`,c.policy==='local'?`local：固定使用随 go 命令附带的 go${c.bundled}，不自动切换。`:`auto：比较附带版本 go${c.bundled} 与${c.suggested?'建议 go1.22.6':'模块最低要求'}。`];
 let outcome:Outcome,selected:Version|null;
 if(c.policy==='local') { selected=compare(c.bundled,c.go)>=0?c.bundled:null; outcome=selected?'bundled':'blocked';trace.push(selected?'附带工具链满足 go 最低要求；更高的 toolchain 建议不强制升级。':'附带工具链低于 go 最低要求；即使 PATH 有新版也不自动切换。'); }
 else if(compare(c.bundled,target)>=0){outcome='bundled';selected=c.bundled;trace.push('附带工具链已经满足要求和建议，无需寻找或下载。');}
 else if(c.onPath){outcome='path';selected=target;trace.push(`PATH 已有可执行的 go${target}，离线也可切换。`);}
 else if(c.online){outcome='download';selected=target;trace.push(`PATH 没有 go${target}；本模型假设远程可达、校验通过，模拟下载后使用。`);}
 else {outcome='blocked';selected=null;trace.push(`需要 go${target}，PATH 和下载缓存均无此版本；离线无法获取。`);}
 trace.push(selected?`最终工具链 go${selected}；模块语言版本仍为 ${c.go.slice(0,4)}。`:'构建尚未启动，不能记录为测试通过。');
 return {outcome,selected,target,language:c.go.slice(0,4),trace};
}
export type Evidence = 'version'|'platform'|'module'|'sum';
export const evidenceLabels: Record<Evidence,string> = {version:'实际 go version',platform:'GOOS / GOARCH',module:'go.mod 与 GOTOOLCHAIN',sum:'go.sum（依赖内容校验）'};
export function record(c:Config,selected:Evidence[]):string[] { const r=resolve(c); return selected.map(key=>key==='version'?`实际工具链：${r.selected?`go${r.selected}`:'未启动，暂无实际运行版本'}`:key==='platform'?'环境：windows / amd64（本模型固定值）':key==='module'?`go ${c.go}; toolchain ${c.suggested?'go1.22.6':'未写'}; GOTOOLCHAIN=${c.policy}`:'go.sum：校验模块内容，不锁定工具链、系统或完整依赖选择；依赖选择还受 go.mod 等影响。'); }
