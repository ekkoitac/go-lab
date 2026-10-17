import {test,expect,type Page} from '@playwright/test';
import type {LabState} from '../../src/components/channel-lab/model';
async function open(page:Page,id:number){
  await page.goto('/#lesson/'+id);await page.getByRole('button',{name:'动手观察',exact:true}).click();
  const lab=page.locator('.learning-column').getByTestId('channel-lab');await expect(lab).toBeVisible();
  await lab.getByLabel('操作后播放').uncheck();
  const click=(name:string)=>lab.getByRole('button',{name,exact:true}).click();
  const state=async()=>JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!) as LabState;
  return {lab,click,state};
}
test('51: construct blocked same-goroutine path, rendezvous, then business completion',async({page})=>{
  const {lab,click,state}=await open(page,51);await lab.getByLabel('接收在另一个 goroutine 中').uncheck();await click('发送');await expect(lab.getByRole('button',{name:'接收',exact:true})).toBeDisabled();
  await lab.getByLabel('接收在另一个 goroutine 中').check();await click('发送');await click('接收');await expect.poll(async()=>(await state()).actors[1].status).toBe('working');
  await click('完成接收方业务');await expect(lab.getByTestId('live-model')).toContainText('业务处理完成');
});
test('52: buffer/pending send, recover through rewind, frame scrubbing, and branch replacement',async({page})=>{
  const {lab,click,state}=await open(page,52);await lab.getByLabel('通道容量').fill('1');await click('发送 1');await click('发送 2');await expect(lab.getByRole('button',{name:'发送 2',exact:true})).toBeDisabled();
  await click('接收');await expect.poll(async()=>(await state()).channels[0].queue).toEqual([2]);
  await lab.getByLabel('本步动画进度').fill('0');await expect(lab.getByRole('img',{name:'通信机制动画'})).toContainText('发送阻塞');
  await lab.getByLabel('本步动画进度').fill('77');await expect(lab.getByRole('img',{name:'通信机制动画'})).not.toContainText('发送阻塞');
  await click('回退一步');await click('协调者关闭通道');await expect(lab.getByTestId('live-model')).toContainText('panic');await expect(lab.getByRole('button',{name:'接收',exact:true})).toBeDisabled();
  await click('回退一步');await click('接收');await expect.poll(async()=>(await state()).channels[0].queue).toEqual([2]);await expect(lab.getByRole('button',{name:'前进一步',exact:true})).toBeDisabled();
  await lab.getByLabel('重播本步动画').click();await expect(lab.getByLabel('暂停动画')).toBeVisible();await lab.getByLabel('暂停动画').click();
});
test('53: early close panics; coordinator waits for both producers',async({page})=>{
  const {lab,click,state}=await open(page,53);await click('A 发送');await click('A 结束');await click('协调者等待并关闭');await expect(lab.locator('.channel-result')).toContainText('仍在等待');
  await click('接收方提前关闭');await click('B 发送');await expect.poll(async()=>(await state()).actors.find(a=>a.id==='b')!.status).toBe('panic');
  await click('重置');await click('A 发送');await click('B 发送');await click('A 结束');await click('B 结束');await click('协调者等待并关闭');await click('接收');await click('接收');await click('接收');await expect(lab.locator('.receive-result')).toContainText('ok=false');
});
test('54: zero true before zero false, and repeat reads are visible',async({page})=>{
  const {lab,click,state}=await open(page,54);await click('协调者关闭通道');for(let i=0;i<4;i++)await click('接收');
  expect((await state()).receipts).toEqual([{value:0,ok:true},{value:7,ok:true},{value:0,ok:false},{value:0,ok:false}]);await expect(lab.locator('.receive-count')).toContainText('4 次');
});
test('55: disabled nil branch, all-nil trap and guarded exit',async({page})=>{
  const {lab,click,state}=await open(page,55);await click('选择 A 分支');await click('选择 A 分支');await click('A 设为 nil');await expect(lab.getByRole('button',{name:'选择 A 分支',exact:true})).toBeDisabled();
  await click('向 B 放入数据');await click('选择 B 分支');await click('关闭 B');await click('选择 B 分支');await click('B 设为 nil');await click('执行下一次 select');await expect.poll(async()=>(await state()).actors[0].status).toBe('receive');
  await lab.getByLabel('进入 select 前检查全部输入结束').check();await click('A 设为 nil');await click('B 设为 nil');await click('执行下一次 select');await expect.poll(async()=>(await state()).actors[0].status).toBe('done');
  await click('重置');await click('A 设为 nil');await click('直接接收 nil A');await click('向 B 放入数据');await expect(lab.getByRole('button',{name:'选择 B 分支',exact:true})).toBeDisabled();
  await click('重置');await click('向 B 放入数据');await click('B 设为 nil');await expect(lab.locator('.channel-queue').nth(1)).toContainText('变量未引用通道 · len 0 / cap 0');
});
// Lesson 56 has its own guided model, covered in select-lab.spec.ts.
test('57: default spins, disabling default blocks until data or cancellation',async({page})=>{
  const {lab,click,state}=await open(page,57);for(let i=0;i<3;i++)await click('执行一轮循环');expect((await state()).defaults).toBe(3);
  await lab.getByLabel('保留 default 分支').uncheck();await click('执行一轮循环');await expect(lab.getByRole('button',{name:'执行一轮循环',exact:true})).toBeDisabled();await click('发送一条消息');await expect(lab.getByRole('button',{name:'执行一轮循环',exact:true})).toBeEnabled();
  await click('执行一轮循环');await click('发出取消');await expect.poll(async()=>(await state()).actors[0].status).toBe('done');
});
test('58: notification, observation and cleanup are three separate steps for both tasks',async({page})=>{
  const {lab,click,state}=await open(page,58);await click('发出取消');await click('搜索任务推进一步');expect((await state()).work).toBe(1);
  await lab.getByLabel('监听取消').check();await click('发出取消');expect((await state()).actors.every(a=>a.status==='ready')).toBe(true);
  for(const role of ['搜索任务','派生任务']){await click(role+'推进一步');await click(role+'清理并退出');}
  await expect(lab.getByTestId('live-model')).toContainText('已退出 2 / 2');
});
test('59: leak survives cancel until the blocked send itself listens; repaired run confirms cleanup',async({page})=>{
  const {lab,click,state}=await open(page,59);await click('下游提前退出');await click('发送');await click('发出取消');expect((await state()).actors[0].status).toBe('send');await expect(lab.getByTestId('live-model')).toContainText('存在泄漏');
  await lab.getByLabel('监听取消').check();await click('下游提前退出');await click('发送');await click('发出取消');expect((await state()).actors[0].status).toBe('cleanup');await click('清理上游并退出');await expect(lab.getByTestId('live-model')).toContainText('已收到退出确认');
});
test('60: worker limits, completion order, queue drain and explicit exits',async({page})=>{
  const {lab,click,state}=await open(page,60);await lab.getByLabel('通道容量').fill('1');await click('提交任务 1');await click('Worker 1 取任务');await click('提交任务 2');await click('Worker 2 取任务');
  await click('提交任务 3');await click('提交任务 4');await expect(lab.getByRole('button',{name:'提交任务 4',exact:true})).toBeDisabled();await click('Worker 2 完成任务');await click('Worker 2 取任务');
  await click('停止提交并关闭 jobs');await click('Worker 1 完成任务');await click('Worker 1 取任务');await click('Worker 1 完成任务');await click('Worker 2 完成任务');await click('Worker 1 取任务');await click('Worker 2 取任务');
  expect((await state()).completed).toEqual([2,1,4,3]);await expect(lab.getByTestId('live-model')).toContainText('退出 worker：2 / 2');await lab.screenshot({path:'.runtime/channel-chapter-60.png'});
});
test('nine shared channel labs: mobile containment, reduced motion, accessible state and no browser errors',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  for(let id=51;id<=60;id++){if(id===56)continue;const {lab}=await open(page,id);await expect(lab.getByLabel('操作后播放')).not.toBeChecked();const animation=lab.getByRole('img',{name:'通信机制动画'});await expect(animation).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`lesson ${id} page overflow`).toBe(true);expect(await lab.getByTestId('channel-animation').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`lesson ${id} animation clipped`).toBe(true);await expect(lab.getByTestId('live-model')).toContainText('本步完成后的状态');if(id===59)await lab.screenshot({path:'.runtime/channel-chapter-mobile.png'});}
  expect(errors).toEqual([]);
});
