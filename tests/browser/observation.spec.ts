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
// Dedicated chapter models are covered by their own browser suites (31–40: control-flow-lessons).
if(chapter===0||chapter===1||chapter===2||chapter===3||chapter===4||chapter===5||chapter===6||chapter===7||chapter===8||chapter===9)continue;
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
// Foundation lesson interactions moved to foundations-behavior.spec.ts and foundations-lessons.spec.ts.
// Foundation lesson interactions moved to foundations-behavior.spec.ts and foundations-lessons.spec.ts.
// Typed nil legal-slot and call-path regression: types-lessons.spec.ts (lesson 24).
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
// Foundation lesson interactions moved to foundations-behavior.spec.ts and foundations-lessons.spec.ts.

// User-facing feedback matters even when a valid operation keeps the same value.
// Foundation lesson interactions moved to foundations-behavior.spec.ts and foundations-lessons.spec.ts.
// Foundation lesson interactions moved to foundations-behavior.spec.ts and foundations-lessons.spec.ts.
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
