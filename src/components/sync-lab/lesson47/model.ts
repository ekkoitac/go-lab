export type Action='read'|'readerJoin'|'readerLeave'|'check'|'releaseRead'|'lock'|'otherLock'|'otherWrite'|'otherUnlock'|'recheck'|'fill'|'blindFill'|'unlock';
export interface State { readers:string[]; writer:'A'|'B'|null; phase:'start'|'reading'|'checked'|'gap'|'waiting'|'writing'|'reviewed'|'done'|'deadlock'; value:string|null; oldValue:string|null|undefined; checkedValue:string|null|undefined; generated:string; incoming:string; writes:number; message:string; }
export function initialState(generated='A 生成的值',incoming='B 已生成的值'):State {return {readers:[],writer:null,phase:'start',value:null,oldValue:undefined,checkedValue:undefined,generated,incoming,writes:0,message:'缓存为空。先让 A 取得读锁并检查，再安排其他读者或写者。'};}
export function canStep(s:State,a:Action):boolean {
 switch(a){
 case 'read':return s.phase==='start';
 case 'readerJoin':return !s.writer&&!s.readers.includes('R')&&!['waiting','deadlock','done'].includes(s.phase);
 case 'readerLeave':return s.readers.includes('R');
 case 'check':return s.phase==='reading';
 case 'releaseRead':return s.phase==='checked';
 case 'lock':return s.phase==='checked'||s.phase==='gap'||(s.phase==='waiting'&&!s.writer&&!s.readers.length);
 case 'otherLock':return s.phase==='gap'&&!s.writer&&!s.readers.length;
 case 'otherWrite':return s.writer==='B'&&s.value!==s.incoming;
 case 'otherUnlock':return s.writer==='B';
 case 'recheck':return s.phase==='writing';
 case 'fill':return s.phase==='reviewed'&&s.checkedValue===null&&s.value===null;
 case 'blindFill':return s.phase==='writing';
 case 'unlock':return s.writer==='A'&&(s.phase==='reviewed'||s.phase==='writing')&&s.value!==null;
 }
}
export function lockOutcome(s:State):'blocked'|'acquired'{return s.writer||s.readers.length?'blocked':'acquired';}
export function step(s:State,a:Action):State {
 if(!canStep(s,a))return s;
 const n:State={...s,readers:[...s.readers]};
 switch(a){
 case 'read':n.readers.push('A');n.phase='reading';n.message='A 获得 RLock。其他读者可以同时进入，写者需要等所有读锁释放。';break;
 case 'readerJoin':n.readers.push('R');n.message='读者 R 也获得 RLock：两个读者共存不代表读锁能升级。';break;
 case 'readerLeave':n.readers=n.readers.filter(r=>r!=='R');n.message='读者 R 释放 RLock。检查 A 是否仍持读锁。';break;
 case 'check':n.oldValue=s.value;n.phase='checked';n.message='A 在读锁内检查：缓存未命中。这份检查证据只对应当时的值。';break;
 case 'releaseRead':n.readers=n.readers.filter(r=>r!=='A');n.phase='gap';n.message='A 已 RUnlock，尚未 Lock。间隙开放：其他写者可能先填充缓存。';break;
 case 'lock':
 if(lockOutcome(s)==='blocked'){n.phase=s.readers.includes('A')?'deadlock':'waiting';n.message=s.readers.includes('A')?'A 的 Lock 等所有读锁释放，但 A 自己的 RUnlock 在 Lock 返回之后：此路径无法推进。请回退修复。':'A 的 Lock 尚未返回，等待现有持锁者释放。释放后再调度 A 恢复。';}
 else {n.writer='A';n.phase='writing';n.message='A 获得独占写锁。之前的未命中检查可能已经过期，先复查缓存。';}break;
 case 'otherLock':n.writer='B';n.message='B 趁 A 尚未请求写锁，先获得 Lock。A 此时请求 Lock 会等待。';break;
 case 'otherWrite':n.value=s.incoming;n.writes++;n.message=`B 在写锁内填充「${s.incoming}」。A 的旧证据仍是未命中。`;break;
 case 'otherUnlock':n.writer=null;n.message='B 释放写锁；现在可以调度 A 获取写锁。';break;
 case 'recheck':n.checkedValue=s.value;n.phase='reviewed';n.message=s.value===null?'写锁内复查仍为空，可以安全生成并写入。':`写锁内复查命中「${s.value}」，直接复用，不重复生成。`;break;
 case 'fill':n.value=s.generated;n.writes++;n.message='A 在复查为空后填充，检查和修改都处在同一写锁内。';break;
 case 'blindFill':n.value=s.generated;n.writes++;n.message=s.value===null?'这次恰好没有竞争写者，但旧检查不能保证其他调度也安全。':`A 未复查就覆盖「${s.value}」，旧的未命中证据导致重复生成和覆盖。`;break;
 case 'unlock':n.writer=null;n.phase='done';n.message=`A 释放写锁并返回「${s.value}」。本轮缓存写入 ${s.writes} 次。`;break;
 }return n;
}
export function runSchedule(actions:Action[],generated?:string,incoming?:string):State{return actions.reduce(step,initialState(generated,incoming));}
