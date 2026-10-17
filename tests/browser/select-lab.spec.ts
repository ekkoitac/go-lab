import {test,expect,type Page,type Locator} from '@playwright/test';
import type {SelectState} from '../../src/components/select-lab/model';

// The first navigation may include cold Vite transforms for the full course shell.
test.setTimeout(90000);

async function open(page:Page){
  await page.goto('/#lesson/56',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'动手观察',exact:true}).click();
  const lab=page.locator('.learning-column').getByTestId('select-lab');
  await expect(lab).toBeVisible();
  const click=(name:string)=>lab.getByRole('button',{name,exact:true}).click();
  const state=async()=>JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!) as SelectState;
  const stage=async(name:string)=>lab.getByRole('navigation',{name:'select 实验阶段'}).getByRole('button',{name:new RegExp(name)}).click();
  return {lab,click,state,stage};
}
async function finish(lab:Locator){
  await lab.getByRole('button',{name:'揭示本次选择',exact:true}).click();
  await lab.getByRole('button',{name:/^(完成接收并离开|响应取消并离开|执行 default 并离开)$/}).click();
}

test('readiness changes with actual message; reveal, consumption, code position, rewind and reset agree',async({page})=>{
  const {lab,click,state}=await open(page);
  await expect(lab.getByTestId('channel-a')).toContainText('暂无消息');
  await click('放入 A 消息');await expect(lab.getByTestId('channel-a')).toContainText('可以接收');
  await expect(lab.getByTestId('case-a')).toContainText('已就绪');
  await click('执行 select');expect((await state()).phase).toBe('ready');
  await expect(lab.getByRole('button',{name:'放入 B 消息',exact:true})).toBeDisabled();
  await expect(lab.getByTestId('case-a')).not.toHaveClass(/chosen/);
  await click('揭示本次选择');await expect(lab.getByTestId('case-a')).toHaveClass(/chosen/);
  expect((await state()).board.a).toBe(true);await click('完成接收并离开');
  expect((await state()).board.a).toBe(false);await expect(lab.locator('.select-receiver')).toContainText('v = A');
  await expect(lab.locator('.select-code-line.active')).toHaveText('afterSelect()');
  await click('回退一步');expect((await state()).board.a).toBe(true);await click('前进一步');expect((await state()).choice).toBe('a');
  await click('重置本阶段');expect((await state()).phase).toBe('setup');expect((await state()).runs).toEqual([]);
});

test('predict possible outcomes, preserve the unselected message and explicitly compare both paths',async({page})=>{
  const {lab,click,state,stage}=await open(page);await stage('两个都能执行');
  const assessmentWrites:string[]=[];
  page.on('request',request=>{if(request.method()==='POST'&&/\/api\/progress\/56\/(attempt|help|reveal)/.test(request.url()))assessmentWrites.push(request.url());});
  await click('放入 A 消息');await click('放入 B 消息');
  await lab.getByLabel('两个分支都执行',{exact:true}).check();await click('检查预测');
  await expect(lab.locator('.select-prediction-feedback')).toContainText('一次 select 只执行一个分支');
  await lab.getByLabel('两个分支都执行',{exact:true}).uncheck();
  await lab.getByLabel('收到 A',{exact:true}).check();await lab.getByLabel('收到 B',{exact:true}).check();await click('检查预测');
  await expect(lab.locator('.select-prediction-feedback')).toContainText('预测正确');
  await click('执行 select');await finish(lab);
  const first=await state(),other=first.choice==='a'?'b':'a';
  expect(first.board[other]).toBe(true);await expect(lab.getByTestId(`channel-${other}`)).toContainText('本次未选中');
  await click('演示另一种合法结果');await expect(lab.locator('.select-feedback')).toContainText('非随机运行');await finish(lab);
  const demo=await state();expect(demo.choice).toBe(other);expect(demo.runs.map(r=>r.source)).toEqual(['random','demo']);
  await expect(lab.locator('.select-records summary')).toContainText('随机执行 1 次');
  await click('恢复相同条件再试');expect((await state()).board.a).toBe(true);expect((await state()).board.b).toBe(true);
  await click('执行 select');await finish(lab);expect((await state()).source).toBe('random');
  expect(assessmentWrites,'exploration must not write assessment evidence').toEqual([]);
  await lab.screenshot({path:'.runtime/select-lab-desktop.png',animations:'disabled'});
});

