export type Entry = {name: string; bytes: number; link?: boolean};
export type Input = {bytes: number; limit: number; declared: number | null; expandedLimit: number; entryLimit: number; archive: Entry[] | null};
export type Strategy = 'n' | 'probe';
export type ReadState = {phase: 'header' | 'read' | 'entry' | 'expand' | 'done'; read: number; expanded: number; entry: number; entryBytes: number; inspected: number; result: 'pending' | 'accepted' | 'rejected'; returned: number; note: string};
export type Scenario = 'over' | 'exact' | 'empty' | 'bomb' | 'entries' | 'path' | 'link';
export const scenarioNames: Record<Scenario,string> = {over:'未知长度 · 5 字节',exact:'恰好上限 · 4 字节',empty:'空输入 · 0 字节',bomb:'压缩 2 → 解压 10 字节',entries:'小文件很多 · 3 个条目',path:'归档路径 ../secret',link:'归档符号链接'};
export function preset(s: Scenario): Input {
  const base: Input = {bytes:5,limit:4,declared:null,expandedLimit:8,entryLimit:2,archive:null};
  if(s==='exact')return {...base,bytes:4};
  if(s==='empty')return {...base,bytes:0};
  if(s==='bomb')return {...base,bytes:2,archive:[{name:'report.txt',bytes:10}]};
  if(s==='entries')return {...base,bytes:2,archive:[{name:'a',bytes:1},{name:'b',bytes:1},{name:'c',bytes:1}]};
  if(s==='path')return {...base,bytes:2,archive:[{name:'../secret',bytes:1}]};
  if(s==='link')return {...base,bytes:2,archive:[{name:'shortcut',bytes:0,link:true}]};
  return base;
}
export function initial(): ReadState {return {phase:'header',read:0,expanded:0,entry:0,entryBytes:0,inspected:0,result:'pending',returned:0,note:'尚未消费输入。先预测两种读取方式的结果。'};}
function reject(s:ReadState,note:string):ReadState{return {...s,phase:'done',result:'rejected',returned:0,note};}
function finishRead(s:ReadState,c:Input,note:string):ReadState{if(c.archive&&s.read<c.bytes)return reject(s,'读取器已截断归档；本模型归档要求完整压缩输入，模拟格式检查拒绝，未解压。');return c.archive?{...s,phase:'entry',note:note+' 上传预算已通过，进入独立归档检查。'}:{...s,phase:'done',result:'accepted',returned:s.read,note};}
// Conservative teaching policy, not filesystem containment or a real extractor.
export function unsafePath(name:string):boolean{return !name||/^(?:[\\/]|[A-Za-z]:)/.test(name)||name.split(/[\\/]/).includes('..');}
export function step(s:ReadState,c:Input,strategy:Strategy):ReadState {
  if(s.phase==='done')return s;
  if(s.phase==='header') {
    const bounded=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=1024;
    if(![c.bytes,c.limit,c.expandedLimit,c.entryLimit].every(bounded)||c.archive?.some(e=>!bounded(e.bytes)))return reject(s,'配置无效：教学模型只接受 0–1024 的整数预算和大小。');
    if(c.declared!==null&&(!Number.isSafeInteger(c.declared)||c.declared<0))return reject(s,'长度头格式无效。');
    if(c.declared!==null&&c.declared>c.limit)return reject(s,'长度头超过上限，提前拒绝，实际读取仍为 0。');
    return {...s,phase:'read',note:c.declared===null?'没有长度头：无法预先证明大小，继续实际读取。':'长度头声称 '+c.declared+'：这里只作预检，实际读取仍须限额。'};
  }
  if(s.phase==='read') {
    if(strategy==='n'&&s.read===c.limit)return finishRead(s,c,'LimitReader 达到 N='+c.limit+'，报告 EOF；调用者无法据此区分真 EOF 与限额截断。');
    if(s.read===c.bytes)return finishRead(s,c,'向源流再读，得到真实 EOF；已读 '+s.read+' ≤ '+c.limit+'，完整输入通过。');
    const read=s.read+1;
    if(strategy==='probe'&&read>c.limit)return reject({...s,read},'读到第 '+read+' 字节（N+1），证实超额；拒绝并丢弃暂存，业务得到 0 字节。');
    return {...s,read,note:'本步实际读取 1 字节：'+s.read+' → '+read+'。'+(read===c.limit?'到达 N，但尚未证明源流结束。':'尚未结束，继续读取。')};
  }
  const entries=c.archive??[];
  if(s.phase==='entry') {
    if(s.entry===entries.length)return {...s,phase:'done',result:'accepted',returned:s.read,note:'归档结束：解压 '+s.expanded+'/'+c.expandedLimit+' 字节，条目 '+s.inspected+'/'+c.entryLimit+'；模型接受。'};
    const entry=entries[s.entry]; const inspected=s.inspected+1;
    if(inspected>c.entryLimit)return reject({...s,inspected},'第 '+inspected+' 个条目超过条目预算 '+c.entryLimit+'，拒绝；尚未展开该条目。');
    if(unsafePath(entry.name))return reject({...s,inspected},'条目 '+entry.name+' 违反路径策略，拒绝；不能写出目标目录。');
    if(entry.link)return reject({...s,inspected},'条目 '+entry.name+' 是链接；本模型拒绝所有链接，不跟随。');
    return {...s,inspected,phase:'expand',note:'检查条目 '+entry.name+'：数量、路径和类型通过，开始统计实际解压字节。'};
  }
  const entry=entries[s.entry];
  if(s.entryBytes===entry.bytes)return {...s,phase:'entry',entry:s.entry+1,entryBytes:0,note:'条目 '+entry.name+' 结束。累计解压 '+s.expanded+' 字节，切到下一条目检查。'};
  const expanded=s.expanded+1;
  if(expanded>c.expandedLimit)return reject({...s,expanded,entryBytes:s.entryBytes+1},'解压读到第 '+expanded+' 字节，超过独立预算 '+c.expandedLimit+'；停止展开并拒绝，上传 '+s.read+' 字节合规也不能放行。');
  return {...s,expanded,entryBytes:s.entryBytes+1,note:'解压输出增加 1 字节：'+s.expanded+' → '+expanded+'；上传计数保持 '+s.read+'。'};
}
export function trace(c:Input,strategy:Strategy):ReadState[] {const states=[initial()];for(let i=0;i<10000&&states.at(-1)!.phase!=='done';i++)states.push(step(states.at(-1)!,c,strategy));return states;}
export function verdict(s:ReadState,c:Input):string{return s.result==='pending'?'等待执行':s.result==='rejected'?'拒绝':s.read<c.bytes?'接受了截断内容':'完整接受';}


