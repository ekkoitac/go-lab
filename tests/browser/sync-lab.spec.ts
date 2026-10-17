import {test,expect,type Page,type Locator} from '@playwright/test';
import {initial,transition,type State,type Action} from '../../src/components/sync-lab/model';
import {guides,routeFor,challenge} from '../../src/components/sync-lab/guides';
test.setTimeout(180000);
async function open(page:Page,id:number){
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId('sync-lab');await expect(lab).toBeVisible();return lab;
}
const state=async(lab:Locator)=>JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!) as State;
const click=async(lab:Locator,action:Action)=>lab.locator('[data-action="'+action+'"]').click();
test('all ten labs execute both conditions, stay reversible, and show actual model changes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 for(let id=41;id<=50;id++){
  const lab=await open(page,id);
  for(const fixed of [false,true]){
   await lab.getByRole('button',{name:guides[id].conditions[fixed?1:0],exact:true}).click();
   let expected=initial(id,fixed);
   for(const action of routeFor(id,fixed,2)){await click(lab,action);expected=transition(expected,action);expect(await state(lab)).toEqual(expected);}
   const final=await state(lab);await lab.getByRole('button',{name:'回退一步',exact:true}).click();await lab.getByRole('button',{name:'前进一步',exact:true}).click();expect(await state(lab)).toEqual(final);
   await lab.getByRole('button',{name:'重置实验',exact:true}).click();expect(await state(lab)).toEqual(initial(id,fixed));
  }
 }
 expect(errors).toEqual([]);
});
test('prediction, branch history, preserved comparison, parameters and editor isolation',async({page})=>{
 const lab=await open(page,43),editor=page.locator('.cm-content').first(),before=await editor.textContent();
 await lab.getByLabel('下一步预测与理由').fill('B 会读到旧值，因为 A 尚未写回');
 await click(lab,'a');await expect(lab.locator('.sync-saved-prediction')).toContainText('B 会读到旧值');
 await click(lab,'b');await click(lab,'a');await lab.getByRole('button',{name:'回退一步',exact:true}).click();await click(lab,'b');
 await expect(lab.getByRole('button',{name:'前进一步',exact:true})).toBeDisabled();
 await lab.getByRole('button',{name:'保存当前状态为对照',exact:true}).click();
 await lab.getByRole('button',{name:guides[43].conditions[1],exact:true}).click();await expect(lab.locator('.sync-compare table')).toBeVisible();
 await lab.getByLabel('每次增加的数值').fill('3');await expect(lab.locator('.sync-compare')).toContainText('输入已不同');expect((await state(lab)).size).toBe(3);
 await lab.locator('[data-action=a]').focus();await page.keyboard.press('Enter');expect((await state(lab)).pc).toEqual([1,0]);await expect(lab.locator('[data-action=b]')).toBeDisabled();
 expect(await editor.textContent()).toBe(before);
});
test('four help modes for each lesson: mapping, live diagram, guided causal path and prediction before reveal',async({page})=>{
 const attempts:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))attempts.push(r.url());});
 for(let id=41;id<=50;id++){
  await open(page,id);const help=page.locator('.help-panel');
  await help.getByRole('button',{name:'举例子',exact:true}).click();await expect(help.locator('.sync-help table')).toBeVisible();await expect(help.getByTestId('sync-lab')).toHaveCount(0);
  await help.getByRole('button',{name:'画图',exact:true}).click();const diagram=help.getByTestId('sync-diagram');await expect(diagram).toBeVisible();await expect(diagram.getByTestId('sync-diagram-svg')).toBeVisible();await diagram.getByRole('button',{name:'从头看',exact:true}).click();await diagram.getByRole('button',{name:'下一帧',exact:true}).click();expect(JSON.parse((await diagram.getAttribute('data-state'))!).line).not.toBe('尚未执行');
  await help.getByRole('button',{name:'拆步骤',exact:true}).click();const guided=help.getByTestId('sync-lab');
  for(const fixed of [false,true]){
   await guided.getByRole('button',{name:guides[id].conditions[fixed?1:0],exact:true}).click();
   for(const _ of routeFor(id,fixed,2))await guided.getByRole('button',{name:'执行引导下一步',exact:true}).click();
   await expect(guided.getByRole('button',{name:'引导路径已完成',exact:true})).toBeDisabled();
  }
  await help.getByRole('button',{name:'让我试试',exact:true}).click();const practice=help.getByTestId('sync-practice');
  for(const variant of [0,1]){
   const c=challenge(id,variant);await expect(practice.getByTestId('live-model')).toHaveCount(0);
   await expect(practice.getByRole('button',{name:'提交预测并验证',exact:true})).toBeDisabled();
   await practice.getByRole('button',{name:c.answer,exact:true}).click();await practice.getByLabel('练习预测理由').fill('依据当前同步边界推导');
   await practice.getByRole('button',{name:'提交预测并验证',exact:true}).click();await expect(practice).toContainText('这次预测与模型一致');await expect(practice.getByTestId('live-model')).toBeVisible();
   if(variant===0)await practice.getByRole('button',{name:'换一组条件再预测',exact:true}).click();
  }
 }
 expect(attempts).toEqual([]);
});
test('390px reduced-motion: all labs and all help modes fit; waiting cycle and recheck evidence remain readable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 for(let id=41;id<=50;id++){
  const lab=await open(page,id);await click(lab,'a');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+id).toBe(true);
  const clipped=await lab.locator('.sync-metric,.sync-relations b').evaluateAll(elements=>elements.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));
  expect(clipped,'clipped content '+id).toEqual([]);
  for(const mode of ['举例子','画图','拆步骤','让我试试']){
   await page.locator('.help-panel').getByRole('button',{name:mode,exact:true}).click();await expect(page.locator('.help-content')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'help overflow '+id+'/'+mode).toBe(true);
  }
 }
 const lab=await open(page,47);await lab.getByRole('button',{name:guides[47].conditions[1],exact:true}).click();
 for(const a of ['a','a','inject','a','a'] as Action[])await click(lab,a);
 await expect(lab).toContainText('保留已有值');await lab.screenshot({path:'.runtime/sync-lab-mobile.png',animations:'disabled'});
 await page.setViewportSize({width:1440,height:1100});const cycle=await open(page,46);await click(cycle,'a');await click(cycle,'b');await click(cycle,'a');await click(cycle,'b');await expect(cycle.locator('.sync-warning')).toBeVisible();await cycle.screenshot({path:'.runtime/sync-lab-desktop.png',animations:'disabled'});
});

