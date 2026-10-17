import {test,expect} from '@playwright/test';
for(const width of [1440,390])test(`74 prediction, streaming, free comparison and custom help at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#lesson/74',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId('data-boundary-lab-74');await expect(lab).toBeVisible();
 const editor=await page.locator('.cm-content').first().textContent();
 await expect(lab.getByRole('button',{name:'单步执行',exact:true})).toBeDisabled();
 await lab.getByLabel('我的预测').selectOption('reject');await lab.getByLabel('预测理由').fill('我以为字段检查同时检查尾部');
 await lab.getByRole('button',{name:'记录预测',exact:true}).click();await lab.getByRole('button',{name:'单步执行',exact:true}).focus();await page.keyboard.press('Enter');
 const state=async()=>JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
 expect((await state()).cursor).toBe(7);await expect(lab.locator('.db74-consumed')).toHaveText('{"n":1}');
 await lab.getByRole('button',{name:'单步执行',exact:true}).click();expect((await state()).outcome).toBe('accept');
 await lab.getByLabel('根据游标和返回值修正解释').fill('未知字段检查不检查尾部，需要第二次 Decode 返回 EOF');await lab.getByRole('button',{name:'保存修正',exact:true}).click();
 await lab.getByRole('button',{name:'保存为基线',exact:true}).click();
 await lab.getByRole('button',{name:'自由实验',exact:true}).click();await lab.getByLabel('第二次 Decode 检查 EOF').check();
 expect((await state()).phase).toBe(0);await lab.getByRole('button',{name:'单步执行',exact:true}).click();await lab.getByRole('button',{name:'单步执行',exact:true}).click();
 const final=await state();expect(final.outcome).toBe('reject');expect(final.cursor).toBe(15);await expect(lab.locator('aside')).toContainText('接受');
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();await lab.getByRole('button',{name:'单步执行',exact:true}).click();expect(await state()).toEqual(final);
 for(const name of ['解码器读到哪里','搭建校验流程','找出漏网输入']){
  await page.locator('.help-panel').getByRole('button',{name,exact:true}).click();const help=page.locator('.help-content').getByTestId('data-boundary-help-74');await expect(help).toBeVisible();
  if(name==='解码器读到哪里'){await help.getByLabel('待追踪输入').selectOption('1');await help.getByRole('button',{name:'读取下一个值'}).click();await help.getByRole('button',{name:'读取下一个值'}).click();expect(JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!).second).toBe('nil');}
  if(name==='搭建校验流程'){await help.getByLabel('接入未知字段检查').check();await help.getByLabel('接入尾部 EOF 检查').check();await help.getByRole('button',{name:'运行四份输入'}).click();await expect(help.getByRole('status')).toContainText('四份输入符合契约');}
  if(name==='找出漏网输入'){await expect(help.getByTestId('live-model')).toHaveCount(0);await help.getByLabel('第二次 Decode 的结果').selectOption('nil');await help.getByRole('button',{name:'提交判断'}).click();await expect(help).toContainText('首次无提示：正确');}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 expect(await page.locator('.cm-content').first().textContent()).toBe(editor);
 await lab.getByRole('button',{name:'引导任务',exact:true}).click();await expect(lab.getByLabel('我的预测')).toHaveValue('');await expect(lab.getByRole('button',{name:'单步执行',exact:true})).toBeDisabled();await lab.getByRole('button',{name:'重置本轮'}).click();expect((await state()).phase).toBe(0);
});
