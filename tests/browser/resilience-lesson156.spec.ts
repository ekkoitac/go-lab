import {test,expect} from '@playwright/test';
test('156 orders queue behind reports, isolation and backtracking operate at narrow width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#lesson/156');
  await page.getByRole('button',{name:'动手观察',exact:true}).click();
  const lab=page.getByTestId('resilience-lab-156');
  await expect(lab).toBeVisible();
  const live=lab.getByTestId('live-model');
  const step=lab.getByRole('button',{name:'单步执行一拍',exact:true});
  await step.focus();await page.keyboard.press('Enter');await step.click();
  let s=JSON.parse((await live.getAttribute('data-state'))!);expect(s.queue.filter((j:{kind:string})=>j.kind==='order')).toHaveLength(3);
  await lab.getByLabel('隔离位置').selectOption('isolated');
  await lab.getByRole('button',{name:'保留配置重置'}).click();
  await step.click();await step.click();await step.click();
  s=JSON.parse((await live.getAttribute('data-state'))!);expect(s.done.filter((j:{kind:string})=>j.kind==='order')).toHaveLength(3);
  await lab.getByRole('button',{name:'回退一步',exact:true}).click();
  s=JSON.parse((await live.getAttribute('data-state'))!);expect(s.tick).toBe(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
