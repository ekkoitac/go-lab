import {test,expect,type Page,type Locator} from '@playwright/test';
async function open(page:Page,id:number){
 await page.setViewportSize({width:390,height:1000});
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.getByTestId('concurrency-lab-'+id);await expect(lab).toBeVisible();return lab;
}
const select=async(lab:Locator,name:string,value:string)=>lab.getByRole('combobox',{name,exact:true}).selectOption(value);
const state=async(lab:Locator)=>{const value=JSON.parse((await lab.getByTestId('live-model').first().getAttribute('data-state'))!);return value.state??value;};
async function advance(lab:Locator,count:number){for(let i=0;i<count;i++)await lab.locator('[data-concurrency-action=step]').first().click();}
async function fit(page:Page,lab:Locator){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await lab.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);}

test('122 shared deadline degrades optional work; queue pressure invalidates core result',async({page})=>{
 const lab=await open(page,122);await lab.getByRole('radio',{name:'能，推荐可以缺省'}).check();await lab.getByRole('button',{name:'揭晓结局'}).click();
 let s=await state(lab);expect(s.shared.response).toBe('ok');expect(s.shared.responseAt).toBeLessThanOrEqual(300);expect(s.renewed.response).toBe('deadline');
 await lab.getByRole('slider',{name:'入口排队时间'}).fill('220');await select(lab,'并发额度','1');await lab.getByRole('radio',{name:'不能，核心依赖也来不及'}).check();await lab.getByRole('button',{name:'揭晓结局'}).click();
 s=await state(lab);expect(s.shared.response).toBe('failed');await expect(lab.locator('.fan122-feedback')).toContainText('试着减少入口等待或增加额度');await fit(page,lab);
});
test('123 optional failure preserves core; required failure signals before cleanup completes',async({page})=>{
 const lab=await open(page,123);await select(lab,'预测','degraded');await advance(lab,4);expect((await state(lab)).outcome).toBe('degraded');
 await select(lab,'注入事件','account');await select(lab,'预测','failed');await advance(lab,2);
 let s=await state(lab);expect(s.cancellation).toBe(true);expect(s.settled).toBe(1);expect(s.tasks.filter((t:{status:string})=>t.status==='cancel-pending')).toHaveLength(2);
 await advance(lab,2);s=await state(lab);expect(s.settled).toBe(3);expect(s.outcome).toBe('failed');await fit(page,lab);
});
test('124 moving resource close after confirmed cleanup repairs shutdown',async({page})=>{
 const lab=await open(page,124);await select(lab,'预测退出结果','unsafe');await advance(lab,5);expect((await state(lab)).frame.worker).toBe('failed');
 await lab.locator('[data-concurrency-action=reset]').click();await lab.getByRole('button',{name:'关闭数据库下移'}).click();await lab.getByRole('button',{name:'关闭数据库下移'}).click();await select(lab,'预测退出结果','safe');await advance(lab,5);
 const s=await state(lab);expect(s.frame.worker).toBe('done');expect(s.frame.confirmed).toBe(true);expect(s.frame.databaseOpen).toBe(false);await expect(lab.locator('.cl124-result')).toContainText('收尾成功且安全关闭');await fit(page,lab);
});
test('125 round robin grants B a slot but equal counts do not imply equal cost',async({page})=>{
 const lab=await open(page,125);for(const who of ['A','B','A']){await select(lab,'轮转下一位',who);await advance(lab,1);}
 let s=await state(lab);expect(s.fifo.selected.map((j:{id:string})=>j.id)).toEqual(['A1','A2','A3']);expect(s.roundRobin.selected.map((j:{id:string})=>j.id)).toEqual(['A1','B1','A2']);
 await lab.getByRole('button',{name:'反例：相同次数、不同成本'}).click();for(const who of ['A','B','A','B']){await select(lab,'轮转下一位',who);await advance(lab,1);}
 s=await state(lab);const jobs=s.roundRobin.selected;expect(jobs.filter((j:{tenant:string})=>j.tenant==='A')).toHaveLength(2);expect(jobs.filter((j:{tenant:string})=>j.tenant==='B')).toHaveLength(2);expect(jobs[0].cost).toBe(6);expect(jobs[1].cost).toBe(1);await fit(page,lab);
});
test('126 waiting can be cancelled or receive recovered capacity without false confirmation',async({page})=>{
 const lab=await open(page,126);await select(lab,'接收策略','wait');await select(lab,'提交前预测 B 的结果','waiting');await advance(lab,1);expect((await state(lab)).result).toBe('waiting');
 await lab.getByRole('button',{name:'取消 B 请求'}).click();expect((await state(lab)).result).toBe('cancelled');expect((await state(lab)).queue).toEqual(['A']);
 await lab.locator('[data-concurrency-action=back]').click();await lab.getByRole('button',{name:'消费者完成一个任务'}).click();const s=await state(lab);expect(s.result).toBe('accepted');expect(s.queue).toEqual(['B']);expect(s.completed).toEqual(['A']);await fit(page,lab);
});
test('127 copying nested objects protects the old reader while publishing a new version',async({page})=>{
 const lab=await open(page,127);const predict='先预测：旧读者最终读到哪个后端？';await select(lab,predict,'green');await advance(lab,5);expect((await state(lab)).old).toMatchObject({versionSeen:1,backendSeen:'green'});
 await lab.getByRole('button',{name:'修复：复制嵌套对象，重新预测并验证'}).click();await select(lab,predict,'blue');await advance(lab,5);const s=await state(lab);expect(s.old).toMatchObject({versionSeen:1,backendSeen:'blue'});expect(s.fresh).toMatchObject({versionSeen:2,backendSeen:'green'});await fit(page,lab);
});
test('128 moving I/O needs version validation; sharding cannot split a single hot key',async({page})=>{
 const lab=await open(page,128);await select(lab,'预测 B 是否等待','free');await advance(lab,4);expect((await state(lab)).candidate.stale).toBe(true);
 await lab.getByRole('checkbox',{name:'写回前校验版本'}).check();await select(lab,'预测 B 是否等待','free');await advance(lab,4);expect((await state(lab)).candidate.value).toBe('新业务值');expect((await state(lab)).candidate.stale).toBe(false);
 await lab.getByRole('checkbox',{name:'把 I/O 移到锁外'}).uncheck();await lab.getByRole('checkbox',{name:'按键分成两片'}).check();await lab.getByRole('checkbox',{name:'B 访问同一热点键 A'}).check();await select(lab,'预测 B 是否等待','wait');await advance(lab,3);expect((await state(lab)).candidate.bStatus).toBe('等待锁');await fit(page,lab);
});
test('129 one snapshot load prevents mixed fields under the same write schedule',async({page})=>{
 const lab=await open(page,129);await select(lab,'预测读到的配置','mixed');await advance(lab,4);let s=await state(lab);expect([s.readLimit.value,s.readBurst.value]).toEqual([10,40]);
 await select(lab,'读取方式','reload');await select(lab,'预测读到的配置','mixed');await advance(lab,3);s=await state(lab);expect([s.readLimit.value,s.readBurst.value]).toEqual([10,40]);
 await select(lab,'读取方式','once');await select(lab,'预测读到的配置','old');await advance(lab,3);s=await state(lab);expect([s.readLimit.value,s.readBurst.value]).toEqual([10,20]);await fit(page,lab);
});
test('130 detached work retains correlation, needs its own deadline and is not durable',async({page})=>{
 const lab=await open(page,130);await select(lab,'预测请求结束后任务状态','canceling');await advance(lab,1);expect((await state(lab)).status).toBe('canceling');await advance(lab,1);expect((await state(lab)).status).toBe('stopped');
 await select(lab,'上下文来源','bounded');await select(lab,'汇总所需时间','1600');await select(lab,'服务开始退出','1800');await select(lab,'预测请求结束后任务状态','running');await advance(lab,5);let s=await state(lab);expect(s.value).toBe('req-7');expect(s.deadline).toBe(1000);expect(s.status).toBe('canceling');await advance(lab,1);expect((await state(lab)).status).toBe('stopped');
 await lab.getByRole('checkbox',{name:'600ms 注入进程崩溃'}).check();await select(lab,'预测请求结束后任务状态','running');await advance(lab,3);s=await state(lab);expect(s.status).toBe('lost');expect(s.service).toBe('crashed');await fit(page,lab);
});
