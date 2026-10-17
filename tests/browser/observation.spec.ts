import {test,expect,type Page} from '@playwright/test';
import {introLessons as lessons} from '../intro-lessons';
async function open(page:Page,id:number){
 await page.goto('/#lesson/'+id);
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const panel=page.locator('.learning-column .experiment-panel');
 await expect(panel.getByTestId(id>=51&&id<=60?'channel-animation':'experiment-scene')).toBeVisible();
 return panel;
}
async function checkGeometry(page:Page){
 return page.locator('.learning-column .scene-node').evaluateAll(nodes=>nodes.flatMap(node=>{
  const rect=node.querySelector('rect')!.getBBox();
  const bounds=node.getBoundingClientRect(),svg=node.closest('svg')!.getBoundingClientRect();
  const problems:string[]=[];
  if(bounds.left<svg.left-1||bounds.right>svg.right+1||bounds.top<svg.top-1||bounds.bottom>svg.bottom+1)problems.push('node outside SVG');
  for(const other of nodes){if(other===node)continue;const b=other.getBoundingClientRect();if(bounds.left<b.right-1&&bounds.right>b.left+1&&bounds.top<b.bottom-1&&bounds.bottom>b.top+1)problems.push('overlapping nodes');}
  return problems.concat([...node.querySelectorAll('text')].flatMap(text=>{
   const box=text.getBBox();
   return box.x<rect.x-1||box.x+box.width>rect.width+1||box.y<rect.y-1||box.y+box.height>rect.height+1?[text.textContent??'']:[];
  }));
 }));
}
for(let chapter=0;chapter<10;chapter++){
// Chapters 5–10 use dedicated models, covered by their own browser suites.
if(chapter===4||chapter===5||chapter===6||chapter===7||chapter===8||chapter===9)continue;
const chapterLessons=lessons.slice(chapter*10,chapter*10+10);
test(`chapter ${chapter+1}: every frame is readable and controls are reversible`,async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const lesson of chapterLessons){
  const panel=await open(page,lesson.id),svg=panel.getByTestId('experiment-scene');
  for(let branch=0;branch<lesson.experiment.scenarios.length;branch++){
   const scenario=lesson.experiment.scenarios[branch];
   await panel.locator('.scenario-tabs button').nth(branch).click();
   await expect(panel.getByLabel('实验步骤')).toHaveValue('0');
   for(let index=0;index<scenario.frames.length;index++){
    const frame=scenario.frames[index];
    await expect(svg).toHaveAttribute('data-state',JSON.stringify(frame));
    expect(await checkGeometry(page),`lesson ${lesson.id} branch ${branch} frame ${index}`).toEqual([]);
    expect(await svg.locator('.scene-edge').count()).toBe(frame.edges?.length??0);
    if(index<scenario.frames.length-1)await panel.getByLabel('下一步实验',{exact:true}).click();
   }
   await expect(panel.getByLabel('下一步实验',{exact:true})).toBeDisabled();
   await panel.getByLabel('上一步实验',{exact:true}).click();
   await expect(panel.getByLabel('实验步骤')).toHaveValue(String(scenario.frames.length-2));
   if(scenario.frames.length>2)await panel.getByLabel('回到开始',{exact:true}).click();
   else await expect(panel.getByLabel('回到开始',{exact:true})).toBeDisabled();
   await expect(panel.getByLabel('上一步实验',{exact:true})).toBeDisabled();
  }
  await panel.getByText('对比两种条件的末步结果',{exact:true}).click();
  await expect(panel.locator('.scenario-comparison section')).toHaveCount(2);
 }
 expect(errors).toEqual([]);
});
test(`chapter ${chapter+1}: phone layout keeps full text inside cards`,async({page})=>{
 test.setTimeout(180000);await page.setViewportSize({width:390,height:844});
 for(const lesson of chapterLessons){
  const panel=await open(page,lesson.id);
  for(let branch=0;branch<2;branch++){
   await panel.locator('.scenario-tabs button').nth(branch).click();
   await panel.getByLabel('实验步骤').fill(String(lesson.experiment.scenarios[branch].frames.length-1));
   expect(await checkGeometry(page),`mobile lesson ${lesson.id}/${branch}`).toEqual([]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow lesson ${lesson.id}`).toBe(true);
  }
 }
});
}
test('manual steps pause autoplay; replay, seek and condition switch never skip or overflow',async({page})=>{
 const panel=await open(page,1);await page.clock.install();
 const slider=panel.getByLabel('实验步骤');
 await panel.getByLabel('播放',{exact:true}).click();
 await page.clock.fastForward(1800);await expect(slider).toHaveValue('1');
 await panel.getByLabel('上一步实验',{exact:true}).click();
 await page.clock.fastForward(4000);await expect(slider).toHaveValue('0');
 await panel.getByLabel('播放',{exact:true}).click();
 await panel.locator('.scenario-tabs button').nth(1).click();
 await page.clock.fastForward(4000);await expect(slider).toHaveValue('0');
 await slider.fill('2');await panel.getByLabel('播放',{exact:true}).click();
 await expect(slider).toHaveValue('0');
 await page.clock.fastForward(1800);await expect(slider).toHaveValue('1');
 await page.clock.fastForward(1800);await expect(slider).toHaveValue('2');
 await expect(panel.getByLabel('播放',{exact:true})).toBeVisible();
 await page.clock.fastForward(5000);await expect(slider).toHaveValue('2');
});
test('string rune indices are Go byte offsets, including empty and combined text',async({page})=>{
 const panel=await open(page,6),lab=panel.locator('.special-lab');
 await expect(lab.getByRole('button',{name:'字节 · 8',exact:true})).toBeVisible();
 await lab.getByRole('button',{name:'rune · 3',exact:true}).click();
 await expect(lab.locator('.cell small')).toHaveText(['0','1','4']);
 await lab.getByLabel('字符串输入').fill('e\u0301🙂');
 await expect(lab.locator('.cell small')).toHaveText(['0','1','3']);
 await lab.getByLabel('字符串输入').fill('');
 await expect(lab).toContainText('空字符串 · 0 字节 / 0 rune');
});
test('typed nil and value toggles do not retain an impossible hidden pointer',async({page})=>{
 const lab=(await open(page,24)).locator('.special-lab');
 await lab.getByLabel('指针指向对象',{exact:true}).check();
 await lab.getByLabel('包含动态类型',{exact:true}).uncheck();
 await expect(lab.getByLabel('指针指向对象',{exact:true})).not.toBeChecked();
 await expect(lab).toContainText('err == nil → true');
 await lab.getByLabel('包含动态类型',{exact:true}).check();
 await expect(lab).toContainText('nil 指针');
 await expect(lab).toContainText('err == nil → false');
});
test('closing an empty channel wakes the receiver with a visible zero/false result',async({page})=>{
 const lab=await open(page,52);
 await lab.getByRole('button',{name:'接收',exact:true}).click();
 await lab.getByRole('button',{name:'协调者关闭通道',exact:true}).click();
 await expect(lab.locator('.receive-result')).toHaveText('最近一次接收：value=0 · ok=false');
 await expect(lab.getByRole('button',{name:'接收',exact:true})).toBeEnabled();
 await lab.getByRole('button',{name:'发送 1',exact:true}).click();
 await expect(lab.getByTestId('live-model')).toContainText('panic');
 await lab.getByRole('button',{name:'重置',exact:true}).click();
 await expect(lab.locator('.receive-result')).toContainText('尚无结果');
});
// Transaction rollback and uncertain commit feedback: data-boundary-77.spec.ts.
test('review screenshots: memory relations, full values and mobile',async({page})=>{
 for(const id of [5,13]){
  const panel=await open(page,id);
  await panel.getByLabel('下一步实验',{exact:true}).click();
  await panel.screenshot({path:`.runtime/observation-${id}.png`});
 }
 await page.setViewportSize({width:390,height:844});
 const panel=await open(page,6);
 await panel.screenshot({path:'.runtime/observation-mobile.png'});
});

// User-facing feedback matters even when a valid operation keeps the same value.
test('unchanged assignment explains why the click did not change a value',async({page})=>{
 const panel=await open(page,9);
 await panel.getByLabel('下一步实验',{exact:true}).click();
 await panel.getByLabel('下一步实验',{exact:true}).click();
 await expect(panel.locator('.scene-changes')).toContainText('本步已执行，展示的值保持不变');
 await expect(panel.locator('.frame-caption')).toContainText('读到的是新的 a');
 await expect(panel.getByLabel('下一步实验',{exact:true})).toHaveText('本条件已完成');
});
test('named steps support keyboard navigation, cancel playback and preserve current condition on reselection',async({page})=>{
 const panel=await open(page,16);
 await panel.locator('.scenario-tabs button').nth(1).click();
 await page.clock.install();
 await panel.getByLabel('播放',{exact:true}).click();
 const steps=panel.getByRole('list',{name:'图解步骤'}).getByRole('button');
 await steps.nth(2).focus();await page.keyboard.press('Enter');
 await expect(panel.getByLabel('实验步骤')).toHaveValue('2');
 await expect(panel.locator('.scene-changes')).toContainText('[3 6 9]');
 await expect(panel.locator('.scene-changes')).toContainText('[99 6 9]');
 await page.clock.fastForward(4000);
 await expect(panel.getByLabel('实验步骤')).toHaveValue('2');
 await panel.locator('.scenario-tabs button').nth(1).click();
 await expect(panel.getByLabel('实验步骤')).toHaveValue('2');
 await steps.nth(0).click();
 await expect(panel.getByLabel('回到开始',{exact:true})).toBeDisabled();
 await expect(panel.locator('.next-operation')).toContainText('执行 copy');
});
// Read data/error ordering and reset are covered by io-lab.spec.ts.
test('repeated closed-channel receives remain visible and capacity reset clears the receipt count',async({page})=>{
 const lab=await open(page,52);
 await lab.getByRole('button',{name:'协调者关闭通道',exact:true}).click();
 for(let i=1;i<=3;i++){
  await lab.getByRole('button',{name:'接收',exact:true}).click();
  await expect(lab.locator('.receive-count')).toContainText(`已完成接收 ${i} 次`);
  await expect(lab.locator('.receive-result')).toContainText('value=0 · ok=false');
 }
 await lab.getByLabel('通道容量').fill('0');
 await expect(lab.locator('.receive-count')).toContainText('已完成接收 0 次');
 await expect(lab.locator('.channel-result')).toContainText('实验起点');
});
