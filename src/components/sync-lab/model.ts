export type Action='a'|'b'|'both'|'read'|'inject'|'releaseA'|'releaseB';
export type State={id:number;fixed:boolean;size:number;pc:number[];blocked:boolean[];local:number[];x:number;y:number;count:number;owners:(number|null)[];saved:boolean;signal:boolean;exited:boolean;waiting:boolean;observed:string;message:string;line:string;ticks:string[]};
export type Operation={id:Action;label:string;enabled:boolean;why:string};
export function initial(id:number,fixed=false,size=2):State{
 if(id<41||id>50)throw new Error('Unknown lesson');
 return {id,fixed,size:Math.max(1,Math.min(3,Math.round(size)||2)),pc:[0,0],blocked:[false,false],local:[0,0],x:id===44?60:id===50?1:0,y:id===44?40:id===50?10:0,count:0,owners:[null,null],saved:false,signal:false,exited:false,waiting:false,observed:'尚未观察',message:'选择一个任务推进；操作顺序由你决定。',line:'尚未执行',ticks:[]};
}
export const lockOrder=(s:State,i:number)=>i===1&&!s.fixed?[1,0]:[0,1];
export const deadlocked=(s:State)=>s.id===46&&s.blocked.every(Boolean)&&s.pc.every(p=>p===1)&&s.owners.every(o=>o!==null)&&s.owners[0]!==s.owners[1]&&!s.fixed;
export function operations(s:State):Operation[]{
 const op=(id:Action,label:string,enabled=true,why='此操作已完成')=>({id,label,enabled,why}),{pc,fixed}=s;
 switch(s.id){
 case 41:return [op('a',pc[0]===0?'主任务：启动保存':fixed?'主任务：等待回执后返回':'主任务：直接返回',!s.exited),op('b',pc[1]===0?'后台：写入订单':'后台：发送完成回执',pc[0]>0&&pc[1]<2&&!s.exited,s.exited?'进程已经结束':'先启动任务；回执发送后任务完成')];
 case 42:return [op('a','让 A 执行一个时间片',pc[0]<s.size),op('b','让 B 执行一个时间片',pc[1]<s.size),op('both','让 A、B 同时执行一个时间片',fixed&&pc.every(p=>p<s.size),fixed?'需要两个任务都有剩余工作':'只有一个执行单元，不能同时执行两段 Go 计算')];
 case 43:return [0,1].map(i=>op(i?'b':'a',(i?'B':'A')+'：'+(['读取共享值','本地加增量','写回共享值'][pc[i]]??'已完成'),pc[i]<3&&(!fixed||s.owners[0]===null||s.owners[0]===i),pc[i]===3?'此任务已完成':'另一任务持有整段更新的锁，当前任务等待'));
 case 44:return [op('a',pc[0]===0?'转账：从 A 扣款':'转账：向 B 入账并释放锁',pc[0]<2),op('read','监控：读取账户总额')];
 case 45:return [op('a','A：尝试获取锁',s.owners[0]!==0),op('b','B：尝试获取锁',s.owners[fixed?0:1]!==1),op('releaseA','A：释放锁',s.owners[0]===0,'A 未持锁'),op('releaseB','B：释放锁',s.owners[fixed?0:1]===1,'B 未持锁'),op('read','检查谁能访问共享数据 X')];
 case 46:return [0,1].map(i=>op(i?'b':'a','任务 '+(i+1)+'：'+(pc[i]===2?'释放两把锁':pc[i]===3?'已完成':'请求锁 '+(lockOrder(s,i)[pc[i]]===0?'A':'B')),pc[i]<3));
 case 47:return [op('a',['查询：RLock 并检查','查询：'+(fixed?'RUnlock':'持读锁请求 Lock'),'查询：获取写锁','查询：复查并初始化','查询：释放写锁'][pc[0]]??'查询：已完成',pc[0]<5&&!s.waiting,s.waiting?'当前调用阻塞，无法到达后续释放语句':'查询完成'),op('inject','其他写者：在解锁间隙插入缓存',fixed&&pc[0]===2&&s.x===0,'仅在读锁释放、写锁尚未取得的间隙可插入')];
 case 48:return [op('a',fixed?'主任务：Add 并启动一批任务':'主任务：只启动一批任务',pc[0]===0),op('b',!fixed&&pc[1]===0?'后台：补做 Add':'后台：一个任务 Done',pc[0]>0&&pc[1]<s.size+(fixed?0:1),'先启动任务，每份登记只 Done 一次'),op('read','主任务：执行 Wait',pc[0]>0&&!s.exited,pc[0]===0?'先执行主任务的启动步骤':'本次 Wait 已返回，不会因之后 Add 而重新等待')];
 case 49:return [op('a','请求 '+(pc[0]+1)+'：调用 Do',pc[0]<s.size&&pc[1]===0,'先完成当前请求；全部处理后请重置'),op('b',pc[1]===1?'初始化：完成并返回':'当前请求：执行业务',pc[1]>0,'先发起请求')];
 case 50:return [op('a',pc[0]===0?'写者：更新版本':'写者：更新阈值并结束',pc[0]<2),op('read','读者：读取配置快照')];
 default:return [];
 }
}
export function transition(state:State,action:Action):State{
 if(!operations(state).some(o=>o.id===action&&o.enabled))return state;
 const s=structuredClone(state),i=action==='b'?1:0;
 s.line=operations(state).find(o=>o.id===action)!.label;
 switch(s.id){
 case 41:
  if(action==='a'){
   if(s.pc[0]===0){s.pc[0]=1;s.message='go save() 已启动后台任务，订单仍未保存；启动不等于完成。';}
   else if(s.fixed&&!s.signal){s.waiting=true;s.message='主任务停在 <-done；尚无回执，不能返回。继续执行后台任务。';}
   else{s.exited=true;s.waiting=false;s.message=s.signal?'确认完成后返回，保存已得到保证。':'main 返回，进程结束；'+(s.saved?'本次恰好写入，但没有同步确认，不能保证每次成功。':'后台未写入，保存丢失。');}
  }else if(s.pc[1]===0){s.saved=true;s.pc[1]=1;s.message='订单已写入，但完成回执尚未发出。写入和通知是两个事件。';}
  else{s.signal=true;s.pc[1]=2;s.waiting=false;s.message='close(done) 发出完成回执，主任务现在可以继续。';}break;
 case 42:{const actors=action==='both'?[0,1]:[i];actors.forEach(a=>s.pc[a]++);s.ticks.push(actors.map(a=>(a?'B':'A')+s.pc[a]).join(' + '));s.message='本时间片：'+s.ticks.at(-1)+'。'+(actors.length===2?'两个执行单元同时计算，产生并行。':'只有一个任务执行；切换任务可形成交错。')+' 总工作量不变。';break;}
 case 43:
  if(s.pc[i]===0){if(s.fixed)s.owners[0]=i;s.local[i]=s.x;s.message=(i?'B':'A')+' 读到 '+s.x+' 并保存本地快照'+(s.fixed?'，同时持有更新锁':'')+'。';}
  else if(s.pc[i]===1){s.local[i]+=s.size;s.message='本地值变为 '+s.local[i]+'，共享计数仍为 '+s.x+'。';}
  else{const before=s.x;s.x=s.local[i];s.owners[0]=null;s.message='共享计数 '+before+' → '+s.x+'，写回本地快照。'+(s.pc[1-i]===3&&s.x!==2*s.size?'旧快照覆盖另一贡献，发生丢失更新。':'需要两次完整更新才保留两份增量。');}s.pc[i]++;break;
 case 44:
  if(action==='read'){
   if(s.owners[0]!==null){s.waiting=true;s.message='监控等待转账锁。内部总额暂时不足 100，但读者不能进入临界区。';}
   else{s.waiting=false;s.observed=String(s.x+s.y);s.message='监控读到 '+s.observed+'。'+(s.x+s.y===100?'这次快照满足总额不变量。':'扣款后、入账前暴露了中间状态；单次访问加锁不足以保护整体。');}
  }else if(s.pc[0]++===0){s.x-=s.size*10;if(s.fixed)s.owners[0]=0;s.message='扣款 '+s.size*10+'：A='+s.x+'，B='+s.y+'。'+(s.fixed?'转账仍持锁，尝试监控读取。':'第一段锁已释放，尝试监控读取。');}
  else{s.y+=s.size*10;s.owners[0]=null;s.message='入账完成并释放锁；读者现在可以继续读取总额 100。';}break;
 case 45:{const slot=s.fixed?0:i;
  if(action==='releaseA'||action==='releaseB'){s.owners[action==='releaseA'||s.fixed?0:1]=null;s.message='释放该对象中的锁；共享数据 X 没有更换。';}
  else if(action==='read'){const owners=s.owners.filter(o=>o!==null);s.observed=owners.map(o=>o===0?'A':'B').join('、')||'无';s.message=owners.length===2?'A、B 都能进入各自临界区，却访问同一数据 X；没有互斥。':'互斥取决于锁实例身份；引用同一数据不会自动协调两把锁。';}
  else if(s.owners[slot]!==null)s.message='TryLock 返回 false：同一把锁已被另一任务持有，未获得访问权。';
  else{s.owners[slot]=i;s.message=(i?'B':'A')+' 的 TryLock 返回 true，取得'+(s.fixed?'对象 X 的唯一锁':'锁 '+(i?'B':'A'))+'。';}break;}
 case 46:{
  if(s.pc[i]===2){s.owners=s.owners.map(o=>o===i?null:o);s.pc[i]=3;s.message='任务 '+(i+1)+' 完成并释放两把锁；等待者可以重新获取。';break;}
  const lock=lockOrder(s,i)[s.pc[i]];
  if(s.owners[lock]!==null){s.blocked[i]=true;s.message='任务 '+(i+1)+' 等待锁 '+(lock?'B':'A')+'，由任务 '+(s.owners[lock]!+1)+' 持有。'+(deadlocked(s)?'形成等待环，都无法到达释放步骤。':'等待尚非死锁，让持锁者继续。');}
  else{s.blocked[i]=false;s.owners[lock]=i;s.pc[i]++;s.message='任务 '+(i+1)+' 取得锁 '+(lock?'B':'A')+'。'+(deadlocked(s)?'下一把锁互相被占用，等待环已形成。':'继续观察下一次请求和持有关系。');}break;}
 case 47:
  if(action==='inject'){s.x=s.size+10;s.message='其他写者在间隙插入 '+s.x+' 后释放锁。旧的“未命中”已失效。';}
  else if(s.pc[0]===0){s.count=1;s.pc[0]=1;s.message='RLock 成功，读者数为 1；缓存未命中。';}
  else if(s.pc[0]===1&&!s.fixed){s.waiting=true;s.message='Lock 等待所有读锁释放，包含自己的读锁；调用阻塞，后面的 RUnlock 无法执行。';}
  else if(s.pc[0]===1){s.count=0;s.pc[0]=2;s.message='RUnlock 后读者数归零。此间隙其他写者可以改变缓存。';}
  else if(s.pc[0]===2){s.owners[0]=0;s.pc[0]=3;s.message='取得写锁。必须复查，不能直接使用先前的未命中结论。';}
  else if(s.pc[0]===3){const existed=s.x!==0;if(!existed)s.x=s.size;s.pc[0]=4;s.message=existed?'复查命中 '+s.x+'，保留已有值，不重复初始化。':'复查仍未命中，初始化为 '+s.x+'。';}
  else{s.owners[0]=null;s.pc[0]=5;s.message='释放写锁，查询完成。';}break;
 case 48:
  if(action==='a'){s.pc[0]=1;if(s.fixed)s.count=s.size;s.message=s.fixed?'启动前 Add('+s.size+')，等待能看见这批任务。':'任务已启动但尚未 Add；此时尝试 Wait。';}
  else if(action==='read'){
   if(s.count===0){s.exited=true;s.waiting=false;s.observed='Wait 已返回';s.message=s.pc[1]===s.size+(s.fixed?0:1)?'计数归零，登记任务全部完成。':'计数为零，Wait 合法立即返回；它不等待未来的 Add，也不代表任务完成。';}
   else{s.waiting=true;s.observed='Wait 等待中';s.message='还有 '+s.count+' 份登记未 Done，Wait 等待。';}
  }else if(!s.fixed&&s.pc[1]===0){s.count=s.size;s.pc[1]=1;s.message='迟到的 Add('+s.size+') 已执行。'+(s.exited?'之前返回的 Wait 不会重新阻塞。':'主任务现在可以等待这一批。');}
  else{s.count--;s.pc[1]++;if(s.waiting&&s.count===0){s.waiting=false;s.exited=true;s.observed='Wait 已返回';}s.message='一个任务 Done，计数减为 '+s.count+'。'+(s.count===0?'这批任务全部完成。':'仍需其他任务 Done。');}break;
 case 49:
  if(action==='a'){s.pc[0]++;if(!s.saved){s.pc[1]=1;s.count++;s.message='首次 Do 进入初始化函数；尚未返回，后续业务不能执行。';}else if(s.fixed){s.pc[1]=2;s.message='Once 已完成，跳过初始化；仍要执行本次业务。';}else s.message='Once 已完成，整个函数体被跳过；放在里面的本次业务也丢失了。';}
  else if(s.pc[1]===1){s.saved=true;if(s.fixed){s.pc[1]=2;s.message='初始化完成，Do 返回；接下来执行外部业务。';}else{s.x++;s.pc[1]=0;s.message='初始化和业务执行一次；后续请求将跳过两者。';}}
  else{s.x++;s.pc[1]=0;s.message='请求 '+s.pc[0]+' 执行业务，累计 '+s.x+' 次；初始化仍为 '+s.count+' 次。';}break;
 case 50:
  if(action==='read'){
   if(s.owners[0]!==null){s.waiting=true;s.message='整体快照需要同一把锁；写者未完成，读者等待。';}
   else{s.waiting=false;s.observed=s.x+' / '+s.y;s.message='版本 / 阈值 = '+s.observed+'。'+(s.y===s.x*10?'这是一致快照。':'新版本配旧阈值；两个原子存储之间仍可插入读取。');}
  }else if(s.pc[0]++===0){s.x=s.size+1;if(s.fixed)s.owners[0]=0;s.message='版本变为 '+s.x+'，阈值仍为 10。'+(s.fixed?'整体锁未释放。':'此时允许读者读取。');}
  else{s.y=(s.size+1)*10;s.owners[0]=null;s.message='阈值更新完成；现在可读取完整的新版本。';}break;
 }
 return s;
}
export function metrics(s:State):[string,string][]{
 const owner=(i:number)=>s.owners[i]===null?'空闲':([43,45].includes(s.id)?(s.owners[i]===0?'A':'B'):'任务 '+(s.owners[i]!+1))+' 持有',reader=s.waiting?(s.owners[0]===null?'锁已释放，可继续读取':'等待锁'):'可发起读取';
 switch(s.id){
 case 41:return [['主任务',s.exited?'进程已结束':s.waiting?'等待 done':s.pc[0]?'已启动后台':'尚未启动'],['订单',s.saved?'已写入':'未写入'],['done',s.signal?'已关闭 / 完成通知':'未收到回执']];
 case 42:return [['A 工作量',s.pc[0]+' / '+s.size],['B 工作量',s.pc[1]+' / '+s.size],['教学时间片',String(s.ticks.length)],['执行单元',s.fixed?'2':'1']];
 case 43:return [['共享计数',String(s.x)],['A 本地快照',s.pc[0]?String(s.local[0]):'未读取'],['B 本地快照',s.pc[1]?String(s.local[1]):'未读取'],['更新锁',s.fixed?owner(0):'无同步'],['两份增量的目标',String(s.size*2)]];
 case 44:return [['账户 A',String(s.x)],['账户 B',String(s.y)],['内部总额',String(s.x+s.y)],['监控上次读到',s.observed],['转账锁',owner(0)],['读者',reader]];
 case 45:return [['锁 A / 对象锁',owner(0)],['锁 B',s.fixed?'与 A 是同一实例':owner(1)],['底层数据','始终是同一份 X'],['上次检查访问者',s.observed]];
 case 46:return [['锁 A',owner(0)],['锁 B',owner(1)],['等待环',deadlocked(s)?'已形成：1 → 2 → 1':'未形成'],['已完成任务',String(s.pc.filter(p=>p===3).length)]];
 case 47:return [['读者计数',String(s.count)],['写锁',s.waiting?'等待自己的读锁':owner(0)],['缓存值',s.x?String(s.x):'不存在'],['查询进度',s.pc[0]===5?'已完成':'第 '+(s.pc[0]+1)+' 步']];
 case 48:return [['WaitGroup 计数',String(s.count)],['完成任务',String(Math.max(0,s.pc[1]-(s.fixed?0:1)))],['Wait 状态',s.exited?'已经返回':s.waiting?'等待中':'尚未调用'],['本批任务数',String(s.size)]];
 case 49:return [['请求数',s.pc[0]+' / '+s.size],['初始化次数',String(s.count)],['业务执行次数',String(s.x)],['Once 状态',s.saved?'已完成':s.pc[1]===1?'初始化中':'未开始']];
 case 50:return [['内部版本',String(s.x)],['内部阈值',String(s.y)],['读者上次快照',s.observed],['整体锁',s.fixed?owner(0):'各字段独立原子操作'],['读者',reader]];
 default:return [];
 }
}
export function relations(s:State):[string,string,string][]{
 if(s.id===45)return s.fixed?[['指针 A','引用','对象 X（唯一锁 + 数据）'],['指针 B','引用','对象 X（唯一锁 + 数据）']]:[['缓存 A','持有','锁 A'],['缓存 B','持有','锁 B'],['缓存 A / B','共享引用','数据 X']];
 if(s.id===46)return [0,1].map(i=>s.pc[i]===3?['任务 '+(i+1),'完成','已释放']:s.pc[i]===2?['任务 '+(i+1),'持有','锁 A + 锁 B']:['任务 '+(i+1),s.blocked[i]?'等待':'下一步请求','锁 '+(lockOrder(s,i)[s.pc[i]]?'B':'A')]);
 if(s.id===47)return [['查询任务',s.count?'持有':'未持有','读锁'],['写锁','要求','读者计数 = 0'],['重新检查','读取','写锁保护下的缓存值']];
 if(s.id===41)return [['主任务','启动','后台保存'],['后台完成','关闭','done'],['主任务',s.fixed?'等待':'不等待','done']];
 if(s.id===43)return [['A / B','读 → 加 → 写','共享计数'],['更新锁',s.fixed?'覆盖':'未覆盖','完整读改写']];
 if(s.id===44||s.id===50)return [['写者',s.fixed?'同一锁内更新':'拆成两次更新','相关字段'],['读者',s.fixed?'同一锁内读取':'可插入更新间隙','整体快照']];
 if(s.id===48)return [['主任务',s.fixed?'Add 后启动':'启动后才 Add','后台任务'],['Done','递减','登记计数'],['Wait','只等待','计数归零']];
 if(s.id===49)return [['Once.Do','包含',s.fixed?'初始化':'初始化 + 业务'],['每次请求','执行',s.fixed?'Do 返回后的业务':'同一个 Do']];
 return [['执行资源','本片最多同时运行',s.fixed?'2 个计算任务':'1 个计算任务']];
}

