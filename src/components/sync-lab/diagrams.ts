import {deadlocked,lockOrder,type State} from './model';
export type DiagramNode={id:string;x:number;y:number;w:number;h:number;lines:string[];note:string;tone?:'active'|'warn'|'muted';shape?:'round'|'lock'};
export type DiagramEdge={from:string;to:string;label:string;wait?:boolean;path?:string;labelX?:number;labelY?:number};
export type DiagramMark={x:number;y:number;w:number;h:number;fill:string;label?:string;round?:boolean;outline?:boolean};
export type Drawing={title:string;description:string;nodes:DiagramNode[];edges:DiagramEdge[];marks:DiagramMark[];labels:{x:number;y:number;text:string}[]};
export function drawing(s:State):Drawing{
 const d:Drawing={title:'',description:'',nodes:[],edges:[],marks:[],labels:[]};
 const n=(id:string,x:number,y:number,lines:string[],note:string,tone:DiagramNode['tone']='active',w=128,h=56,shape?:DiagramNode['shape'])=>d.nodes.push({id,x,y,w,h,lines,note,tone,shape});
 const e=(from:string,to:string,label:string,wait=false,path?:string,labelX?:number,labelY?:number)=>d.edges.push({from,to,label,wait,path,labelX,labelY});
 const label=(x:number,y:number,text:string)=>d.labels.push({x,y,text});
 const mark=(x:number,y:number,w:number,h:number,fill:string,label?:string,round=false)=>d.marks.push({x,y,w,h,fill,label,round});
 const holding=(i:number)=>s.owners[i]===null?'空闲':'任务 '+(s.owners[i]!+1)+' 持有';
 switch(s.id){
 case 41:
  d.title='启动与完成，是两个事件';d.description='沿两条生命线向下读；横向箭头是任务启动和完成通知。';
  mark(40,30,135,275,'#f0f5ed');mark(225,30,135,275,'#edf5f6');
  label(107,22,'主任务');label(292,22,'后台任务');
  n('start',107,75,['go save()'], '这一步只启动后台任务，不等待它结束。','active',112,42);
  n('worker',292,75,[s.pc[0]?'已启动':'尚未启动'],'goroutine 已创建后仍需要获得执行机会。',s.pc[0]?'active':'muted',112,42);
  n('write',292,165,[s.saved?'订单已写入':'等待写入'],'写入完成和通知调用者是两个独立事件。',s.saved?'active':'muted',112,46);
  n('done',292,260,[s.signal?'done 已关闭':'尚无完成回执'],'close(done) 让等待者获得后台完成的证据。',s.signal?'active':'muted',124,46);
  n('main',107,260,[s.exited?'main 已返回':s.waiting?'等待 done':'尚未返回',s.exited&&!s.signal?'进程结束':''], 'main 返回会结束程序；后台任务没有隐式 join。',s.exited&&!s.signal?'warn':'active',124,58);
  e('start','worker','启动');e('worker','write','执行');e('write','done','通知');
  if(s.fixed)e('done','main',s.signal?'收到回执':'等待回执',!s.signal);
  else e('start','main','直接返回',true);
  break;
 case 42:
  d.title='时间向右，同列才是同时执行';d.description='同一个纵列表示同一教学时间片；A、B 都有色块才是并行。';
  label(45,80,'任务 A');label(45,180,'任务 B');
  for(let col=0;col<4;col++){
   mark(90+col*68,45,60,170,col%2?'#f3f6f0':'#eaf1e9');label(120+col*68,242,'t'+(col+1));
   for(const [row,actor] of ['A','B'].entries()){const tick=s.ticks[col];if(tick?.includes(actor))mark(98+col*68,62+row*100,44,42,row?'#c9e4ec':'#bedbb8',tick.split(' + ').find(t=>t.startsWith(actor)));}
  }
  n('resources',200,300,[s.fixed?'2 个执行单元':'1 个执行单元','已用 '+s.ticks.length+' 个时间片'],'每任务固定 2 单位工作，忽略调度通信开销；不是毫秒或性能基准。','active',240,52);
  break;
 case 43:
  d.title='共享一个值，各自保存旧快照';d.description='读取流向本地，写回流向共享位置；覆盖不会自动合并增量。';
  if(s.fixed)mark(15,30,370,290,'#edf5e8','');
  n('a',100,95,['任务 A','本地 = '+(s.pc[0]?s.local[0]:'未读')],'A 的本地快照不会随着共享值改变自动刷新。','active',142,60);
  n('b',300,95,['任务 B','本地 = '+(s.pc[1]?s.local[1]:'未读')],'B 从自己的快照计算；旧快照写回会覆盖别人的贡献。','active',142,60);
  n('shared',200,260,['共享计数 = '+s.x,'两份贡献应为 '+(2*s.size)],'所有写回都落到同一个共享位置。',s.pc.every(p=>p===3)&&s.x!==s.size*2?'warn':'active',166,60);
  e('shared','a','读取',false,'M 140 240 Q 40 215 80 130',55,190);
  e('a','shared','写回',false,'M 120 125 L 178 226',155,175);
  e('shared','b','读取',false,'M 260 240 Q 360 215 320 130',345,190);
  e('b','shared','写回',false,'M 280 125 L 222 226',245,175);
  label(200,24,s.fixed?'整段更新锁：'+holding(0):'无同步：读、加、写可交错');
  break;
 case 44:
  d.title='锁边界决定谁能看见中间态';d.description='柱高表示余额；监控箭头穿过同一锁边界才能读取。';
  mark(25,45,350,155,s.fixed?'#e8f1e5':'#f4f5f1');
  label(200,30,s.fixed?'同一临界区：扣款 + 入账':'两个独立临界区');
  mark(55,62,94,116,'#fff');mark(251,62,94,116,'#fff');
  mark(55,178-s.x,94,s.x,'#afd1b0');mark(251,178-s.y,94,s.y,'#b6d5df');
  n('a',102,95,['A = '+s.x],'A 先扣款，内部总额可能短暂下降。','active',100,40);
  n('b',298,95,['B = '+s.y],'B 入账后内部总额恢复 100。','active',100,40);
  e('a','b','转账 '+s.size*10);
  n('monitor',200,275,['监控快照',s.waiting?'等待锁':s.observed], '监控也要拿同一把锁，整体锁才能隐藏中间状态。',s.waiting||s.observed!=='100'&&s.observed!=='尚未观察'?'warn':'active',180,64);
  e('a','monitor',s.owners[0]!==null?'锁未释放':'可读取',s.owners[0]!==null,undefined,95,222);
  e('b','monitor',s.owners[0]!==null?'锁未释放':'可读取',s.owners[0]!==null,undefined,305,222);
  break;
 case 45:
  d.title=s.fixed?'两条引用指向同一个对象':'复制了锁，仍然共享数据';d.description='箭头表示对象引用；先辨认锁的身份，再看共享数据的身份。';
  n('a',85,60,[s.fixed?'指针 A':'缓存 A'],'A 引用的锁和数据是否与 B 属于同一个对象？','active',120,48);
  n('b',315,60,[s.fixed?'指针 B':'缓存 B'],'只共享数据却复制锁，会得到两套互不协调的保护。','active',120,48);
  if(s.fixed){
   mark(95,135,210,200,'#e9f2e5');label(200,155,'同一个 Cache 对象');
   n('lock',200,208,['唯一 Mutex',holding(0)],'两个引用使用同一锁实例，A 持锁时 B TryLock 为 false。','active',152,62,'lock');
   n('data',200,300,['数据 X'],'对象与保护它的锁一起通过指针共享。','active',152,45);
   e('a','lock','引用');e('b','lock','引用');e('lock','data','保护');
  }else{
   n('la',85,175,['Mutex A',holding(0)],'锁 A 的状态独立于锁 B。','active',128,62,'lock');
   n('lb',315,175,['Mutex B',holding(1)],'首次使用前复制零值锁，B 可在 A 持锁时得到自己的锁。','active',128,62,'lock');
   n('data',200,300,['同一份数据 X'],'两条引用最终指向同一数据，并没有形成互斥。',s.owners.every(o=>o!==null)?'warn':'active',180,48);
   e('a','la','包含');e('b','lb','包含');e('la','data','保护同一数据',false,undefined,85,257);e('lb','data','保护同一数据',false,undefined,315,257);
  }break;
 case 46:
  d.title='把“等待”连起来，看是否成环';d.description='实线由锁指向持有者；虚线由任务指向正在等待的锁。';
  n('t0',200,52,['任务 1'], '任务 1 的顺序固定为先 A 后 B。','active',108,48,'round');
  n('t1',200,300,['任务 2'],s.fixed?'任务 2 也按 A → B 获取。':'任务 2 按 B → A 获取。','active',108,48,'round');
  n('l0',320,175,['锁 A'],holding(0),'active',100,60,'lock');
  n('l1',80,175,['锁 B'],holding(1),'active',100,60,'lock');
  s.owners.forEach((owner,l)=>{if(owner!==null)e('l'+l,'t'+owner,'持有');});
  s.blocked.forEach((blocked,i)=>{if(blocked)e('t'+i,'l'+lockOrder(s,i)[s.pc[i]],'等待',true);});
  label(200,166,deadlocked(s)?'等待环闭合':'尚未形成环');
  label(200,190,deadlocked(s)?'双方无法继续':'可继续逐步观察');
  break;
 case 47:
  d.title=s.fixed?'解锁的空隙必须重新检查':'自己也是写锁要等待的读者';d.description=s.fixed?'沿箭头走一遍，橙色支路展示其他写者插入的位置。':'读锁仍由自己持有，写锁等待归零，构成自我阻塞。';
  n('read',105,65,['RLock 检查','读者数 = '+s.count], '只允许并发读；读锁不能升级为写锁。','active',150,60);
  n('write',105,205,[s.fixed?'Lock 后复查':'请求写锁',s.waiting?'被自己阻塞':'缓存 = '+(s.x||'无')], '写锁需要所有读者离开；重新取得锁之后旧观察可能失效。',s.waiting?'warn':'active',150,60,'lock');
  if(s.fixed){
   n('other',300,135,['其他写者',s.x>10?'已插入 '+s.x:'可在间隙插入'], '从 RUnlock 到 Lock 不是原子切换。','warn',150,60);
   e('read','write','先 RUnlock',false,undefined,87,140);
   e('read','other','释放后的空隙',false,'M 180 65 L 300 65 L 300 100',285,49);e('other','write','改变缓存',false,'M 300 165 L 300 205 L 184 205',300,188);
   n('result',200,305,[s.pc[0]>=4?'保留值 '+s.x:'复查后再决定'], '已存在就使用已有值；不存在才初始化。','active',190,46);
   e('write','result','复查');
  }else{
   n('reader',300,135,[s.count?'自己持有读锁':'尚未持有读锁',s.count?'尚未 RUnlock':'读者数为零'],'阻塞在 Lock，后面的 RUnlock 到不了。','warn',150,60);
   if(s.count)e('read','reader','持有',false,'M 180 65 L 300 65 L 300 100',285,49);if(s.waiting)e('reader','write','阻止写锁',true,'M 300 165 L 300 205 L 184 205',300,188);
   if(s.waiting)e('write','reader','等待读者离开',true,'M 180 220 Q 370 305 330 170',285,274);
  }break;
 case 48:
  d.title='Wait 看的是登记数量';d.description='圆点是尚未 Done 的登记；任务已经启动，并不等于已经登记。';
  n('start',90,60,[s.pc[0]?'任务已启动':'尚未启动'], '启动和登记是两个事实。','active',144,50);
  n('register',300,60,['Add 登记',s.fixed?'启动前':'后台稍后'], '从零开始的一批任务，要在启动前登记。','active',144,50);
  e(s.fixed?'register':'start',s.fixed?'start':'register',s.fixed?'先登记':'先启动');
  mark(45,130,310,100,'#eef3e8');label(200,151,'尚未完成的登记：'+s.count);
  for(let i=0;i<2;i++)mark(145+i*65,170,38,38,i<s.count?'#659678':'#dfe6db',i<s.count?'1':'0',true);
  n('wait',200,300,['Wait',s.exited?'已返回':s.waiting?'等待计数归零':'尚未调用'], 'Wait 只等当前计数归零，不等待未来的 Add。',s.exited&&s.pc[1]<2?'warn':'active',200,56);
  e('register','wait','计数是否为零？',s.waiting,'M 365 85 L 380 255 L 300 280',305,251);
  break;
 case 49:
  d.title='Once 的边界只应包住初始化';d.description='虚线框内的工作最多执行一次；业务在框外才能处理每个请求。';
  mark(100,58,200,s.fixed?110:210,'#eaf2e5');d.marks.at(-1)!.outline=true;
  n('request',200,27,['到达请求：'+s.pc[0]], '本图按顺序处理两个请求，突出一次性与每次工作的区别。','active',180,40);
  n('init',200,120,['初始化 × '+s.count], '同一个 Once 的函数最多执行一次。','active',170,50);
  n('business',200,240,['业务处理 × '+s.x], '业务次数必须跟随请求数，而非初始化次数。',s.pc[0]>s.x&&s.pc[1]===0?'warn':'active',170,50);
  label(200,80,'Once.Do 范围');
  n('end',200,320,['请求结束'],'请求结束不等于本次业务确实被执行。','active',180,40);
  e('request','init','');
  e('init','business',s.fixed?'Do 返回后每次执行':'仅首次执行');
  e('business','end','返回',false,undefined,224,287);
  if(s.saved)e('request',s.fixed?'business':'end',s.fixed?'后续请求跳过初始化':'后续请求跳过整个框',!s.fixed,s.fixed?'M 290 27 L 365 27 L 365 240 L 289 240':'M 290 27 L 365 27 L 365 320 L 294 320',295,195);
  break;
 case 50:
  d.title='两项字段有没有来自同一版本';d.description='两块颜色对应版本来源；颜色不一致表示读到了混合快照。';
  mark(30,50,340,135,s.fixed?'#eaf2e5':'#f3f5f1');
  label(200,33,s.fixed?'整体锁内更新两个字段':'两个独立 atomic.Store');
  n('version',115,115,['version = '+s.x], '版本字段先写入；原子性只保护该次操作。','active',145,64);
  n('limit',285,115,['limit = '+s.y], '阈值字段随后写入；多次原子操作不是联合事务。',s.y!==s.x*10?'warn':'active',145,64);
  label(200,205,'蓝：旧版本 · 绿：新版本');
  mark(44,152,142,12,s.x===1?'#b2ccd6':'#83b190');mark(214,152,142,12,s.y===10?'#b2ccd6':'#83b190');
  n('snapshot',200,290,['读者快照',s.waiting?'等待整体锁':s.observed], '读取也必须遵守同一把锁，才能取得整体快照。',s.observed.endsWith('/ 10')&&!s.observed.startsWith('1')?'warn':'active',230,64);
  e('version','snapshot',s.owners[0]!==null?'暂不可读':'读取',s.owners[0]!==null,undefined,90,225);
  e('limit','snapshot',s.owners[0]!==null?'暂不可读':'读取',s.owners[0]!==null,undefined,310,225);
  break;
 }
 return d;
}

