import {test,expect,type Page} from '@playwright/test';

test.setTimeout(90000);
async function open(page:Page,id:number){
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId(`lesson${id}-lab`);await expect(lab).toBeVisible();
 const state=async()=>JSON.parse((await lab.getByTestId('live-model').first().getAttribute('data-state'))!);
 return {lab,state};
}
test('51: rendezvous, separate business confirmation, undo and same-goroutine deadlock',async({page})=>{
 const {lab,state}=await open(page,51);
 const run=async(action:string,prediction:string)=>{await lab.getByLabel('第51题下一操作').selectOption(action);await lab.getByLabel('第51题预测',{exact:true}).selectOption(prediction);await lab.getByRole('button',{name:'执行所选操作',exact:true}).click()};
 await run('send','waiting');expect((await state()).sender).toBe('waiting');
 await run('receive','handoff');expect((await state()).receiver).toBe('processing');expect((await state()).sender).toBe('sent');
 await run('waitDone','waiting');expect((await state()).confirmation).toBe('waiting');
 await run('process','processed');expect((await state()).confirmation).toBe('confirmed');
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await state()).receiver).toBe('processing');
 await lab.getByLabel('程序结构').selectOption('same');await run('send','waiting');
 await expect(lab.getByRole('button',{name:'执行所选操作',exact:true})).toBeDisabled();await expect(lab).toContainText('封闭程序死锁');
 await lab.getByRole('button',{name:'重置',exact:true}).click();expect((await state()).sender).toBe('ready');
});
test('52: FIFO retains pending message when receiving frees a full buffer',async({page})=>{
 const {lab,state}=await open(page,52);
 const run=async(action:string,prediction:string)=>{await lab.getByLabel('下一步动作',{exact:true}).selectOption(action);await lab.getByLabel('预测结果',{exact:true}).selectOption(prediction);await lab.getByRole('button',{name:'执行并验证',exact:true}).click()};
 await run('send','buffered');await run('send','buffered');await run('send','blocked');
 expect((await state()).queue).toEqual([1,2]);expect((await state()).pending).toBe(3);
 await run('receive','received');expect((await state()).queue).toEqual([2,3]);expect((await state()).processing).toBe(1);expect((await state()).pending).toBeNull();
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await state()).pending).toBe(3);
 await lab.getByRole('button',{name:'重置实验',exact:true}).click();await run('receive','waiting');await run('send','handoff');
 expect((await state()).queue).toEqual([]);expect((await state()).processing).toBe(1);
 await run('finish','finished');expect((await state()).completed).toEqual([1]);
});
test('53: unsafe early close and coordinated Wait completion are visibly different paths',async({page})=>{
 const {lab,state}=await open(page,53);
 const run=async(action:string,prediction:string)=>{await lab.getByRole('button',{name:action,exact:true}).click();await lab.getByLabel('第53题预测结果').selectOption(prediction);await lab.getByRole('button',{name:'执行并验证',exact:true}).click()};
 await run('A 发送 1','sent');await run('接收者 close（危险）','closed');await run('B 发送 2','panic');
 expect((await state()).panic).toContain('send on closed');expect((await state()).queue).toEqual([1]);
 await lab.getByRole('button',{name:'重置实验',exact:true}).click();
 await run('协调者 Wait → close','blocked');expect((await state()).coordinatorWaiting).toBe(true);
 await run('A 发送 1','sent');await run('A Done / 退出','done');expect((await state()).closed).toBe(false);
 await run('B 发送 2','sent');await run('B Done / 退出','done');expect((await state()).closed).toBe(true);
 await run('接收者接收一次','received');await run('接收者接收一次','received');await run('接收者接收一次','ended');
 expect((await state()).received).toEqual([1,2]);expect((await state()).ended).toBe(true);
});
test('54: close preserves zero data, repeated terminal reads and real waiting wakes',async({page})=>{
 const {lab,state}=await open(page,54);
 const receive=async(prediction:string)=>{await lab.getByLabel('返回值或等待状态').selectOption(prediction);await lab.getByRole('button',{name:'执行一次接收',exact:true}).click()};
 await lab.getByRole('button',{name:'生产者关闭通道',exact:true}).click();
 for(const outcome of ['data0','data5','end','end'])await receive(outcome);
 expect((await state()).results.map((r:{value:number;ok:boolean})=>[r.value,r.ok])).toEqual([[0,true],[5,true],[0,false],[0,false]]);
 expect((await state()).processed).toEqual([0,5]);
 await lab.getByRole('button',{name:'空通道边界',exact:true}).click();await receive('waiting');expect((await state()).waiting).toBe(true);
 await lab.getByRole('button',{name:'生产者发送 0',exact:true}).click();expect((await state()).waiting).toBe(false);expect((await state()).results[0].ok).toBe(true);
 await lab.getByLabel('消费方式').selectOption('zero');await receive('data0');expect((await state()).stopped).toBe(true);expect((await state()).processed).toEqual([]);expect((await state()).queue).toEqual([5]);
});
test('55: drain before nil, guard all-nil exit and capture nil receive before reassignment',async({page})=>{
 const {lab,state}=await open(page,55);await page.evaluate(()=>{Math.random=()=>0});
 const run=async(prediction:string)=>{await lab.getByLabel('第55题预测',{exact:true}).selectOption(prediction);await lab.getByRole('button',{name:'验证并执行一轮',exact:true}).click()};
 await lab.getByLabel('收到 ok=false 后设为 nil',{exact:true}).check();await lab.getByRole('button',{name:'关闭 B',exact:true}).click();
 await run('a+b');expect((await state()).received).toEqual([0]);expect((await state()).a.nil).toBe(false);
 await run('a+b');expect((await state()).a.nil).toBe(true);expect((await state()).b.queue).toEqual([9]);
 await run('b');await run('b');await run('exit');expect((await state()).status).toBe('done');
 await lab.getByRole('button',{name:'重置实验',exact:true}).click();await lab.getByLabel('收到 ok=false 后设为 nil',{exact:true}).check();await lab.getByLabel('全部 nil 时退出循环',{exact:true}).uncheck();await lab.getByRole('button',{name:'关闭 B',exact:true}).click();
 for(const prediction of ['a+b','a+b','b','b','none'])await run(prediction);expect((await state()).status).toBe('waiting');
 await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();const help=page.getByTestId('lesson55-help');
 await help.getByRole('button',{name:'开始执行 <-ch',exact:true}).click();await help.getByRole('button',{name:'ch = 新通道（含 7）',exact:true}).click();await expect(help).toContainText('将永久等待');
 await help.getByRole('button',{name:'重试另一种顺序',exact:true}).click();await help.getByRole('button',{name:'ch = 新通道（含 7）',exact:true}).click();await help.getByRole('button',{name:'开始执行 <-ch',exact:true}).click();await expect(help).toContainText('新通道 []（7 已接收）');
});
test('57: same inputs expose default spinning, waiting wake-up and cancellation',async({page})=>{
 const {lab,state}=await open(page,57);
 const run=async(event:string,prediction:string)=>{await lab.getByLabel('第57题事件').selectOption(event);await lab.getByLabel('第57题预测',{exact:true}).selectOption(prediction);await lab.getByRole('button',{name:'验证并推进事件',exact:true}).click()};
 for(let i=0;i<3;i++)await run('idle','different');
 expect((await state()).busy.spins).toBe(3);expect((await state()).blocking.checks).toBe(1);expect((await state()).blocking.spins).toBe(0);
 await run('message','receive');expect((await state()).busy.received).toEqual([7]);expect((await state()).blocking.received).toEqual([7]);
 await run('idle','different');await run('cancel','stop');expect((await state()).blocking.status).toBe('stopped');
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await state()).blocking.status).toBe('waiting');
});
test('58: parent/child propagation, separate cleanup, side-effect preservation and noncancellable wait',async({page})=>{
 const {lab,state}=await open(page,58);
 const step=async(prediction:string)=>{await lab.getByLabel('第58题预测',{exact:true}).selectOption(prediction);await lab.getByRole('button',{name:'任务：验证并推进一步',exact:true}).click()};
 await lab.getByRole('button',{name:'子任务方：只取消子 context',exact:true}).click();expect((await state()).parentCanceled).toBe(false);expect((await state()).childCanceled).toBe(true);
 await lab.getByRole('button',{name:'重置实验',exact:true}).click();await lab.getByRole('button',{name:'请求方：取消父 context',exact:true}).click();expect((await state()).phase).toBe('running');expect((await state()).resourceHeld).toBe(true);
 await lab.getByRole('button',{name:'请求方：检查完成信号',exact:true}).click();expect((await state()).confirmed).toBe(false);
 await step('noticed');await step('cleaned');expect((await state()).resourceHeld).toBe(false);expect((await state()).phase).toBe('cleaned');
 await step('exited');await lab.getByRole('button',{name:'请求方：检查完成信号',exact:true}).click();expect((await state()).confirmed).toBe(true);expect((await state()).work).toBe(1);
 await lab.locator('summary').filter({hasText:'改变实验条件'}).click();await lab.getByLabel('外部阻塞点支持取消',{exact:true}).uncheck();await lab.getByRole('button',{name:'从外部调用阻塞开始',exact:true}).click();await lab.getByRole('button',{name:'请求方：取消父 context',exact:true}).click();await step('blocked');expect((await state()).phase).toBe('blocked');
 await lab.getByRole('button',{name:'外部调用自行返回',exact:true}).click();await step('noticed');expect((await state()).phase).toBe('noticed');
});
test('59: pre-check cannot release blocked send; cancellable boundary cleans up before done',async({page})=>{
 const {lab,state}=await open(page,59);
 const run=async(prediction:string)=>{await lab.getByLabel('第59题预测',{exact:true}).selectOption(prediction);await lab.getByRole('button',{name:'验证并推进上游',exact:true}).click()};
 for(const strategy of ['plain','before']){
  await lab.getByLabel('第59题发送写法').selectOption(strategy);await run('block');await lab.getByRole('button',{name:'下游发出取消',exact:true}).click();await run('block');expect((await state()).phase).toBe('blocked');expect((await state()).cleaned).toBe(false);
 }
 await lab.getByLabel('第59题发送写法').selectOption('select');await run('block');await lab.getByRole('button',{name:'下游发出取消',exact:true}).click();await run('cancel');expect((await state()).phase).toBe('cleanup');
 await lab.getByRole('button',{name:'下游等待 done',exact:true}).click();expect((await state()).confirmed).toBe(false);
 await run('clean');expect((await state()).phase).toBe('done');await lab.getByRole('button',{name:'下游等待 done',exact:true}).click();expect((await state()).confirmed).toBe(true);
});
test('60: bounded execution, pending send, out-of-order results and complete shutdown',async({page})=>{
 const {lab,state}=await open(page,60);await lab.getByLabel('jobs 容量（更改会重置）').selectOption('1');
 const run=async(action:string,active:number)=>{await lab.getByLabel('第60题操作',{exact:true}).selectOption(action);await lab.getByLabel('第60题预测',{exact:true}).selectOption(String(active));await lab.getByRole('button',{name:'验证并执行操作',exact:true}).click();expect((await state()).workers.filter((w:{job:number|null})=>w.job!==null).length).toBe(active)};
 await run('send',0);await run('take:0',1);await run('send',1);await run('take:1',2);await run('send',2);await run('send',2);expect((await state()).blocked).toBe(true);
 await run('finish:1',1);await run('take:1',2);expect((await state()).queue).toEqual([4]);expect((await state()).blocked).toBe(false);
 await run('closeJobs',2);expect((await state()).jobsClosed).toBe(false);
 await run('finish:0',1);expect((await state()).results).toEqual([2,1]);await run('take:0',2);await run('send',2);await run('send',2);await run('finish:1',1);await run('take:1',2);await run('closeJobs',2);expect((await state()).jobsClosed).toBe(true);
 await run('finish:0',1);await run('take:0',2);await run('finish:1',1);await run('take:1',1);await run('finish:0',0);await run('take:0',0);await run('wait',0);await run('closeResults',0);
 expect((await state()).results).toEqual([2,1,3,4,5,6]);expect((await state()).peak).toBe(2);expect((await state()).resultsClosed).toBe(true);
 await lab.screenshot({path:'.runtime/channel-lessons-60-desktop.png'});
});
