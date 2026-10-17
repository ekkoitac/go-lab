import {initial,transition,type Action,type State} from './model';
export type Guide={title:string;focus:string;conditions:[string,string];parameter?:string;task:string;boundary:string;routes:[Action[],Action[]];everyday:[string,string,string][]};
export const guides:Record<number,Guide>={
41:{title:'一张回执，两个生命周期',focus:'区分启动、写入、完成通知和程序结束。',conditions:['启动后直接返回','等待 done 后返回'],task:'先让主任务连续执行两步；重置后让后台先写入，再比较。',boundary:'后台只有写入和通知两步；真实任务还需处理错误、取消与清理。',routes:[['a','a'],['a','a','b','b','a']],everyday:[['派出快递','go save()','任务可以开始，不代表送达'],['包裹送达','写入结束','主任务还需获得完成证据'],['签收回执','close(done)','建立明确的完成关系']]},
42:{title:'由你分配每一个时间片',focus:'在相同工作量下区分交错与同时计算。',conditions:['1 个执行单元','2 个执行单元'],parameter:'每个任务的工作单元',task:'交替执行 A、B，再保留工作量切换为两个执行单元，尝试同时执行。',boundary:'每单位工作成本相同，忽略调度和通信开销。时间片不是毫秒，不能当作性能基准；有两个单元也不保证每片并行。',routes:[['a','b','a','b'],['both','both']],everyday:[['一位厨师照看两锅','单执行单元交错','可以组织并发'],['两位厨师同时做菜','双执行单元并行','需要同时可执行的工作'],['切换与沟通成本','调度和同步开销','示意时间不能预测真实耗时']]},
43:{title:'亲手制造一次丢失更新',focus:'跟踪本地快照怎样覆盖共享计数。',conditions:['无同步读改写','锁住整个读改写'],parameter:'每次增加的数值',task:'依次让 A 读、B 读，再完成各自加与写；修复后检查 B 能否仍提前读。',boundary:'这是指定顺序的读改写模型，不是实际 data race 检测；一次得到正确结果不证明安全。',routes:[['a','b','a','b','a','b'],['a','a','a','b','b','b']],everyday:[['两人抄下同一库存','两个本地快照','后来的写入不会合并贡献'],['整段办理只进一人','锁住读改写','只锁最后写入仍不够'],['最后库存偶然正确','某次调度成功','不能替代同步保证']]},
44:{title:'监控能看见哪一半转账',focus:'区分内部中间状态与读者可见快照。',conditions:['扣款与入账分别加锁','同一锁保护整个转账'],parameter:'转账金额（档位 × 10）',task:'扣款后立刻让监控读取，再完成入账。保持相同金额比较两种锁范围。',boundary:'所有读者遵循同一把锁；内部中间值允许存在，但不能被受保护的读者看见。进程内锁不替代数据库事务。',routes:[['a','read','a','read'],['a','read','a','read']],everyday:[['搬出一个盒子的硬币','账户 A 扣款','总数暂时减少'],['放入另一个盒子','账户 B 入账','两步合起来才保持总额'],['关门完成后盘点','同一临界区读写','不能只要求每一步各自关门']]},
45:{title:'追踪锁的身份，而非锁的名字',focus:'发现两把锁保护同一数据时为何不能互斥。',conditions:['复制零值锁，数据仍共享','共享整个含锁对象指针'],task:'让 A 取得锁，再让 B TryLock，检查数据 X 的访问权；释放 A 后再试 B。',boundary:'仅演示首次使用前复制零值锁形成的“两锁一数据”。已使用 Mutex 不得复制；不模拟非法复制后的行为。TryLock 仅供观察身份。',routes:[['a','b','read'],['a','b','read','releaseA','b']],everyday:[['两本独立钥匙登记簿','锁 A 与锁 B','一边登记不阻止另一边'],['同一个仓库','共享数据 X','共享数据不自动共享锁'],['大家用同一本登记簿','共享含锁对象','数据和锁的身份要一起共享']]},
46:{title:'让等待关系形成一个环',focus:'区分暂时等待与无法推进的循环等待。',conditions:['任务 2 反向拿锁','两任务统一 A → B'],task:'先执行任务 1 一步，再执行任务 2 一步，观察它们下一步要什么；修复后尝试同样顺序。',boundary:'只模拟两任务、两把非重入 Mutex。取消不能自动解锁，一致锁序也不能解决所有 I/O 或通道等待。',routes:[['a','b','a','b'],['a','b','a','a','b','b','b']],everyday:[['各持一把钥匙','各持一把锁','持有不等于能继续'],['互等对方钥匙','循环等待','双方都到不了释放步骤'],['所有人先取 A','固定获取顺序','等待者不会先占住 B']]},
47:{title:'解开读锁升级与复查的结',focus:'看见自我阻塞，以及解锁空隙中的状态变化。',conditions:['持 RLock 再 Lock','释放读锁后取写锁并复查'],parameter:'自己拟初始化的值',task:'原始条件请求写锁；修复后在 RUnlock 与 Lock 之间插入其他写者，观察复查结果。',boundary:'只模拟一个查询和一个间隙写者。RWMutex 不能升级；不据此推断性能优于 Mutex。',routes:[['a','a'],['a','a','inject','a','a','a']],everyday:[['还站在阅览室里','仍持有读锁','自己也是写者要等待的读者'],['先离开，再申请独占','RUnlock 再 Lock','中间不是原子切换'],['回来后重新看公告','写锁下复查','不能把旧观察当现状']]},
48:{title:'登记表决定 Wait 等什么',focus:'把任务是否启动、是否登记、是否完成分开看。',conditions:['后台稍后才 Add','主任务先 Add 再启动'],parameter:'本批任务数',task:'启动任务后立即 Wait，再让后台登记和 Done；修复后比较同样操作。',boundary:'WaitGroup 只表达数量，不传递业务错误。此模型分开安排 Add 与 Wait，避免误把它当合法并发复用示例。',routes:[['a','read','b','b','b'],['a','read','b','b']],everyday:[['车已发出','goroutine 已启动','不代表名单已有记录'],['乘客登记数量','Add','必须先让等待者看见任务'],['所有登记已销号','Done 到零','不代表业务一定成功']]},
49:{title:'开门一次，每次都要结账',focus:'改变 Once 包围范围，比较初始化与业务次数。',conditions:['初始化和业务都在 Once 内','Once 只包含初始化'],parameter:'请求数',task:'至少处理两个请求，每个请求推进到结束，比较初始化次数和业务次数。',boundary:'请求按顺序到达以突出作用域；真实并发 Do 会等待初始化结束。panic 也消耗 Once，不自动重试。',routes:[['a','b','a'],['a','b','b','a','b']],everyday:[['开门','一次初始化','最多执行一次'],['结账','每次业务处理','每位顾客都要执行'],['开门失败再尝试','失败重试协议','Once 不提供自动重试']]},
50:{title:'单字段原子，不等于整体快照',focus:'在两次写入之间插入读取，观察跨版本拼接。',conditions:['两个字段独立原子读写','同一锁保护整体读写'],parameter:'新版本（档位 + 1）',task:'先更新版本，立刻读取，再更新阈值；切换整体锁，比较读者是否还能读到中间态。',boundary:'读者按一个教学步骤读取两字段，已足以展示反例；真实两个 Load 也可能被写入穿插。原子发布的对象必须保持不可变。',routes:[['a','read','a','read'],['a','read','a','read']],everyday:[['车次与发车时间','版本和阈值','两项必须属于同一更新'],['两张票分别盖章','单字段原子操作','各自完整仍可能不配套'],['整套一起发出','整体快照','读写都遵守同一同步协议']]}
};
export function routeFor(id:number,fixed:boolean,size:number):Action[]{
 if(id===42)return fixed?Array(size).fill('both'):Array.from({length:size},()=>['a','b'] as Action[]).flat();
 if(id===48)return ['a','read',...(!fixed?['b' as Action]:[]),...Array(size).fill('b')];
 if(id===49)return Array.from({length:size},(_,i)=>fixed?(i===0?['a','b','b']:['a','b']):(i===0?['a','b']:['a'])).flat() as Action[];
 return guides[id].routes[fixed?1:0];
}
export function replay(id:number,fixed:boolean,size:number,route:Action[]):State[]{
 return route.reduce<State[]>((frames,a)=>[...frames,transition(frames.at(-1)!,a)],[initial(id,fixed,size)]);
}
export type Challenge={prompt:string;options:string[];answer:string;trace:State[];why:string};
export function challenge(id:number,variant:number):Challenge{
 const size=variant%2===0?3:1,fixed=variant%2===1;
 let route:Action[]=[],prompt='',answer='',wrong='',why='';
 switch(id){
 case 41:route=fixed?['a','a','b','b','a']:['a','a'];prompt='导出报告时，'+(fixed?'主任务等待 done，后台写入并通知，然后主任务返回。':'启动导出后，后台尚未写入，主任务就返回。')+'报告得到完成保证了吗？';answer=fixed?'有完成回执保证':'没有完成保证';wrong=fixed?'没有完成保证':'有完成回执保证';why='启动与完成是不同事件，必须等待真正的完成通知。';break;
 case 42:route=routeFor(id,fixed,size);prompt='两个独立计算任务各需 '+size+' 个工作单元，'+(fixed?'每片同时推进 A、B':'每片轮流推进 A、B')+'。忽略开销，需要几个教学时间片？';answer=String(fixed?size:size*2);wrong=String(fixed?size*2:size);why='工作量相同；只有同时执行才能在一个时间片完成两个工作单元。';break;
 case 43:route=routeFor(id,fixed,size);prompt='计数从 0 开始，两任务各加 '+size+'，'+(fixed?'锁住整个读改写，A 完成后 B 执行。':'两任务先各读 0，再分别加和写回。')+'最终共享值是多少？';answer=String(fixed?size*2:size);wrong=String(fixed?size:size*2);why='写回的是本地快照；互斥覆盖整个读改写才能保留两份贡献。';break;
 case 44:route=['a','read'];prompt='A=60、B=40，转账 '+size*10+'。'+(fixed?'整体临界区内':'两个独立临界区中')+'扣款刚结束，监控按协议读取。会怎样？';answer=fixed?'等待整体更新完成':String(100-size*10);wrong=fixed?String(100-size*10):'等待整体更新完成';why='内部中间值与可被读者获取的快照不同；两边都要遵守整体锁。';break;
 case 45:route=['a','b','read'];prompt=(fixed?'两个指针指向同一个含锁对象。':'使用前复制零值锁，两个对象仍引用数据 X。')+'A 持锁时，B TryLock 的结果是什么？';answer=fixed?'false':'true';wrong=fixed?'true':'false';why='锁只协调同一实例的访问，不根据数据地址自动互斥。';break;
 case 46:route=['a','b','a','b'];prompt='任务 1 先拿 A，任务 2 '+(fixed?'也先请求 A':'先拿 B，然后两者分别请求另一把锁')+'。是否形成等待环？';answer=fixed?'未形成等待环':'形成等待环';wrong=fixed?'形成等待环':'未形成等待环';why='统一锁序时任务 2 等待 A 但未持有 B，任务 1 仍能推进并释放。';break;
 case 47:route=fixed?['a','a','inject','a','a']:['a','a'];prompt=fixed?'查询未命中后先 RUnlock；其他写者插入 11，再取写锁复查。最终使用哪个值？':'查询持有 RLock，未释放就调用 Lock。查询能继续吗？';answer=fixed?'11':'不能，等待自己的读锁';wrong=fixed?'1':'能，自动升级为写锁';why='读锁不能升级；释放与写锁获取之间允许状态变化，所以需要复查。';break;
 case 48:route=['a','read'];prompt='准备 '+size+' 个任务，'+(fixed?'主任务先 Add，再启动任务，尚未 Done 就 Wait。':'仅启动，后台还未 Add 就 Wait。')+'Wait 会怎样？';answer=fixed?'等待中':'立即返回';wrong=fixed?'立即返回':'等待中';why='Wait 等待当前登记数量归零，不预测未来 Add。';break;
 case 49:{const n=fixed?2:3;route=routeFor(id,fixed,n);prompt=n+' 次请求使用同一 Once，'+(fixed?'业务放在 Do 返回之后。':'业务和初始化都放在 Do 函数内。')+'业务执行几次？';answer=String(fixed?n:1);wrong=String(fixed?1:n);why='Once 限制整个函数体只执行一次；每次业务必须放在外面。';return {prompt,options:variant%2?[wrong,answer]:[answer,wrong],answer,trace:replay(id,fixed,n,route),why};}
 case 50:route=['a','read'];prompt='配置从 1/10 改为 '+(size+1)+'/'+((size+1)*10)+'，'+(fixed?'用同一锁整体读写。':'各字段独立 atomic。')+'版本已写、阈值未写时读取，会怎样？';answer=fixed?'等整体更新后读取':(size+1)+' / 10';wrong=fixed?(size+1)+' / 10':'等整体更新后读取';why='单字段原子操作不能把两个写入变成一个事务。';break;
 }
 return {prompt,options:variant%2?[wrong,answer]:[answer,wrong],answer,trace:replay(id,fixed,size,route),why};
}