test('case reordering only changes code; either branch remains legal',async({page})=>{
  const {lab,click,state,stage}=await open(page);await stage('交换代码顺序');
  await click('放入 A 消息');await click('放入 B 消息');await click('交换 case 位置');
  expect((await state()).board.order).toEqual(['b','a']);
  await expect(lab.locator('.select-code-case').first()).toHaveAttribute('data-testid','case-b');
  await expect(lab.locator('.select-channel').first()).toHaveAttribute('data-testid','channel-a');
  await click('执行 select');await expect(lab.getByRole('button',{name:'交换 case 位置',exact:true})).toBeDisabled();
  await finish(lab);const first=(await state()).choice;await click('演示另一种合法结果');await finish(lab);
  expect((await state()).choice).not.toBe(first);expect((await state()).snapshot!.order).toEqual(['b','a']);
});

test('arrival experiment preserves contrasting snapshots and waiting is woken by an actual event',async({page})=>{
  const {lab,click,state,stage}=await open(page);await stage('改变到达顺序');
  await click('放入 A 消息');await click('执行 select');await finish(lab);expect((await state()).choice).toBe('a');
  await click('清空通道，安排新条件');await click('放入 A 消息');await click('放入 B 消息');await click('执行 select');await finish(lab);
  const runs=(await state()).runs;expect(runs).toHaveLength(2);expect(runs[0].snapshot.b).toBe(false);expect(runs[1].snapshot.b).toBe(true);
  await click('清空通道，安排新条件');await click('执行 select');expect((await state()).phase).toBe('waiting');
  await expect(lab.locator('.select-receiver')).toContainText('等待中');await click('放入 B 消息');expect((await state()).choice).toBe('b');
  await expect(lab.getByRole('button',{name:'放入 A 消息',exact:true})).toBeDisabled();await finish(lab);
  await expect(lab.locator('.select-snapshot')).toContainText('等待期间的新事件');
  await lab.getByLabel('操作时间线',{exact:true}).fill('0');expect((await state()).phase).toBe('setup');
  await click('放入 B 消息');await expect(lab.getByRole('button',{name:'前进一步',exact:true})).toBeDisabled();
  expect((await state()).runs).toEqual([]);expect((await state()).board.b).toBe(true);
});

test('cancellation signal remains active in both outcomes and can wake an empty select',async({page})=>{
  const {lab,click,state,stage}=await open(page);await stage('结果与取消');
  await expect(lab.locator('.select-code-case').first()).toContainText('ctx.Done()');
  await click('放入请求结果');await click('发出取消');
  await lab.getByLabel('响应取消',{exact:true}).check();await click('检查预测');
  await expect(lab.locator('.select-prediction-feedback')).toContainText('两个分支都已就绪');
  await click('执行 select');await finish(lab);const first=(await state()).choice;
  await click('演示另一种合法结果');await finish(lab);expect((await state()).choice).not.toBe(first);
  expect((await state()).board.cancelled).toBe(true);await expect(lab.getByTestId('channel-b').locator('.select-signal')).toHaveText('已取消');
  await click('清空通道，安排新条件');await click('执行 select');await click('发出取消');await finish(lab);
  expect((await state()).choice).toBe('b');expect((await state()).board.cancelled).toBe(true);
});

test('default is a fallback, supports keyboard control, and reset does not change the editor',async({page})=>{
  const {lab,click,state}=await open(page);
  const editor=page.locator('.cm-content').first(),before=await editor.textContent();
  await lab.locator('.select-supplement summary').click();
  const checkbox=lab.getByLabel('加入 default 分支');await checkbox.focus();await page.keyboard.press('Space');
  await click('执行 select');await finish(lab);expect((await state()).choice).toBe('default');
  await click('清空通道，安排新条件');await click('放入 A 消息');await click('执行 select');await finish(lab);expect((await state()).choice).toBe('a');
  await click('重置本阶段');expect(await editor.textContent()).toBe(before);
});

test('all stages fit mobile, announce state, respect reduced motion and produce no browser errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  const {lab,click,stage}=await open(page);
  for(const title of ['认识就绪','两个都能执行','交换代码顺序','改变到达顺序','结果与取消']){
    await stage(title);await click(title==='结果与取消'?'放入请求结果':'放入 A 消息');await click('执行 select');await finish(lab);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),title).toBe(true);
    const overflow=await lab.locator('.select-channel,.select-code,.select-receiver,.select-task,.select-controls').evaluateAll(nodes=>nodes.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className));
    expect(overflow,title).toEqual([]);
    await expect(lab.locator('.select-feedback[role="status"]')).toBeVisible();
    expect(await lab.locator('.select-moving-token').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  }
  await lab.screenshot({path:'.runtime/select-lab-mobile.png'});expect(errors).toEqual([]);
});
