export type Platform = 'unix' | 'windows';
export type Scenario = 'normal' | 'parent' | 'absolute' | 'inside' | 'outside' | 'prefix' | 'backslash';
export type Input = {platform: Platform; scenario: Scenario};
export const initial: Input = {platform:'unix',scenario:'outside'};
export const scenarios: Record<Scenario,string> = {normal:'普通路径：含点和冗余分隔符',parent:'父目录跳转',absolute:'绝对路径',inside:'根内符号链接',outside:'根外符号链接',prefix:'同前缀的相邻目录',backslash:'反斜线的平台差异'};
export function scenario(input:Input){
 const win=input.platform==='windows',root=win?'C:\\uploads':'/uploads',sep=win?'\\':'/';
 const paths={normal:'docs//./report.txt',parent:'../secret.txt',absolute:win?'C:\\secret.txt':'/secret.txt',inside:'shortcut/report.txt',outside:'portal/secret.txt',prefix:'../uploads-old/secret.txt',backslash:'..\\secret.txt'};
 const raw=paths[input.scenario];
 const normalized=input.scenario==='normal'?'docs/report.txt':raw;
 const clean=win?normalized.replaceAll('/',sep):normalized;
 const local=!['parent','absolute','prefix'].includes(input.scenario)&&!(win&&input.scenario==='backslash');
 const escape=['parent','absolute','outside','prefix'].includes(input.scenario)||(win&&input.scenario==='backslash');
 const target=input.scenario==='prefix'?(win?'C:\\uploads-old\\secret.txt':'/uploads-old/secret.txt'):escape?(win?'C:\\secret.txt':'/secret.txt'):root+sep+(input.scenario==='inside'?'docs/report.txt':normalized).replaceAll('/',sep);
 const link=input.scenario==='inside'?'shortcut → docs':input.scenario==='outside'?'portal → ..':null;
 const reason=input.scenario==='outside'?'portal 的相对目标是 ..；文件名词法局部，解析链接时却跨过根边界。':input.scenario==='prefix'?'uploads-old 是 uploads 的相邻目录；字符串前缀相同不等于目录包含关系。':input.scenario==='backslash'?win?'Windows 把反斜线视作分隔符，.. 会跳出根。':'Unix 把反斜线视作普通字符；虚拟树中存在这个完整文件名。':input.scenario==='inside'?'shortcut 指向根内 docs；解析相对符号链接后仍在根内。':escape?'输入是绝对路径或跳向父目录；Clean 不会赋予访问权限。':'点与重复分隔符只是写法；最终文件仍在根内。';
 return {root,raw,clean,local,target,link,escape,allowed:!escape,reason};
}
export function pathState(input:Input,step:number){
 const s=scenario(input),phase=Math.max(0,Math.min(3,step));
 return {platform:input.platform,scenario:input.scenario,phase,root:s.root,raw:s.raw,clean:phase>=1?s.clean:null,local:phase>=2?s.local:null,target:phase>=3?s.target:null,allowed:phase>=3?s.allowed:null,link:s.link,route:phase>=3?[s.root,...(s.link?[s.link]:[]),s.target]:[s.root]};
}
export type Session={input:Input;step:number;prediction:string;reason:string;locked:boolean};
export const createSession=(input:Input=initial):Session=>({input:{...input},step:0,prediction:'',reason:'',locked:false});
export function transition(s:Session,action:'next'|'back'|'reset',free=false):Session {
 if(action==='reset')return createSession();
 if(action==='next')return {...s,step:Math.min(3,s.step+(free||s.locked?1:0))};
 return {...s,step:Math.max(0,s.step-1)};
}
export const changeInput=(s:Session,input:Input):Session=>({...createSession(input)});
export type Defense='clean'|'local'|'root';
export function repairCheck(defense:Defense){return [
 {name:'下载报告：docs/report.txt',expected:true,actual:true},
 {name:'下载别名：ticket → ../secret.txt',expected:false,actual:defense!=='root'},
 {name:'相邻目录：../uploads-old/secret.txt',expected:false,actual:defense==='clean'},
 ];}

