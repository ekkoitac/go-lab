// A bounded, deterministic teaching scheduler. It models communication events,
// not wall-clock performance or the full Go runtime/memory model.
export type Status = 'ready' | 'send' | 'receive' | 'working' | 'cleanup' | 'done' | 'panic';
export type Actor = {id:string; name:string; status:Status; line:string; channel?:string; value?:number; nilWait?:boolean; cancellable?:boolean; job?:number};
export type Channel = {id:string; name:string; capacity:number; queue:number[]; closed:boolean; nil:boolean};
export type Config = {capacity:number; separate:boolean; cancellable:boolean; withDefault:boolean; guard:boolean; workers:number};
export type Flow = {from:string; to:string; value:string; blocked?:boolean};
export type LabState = {
  lesson:number; config:Config; actors:Actor[]; channels:Channel[];
  next:number; receipts:{value:number;ok:boolean}[]; completed:number[];
  cancelled:boolean; rounds:number; defaults:number; work:number; peak:number;
  label:string; detail:string; code:string; flows:Flow[];
};
export type Action = {type:'send'|'receive'|'close'|'finish'|'nil'|'select'|'poll'|'cancel'|'work'|'cleanup'|'leave'|'submit'|'take'|'supply'; actor?:string; channel?:string; value?:number; branch?:string};
const actor=(id:string,name:string):Actor=>({id,name,status:'ready',line:'等待你安排下一步'});
const channel=(id:string,name:string,capacity:number):Channel=>({id,name,capacity,queue:[],closed:false,nil:false});
export function initialState(lesson:number, overrides:Partial<Config>={}):LabState {
  const config:Config={capacity:lesson===52?2:lesson===53||lesson===54?2:lesson===60?2:0,separate:true,cancellable:false,withDefault:true,guard:false,workers:2,...overrides};
  let actors=[actor('p','发送者'),actor('r','接收者')];
  let channels=[channel('ch','ch',config.capacity)];
  if(lesson===51&&!config.separate)actors=[actor('p','同一个 goroutine')];
  if(lesson===53)actors=[actor('p','生产者 A'),actor('b','生产者 B'),actor('r','接收者'),actor('c','协调者')];
  if(lesson===54)channels[0].queue=[0,7];
  if(lesson===55||lesson===56){actors=[actor('r','select 执行者')];channels=[channel('a',lesson===55?'输入 A':'结果通道',1),channel('b',lesson===55?'输入 B':'ctx.Done()',lesson===55?1:0)];channels[0].closed=lesson===55;if(lesson===56){channels[0].queue=[7];channels[1].closed=true;}}
  if(lesson===57){actors=[actor('r','循环任务'),actor('p','消息生产者')];channels=[channel('ch','消息通道',1)];}
  if(lesson===58){actors=[actor('p','搜索任务'),actor('b','派生任务')];channels=[];}
  if(lesson===59){actors=[actor('p','上游生产者'),actor('r','下游消费者')];}
  if(lesson===60){actors=[actor('p','任务提交者'),...Array.from({length:config.workers},(_,i)=>actor('w'+i,'Worker '+(i+1)))];channels[0].name='jobs';}
  return {lesson,config,actors,channels,next:1,receipts:[],completed:[],cancelled:false,rounds:0,defaults:0,work:0,peak:0,label:'实验起点',detail:'先预测，再选择一个角色执行操作。每次操作都会留下可回退的状态记录。',code:'// 由你安排执行顺序',flows:[]};
}
function note(s:LabState,label:string,detail:string,code:string){s.label=label;s.detail=detail;s.code=code;}
function ready(a:Actor){return a.status==='ready';}
function panic(s:LabState,a:Actor,detail:string){a.status='panic';a.line='panic';note(s,'panic',detail,'panic');}
function deliver(s:LabState,a:Actor,value:number,ok:boolean){
  a.status='ready';a.line=`value=${value}, ok=${ok}`;a.nilWait=false;
  s.receipts.push({value,ok});
  if(s.lesson===51){a.status='working';a.line=`已收到 ${value}；业务尚未完成`;}
  if(s.lesson===60){if(ok){a.status='working';a.job=value;a.line=`处理任务 ${value}`;}else{a.status='done';a.line='range 结束；worker 退出';}}
}
function send(s:LabState,a:Actor,c:Channel,value:number){
  if(!ready(a))return;
  if(c.closed&&!c.nil){panic(s,a,'向已关闭通道发送会 panic；这条值不会进入队列。');return;}
  const receiver=!c.nil?s.actors.find(r=>r.status==='receive'&&r.channel===c.id&&!r.nilWait):undefined;
  if(receiver){deliver(s,receiver,value,true);a.line=`发送 ${value} 完成`;s.flows.push({from:a.id,to:receiver.id,value:String(value)});note(s,'发送与接收会合','已经阻塞的接收者获得数据，两端通信完成；接收后的业务仍需单独执行。',`${c.id} <- ${value}`);}
  else if(!c.nil&&c.queue.length<c.capacity){c.queue.push(value);a.line=`发送 ${value} 完成`;s.flows.push({from:a.id,to:c.id,value:String(value)});note(s,'数据进入缓冲','发送完成只表示数据进入队列，不表示消费者已经处理。',`${c.id} <- ${value}`);}
  else{a.status='send';a.channel=c.id;a.value=value;a.nilWait=c.nil;a.cancellable=s.lesson===59&&s.config.cancellable;a.line=`阻塞在 ${c.id} <- ${value}`;s.flows.push({from:a.id,to:c.id,value:String(value),blocked:true});note(s,'发送阻塞',c.nil?'本次操作已求值到 nil 通道，会永久等待；之后给变量重新赋值也不会改变这次等待。':c.capacity===0?'没有接收者到场；无缓冲通道没有存储槽。':'缓冲已满；发送者保留待发值，等待消费者腾出位置。',`${c.id} <- ${value}`);return;}
  s.next=Math.max(s.next,value+1);
}
function receive(s:LabState,a:Actor,c:Channel){
  if(!ready(a))return;
  const pending=!c.nil?s.actors.find(p=>p.status==='send'&&p.channel===c.id&&!p.nilWait):undefined;
  if(!c.nil&&c.queue.length){const value=c.queue.shift()!;deliver(s,a,value,true);s.flows.push({from:c.id,to:a.id,value:String(value)});note(s,'取出队首数据',`收到 ${value}，ok=true。关闭也不会丢弃已有缓冲数据。`,`value, ok := <-${c.id}`);
    if(pending){const v=pending.value!;c.queue.push(v);pending.status='ready';pending.line=`发送 ${v} 完成`;s.next=Math.max(s.next,v+1);s.flows.push({from:pending.id,to:c.id,value:String(v)});s.detail+=' 腾出的空位交给本模型最早阻塞的发送者，待发值进入缓冲。';}
  }else if(pending){const v=pending.value!;deliver(s,a,v,true);pending.status='ready';pending.line=`发送 ${v} 完成`;s.next=Math.max(s.next,v+1);s.flows.push({from:pending.id,to:a.id,value:String(v)});note(s,'无缓冲会合','接收者与已经阻塞的发送者会合；待发值直接交付，双方可以继续。',`value, ok := <-${c.id}`);}
  else if(c.closed&&!c.nil){deliver(s,a,0,false);note(s,'关闭且排空','立即返回零值 0、ok=false；再次接收仍会立即返回。',`value, ok := <-${c.id}`);s.flows.push({from:c.id,to:a.id,value:'0 / false'});}
  else{a.status='receive';a.channel=c.id;a.nilWait=c.nil;a.line=`阻塞在 <-${c.id}`;note(s,'接收阻塞',c.nil?'nil 没有可通信对象；直接接收永久等待。':'没有数据，也没有发送者；接收者挂起等待。',`<- ${c.id}`);s.flows.push({from:c.id,to:a.id,value:'等待',blocked:true});}
}
function close(s:LabState,a:Actor,c:Channel){
  if(!ready(a))return;
  if(c.nil||c.closed){panic(s,a,c.nil?'close(nil) 会 panic。':'重复 close 会 panic；关闭责任必须唯一。');return;}
  c.closed=true;note(s,'关闭通道','不再允许发送；已有缓冲仍然保留。关闭不是任务全部完成的证明。',`close(${c.id})`);
  if(s.lesson===56&&c.id==='b'){s.cancelled=true;note(s,'发出取消通知','调用 cancel，由 context 关闭只读 Done 通道；接收方不能向 Done 发送或自行关闭它。','cancel()');}
  for(const other of s.actors){if(other.channel!==c.id||other.nilWait)continue;
    if(other.status==='send'){other.status='panic';other.line='panic: send on closed channel';s.detail+=' 阻塞发送者被唤醒并 panic，待发值不会入队。';}
    else if(other.status==='receive'){deliver(s,other,0,false);s.flows.push({from:c.id,to:other.id,value:'0 / false'});}
  }
}
export function isReady(c:Channel){return !c.nil&&(c.closed||c.queue.length>0);}
export function transition(previous:LabState,action:Action):LabState {
  if(previous.actors.some(a=>a.status==='panic'))return previous;
  const s:LabState=structuredClone(previous);s.flows=[];
  const a=action.actor==='env'?actor('env','外部协调者'):s.actors.find(x=>x.id===(action.actor??'p'));
  const c=s.channels.find(x=>x.id===(action.channel??'ch'));
  switch(action.type){
    case 'send': if(a&&c)send(s,a,c,action.value??s.next);break;
    case 'receive':if(a&&c)receive(s,a,c);break;
    case 'close':if(a&&c){if(a.id==='c'&&!s.actors.filter(x=>['p','b'].includes(x.id)).every(x=>x.status==='done')){note(s,'协调者仍在等待','必须确认 A 和 B 都不再发送，才能关闭。','wg.Wait()');}else{close(s,a,c);if(s.lesson===60&&a.id==='p'&&a.status==='ready'&&c.closed){a.status='done';a.line='close(jobs)；提交者结束';}}}break;
    case 'finish':if(a){if(ready(a)){a.status='done';a.line='Done：不再发送';note(s,'生产者结束','只有这个生产者结束，其他生产者仍可能发送。','defer wg.Done()');}else if(a.status==='working'){a.status='ready';a.line='业务处理完成';note(s,'业务完成确认','通信完成和业务完成是两个独立事件。','close(done)');}}break;
    case 'nil':if(c){c.nil=true;note(s,'禁用一个分支','变量被设为 nil；后续 select 不再考虑该分支。已进入的通信不会重新读取变量。',`${c.id} = nil`);}break;
    case 'supply':if(c&&!c.nil&&!c.closed&&c.queue.length<c.capacity){c.queue.push(action.value??7);note(s,'外部输入到达','环境变化使该接收分支就绪；由你探索后续合法调度。',`${c.id} <- ${action.value??7}`);}break;
    case 'select':{
      const r=s.actors[0];if(r.status!=='ready'&&!(r.status==='receive'&&r.channel==='select'))break;
      if(s.lesson===55&&s.config.guard&&s.channels.every(ch=>ch.nil)){r.status='done';r.line='所有输入结束';note(s,'聚合循环退出','先检查全部输入已禁用，避免进入永远无法就绪的 select。','if a == nil && b == nil { return }');break;}
      const options=s.channels.filter(isReady);const chosen=options.find(ch=>ch.id===action.branch);
      if(chosen){r.status='ready';
        if(s.lesson===56&&chosen.id==='b'){r.status='done';r.line='收到取消通知，返回 ctx.Err()';s.flows.push({from:'b',to:r.id,value:'取消'});note(s,'选择取消分支','Done 的关闭使接收就绪；本分支只读取通知，不把它当作 int 数据。','case <-ctx.Done(): return ctx.Err()');}
        else{receive(s,r,chosen);s.label='选择分支 '+chosen.id;if(s.lesson===56){r.status='done';r.line='返回收到的结果';}}
        s.rounds++;s.detail+=(options.length>1?' 当前有多个就绪分支，任一个都合法；书写顺序不赋予优先级。':' 当前只有该分支就绪。');}
      else if(options.length===0){r.status='receive';r.channel='select';r.line='select 阻塞';note(s,'没有就绪分支','没有 default；select 挂起，直到某个通信就绪。全部为 nil 时将永久等待。','select { /* 等待可执行分支 */ }');}
      break;
    }
    case 'poll':{
      const r=s.actors.find(x=>x.id==='r')!;if(r.status!=='ready')break;s.rounds++;
      if(s.cancelled){r.status='done';r.line='取消分支退出';note(s,'循环退出','ctx.Done 已关闭，退出等待循环。','case <-ctx.Done(): return');}
      else if(isReady(s.channels[0]))receive(s,r,s.channels[0]);
      else if(s.config.withDefault){s.defaults++;r.line=`default 空转 ${s.defaults} 次`;note(s,'default 立即返回','本轮没有处理消息，却又可以进入下一轮。计数是模拟轮次，不是真实 CPU 百分比。','default: // for 立即进入下一轮');}
      else receive(s,r,s.channels[0]);break;
    }
    case 'cancel':{
      s.cancelled=true;note(s,'取消信号已发出','Done 关闭只是通知；仍要观察任务响应，并等待清理与退出确认。','cancel()');
      for(const p of s.actors){
        if(s.lesson===59&&p.status==='send'&&p.cancellable){p.status='cleanup';p.line='取消分支就绪；等待清理';s.flows.push({from:'signal',to:p.id,value:'取消'});}
        if(s.lesson===57&&p.id==='r'&&p.status==='receive'){p.status='done';p.line='取消分支唤醒并退出';}
      }break;
    }
    case 'work':if(a&&(a.status==='ready'||a.status==='working')){
      if(s.cancelled&&s.config.cancellable){a.status='cleanup';a.line='观察到 ctx.Done；准备清理';note(s,'任务观察取消','本任务主动检查取消，尚未完成资源释放，也尚未发出退出回执。','case <-ctx.Done(): /* cleanup */');s.flows.push({from:'signal',to:a.id,value:'取消'});}
      else {a.status='working';s.work++;a.line=`已处理工作单元 ${s.work}`;note(s,'继续处理工作',s.cancelled?'任务未监听取消，仍继续处理；context 不会强制终止 goroutine。':'执行一个可中断边界之间的工作单元。','processNext()');}break;
    }
    case 'cleanup':if(a&&a.status==='cleanup'){a.status='done';a.line='资源释放；done 已关闭';note(s,'确认任务退出','此时才收到完成回执；cancel 与完成确认之间存在真实的收尾过程。','release(); close(done)');}break;
    case 'leave':if(a&&ready(a)){a.status='done';a.line='提前退出，不再读取';note(s,'下游提前退出','退出本身不会关闭通道，也不会通知上游。继续发送可暴露泄漏。','return // 不再接收');}break;
    case 'submit':if(a&&c)send(s,a,c,s.next);break;
    case 'take':if(a&&c)receive(s,a,c);break;
  }
  // A cancellable pipeline can choose cancellation before attempting an unready send.
  if(action.type==='send'&&s.lesson===59&&s.cancelled&&s.config.cancellable&&a?.status==='send'){
    a.status='cleanup';a.line='取消分支已就绪，等待清理';s.flows=[{from:'signal',to:a.id,value:'取消'}];note(s,'发送等待由取消解除','发送尚未就绪，选择已关闭的 Done 分支并进入收尾。','select { case out <- v: case <-ctx.Done(): return }');
  }
  s.peak=Math.max(s.peak,s.actors.filter(x=>x.status==='working').length);
  if(a?.id==='env'&&a.status==='panic')s.actors.push(a);
  return s;
}
export function completeJob(previous:LabState,id:string):LabState{
  const s=structuredClone(previous),a=s.actors.find(x=>x.id===id)!;s.flows=[];
  if(a.status!=='working'||a.job===undefined)return s;
  s.completed.push(a.job);note(s,'任务完成',`Worker 完成任务 ${a.job}；它可以再取下一项。完成顺序由你的调度决定。`,`process(job${a.job}); // 下一轮 range`);a.status='ready';a.line=`已完成任务 ${a.job}`;delete a.job;return s;
}
