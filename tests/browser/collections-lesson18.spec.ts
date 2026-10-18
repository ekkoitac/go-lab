import { test, expect } from '@playwright/test';
test('lesson 18 predicts null, repairs boundary, appends, truncates and rewinds',async({page})=>{
  await page.goto('/#lesson/18');await page.getByRole('button',{name:'动手观察',exact:true}).click();
  const lab=page.getByTestId('collections-lab-18');const model=lab.getByTestId('live-model');
  const predict=async(answer:string)=>{await lab.getByLabel('预测 JSON',{exact:true}).fill(answer);await lab.getByLabel('预测依据',{exact:true}).fill('根据 nil 性质及边界转换判断');await lab.getByRole('button',{name:'编码并验证契约',exact:true}).click();};
  await expect(lab.getByRole('button',{name:'编码并验证契约'})).toBeDisabled();
  await predict('[]');expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({isNil:true,len:0,wire:'null',accepted:false});
  await expect(lab).toContainText('预测需要修正');await lab.getByRole('button',{name:'边界规范化：关闭'}).click();await predict('[]');
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({isNil:true,normalize:true,wire:'[]',accepted:true});
  await lab.getByRole('button',{name:'追加 7',exact:true}).click();await predict('[7]');expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({items:[7],len:1,wire:'[7]'});
  await lab.getByRole('button',{name:'截短为零 items[:0]',exact:true}).click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({items:[],isNil:false,len:0,wire:null});
  await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({items:[7],wire:'[7]'});
  await lab.getByRole('button',{name:'重置实验',exact:true}).click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({items:null,normalize:false,wire:null});
});
test('lesson 18 distinct help interactions preserve main lab, conceal transfer and fit mobile',async({page})=>{
  await page.goto('/#lesson/18');await page.getByRole('button',{name:'动手观察',exact:true}).click();
  const lab=page.getByTestId('collections-lab-18');const original=await lab.getByTestId('live-model').getAttribute('data-state');const help=page.getByTestId('collections-help-18');
  await page.getByRole('button',{name:'举例子',exact:true}).click();await help.getByRole('button',{name:'交付篮子'}).click();await expect(help).toContainText('接收失败');await help.getByRole('button',{name:'提供空篮子',exact:true}).click();await help.getByRole('button',{name:'交付篮子'}).click();await expect(help).toContainText('接收成功');
  await page.getByRole('button',{name:'画图',exact:true}).click();await help.getByRole('button',{name:'切换边界转换'}).click();expect(JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({items:null,out:[],wire:'[]'});await help.getByRole('button',{name:'输入 [4,8]',exact:true}).click();expect(JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({items:[4,8],out:[4,8],wire:'[4,8]'});
  await page.getByRole('button',{name:'拆步骤',exact:true}).click();await help.getByRole('button',{name:'执行下一步'}).click();await help.getByRole('button',{name:'执行下一步'}).click();expect(JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({items:[0,0],len:2,wire:'[0,0]'});await help.getByLabel('第二步执行',{exact:true}).selectOption('truncate');await help.getByRole('button',{name:'执行下一步'}).click();expect(JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({items:[],len:0,isNil:false});
  await page.getByRole('button',{name:'让我试试',exact:true}).click();expect(JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!)).not.toHaveProperty('result');await expect(help.getByRole('button',{name:'提交并核对'})).toBeDisabled();await help.getByLabel('日志 JSON 输出',{exact:true}).fill('null');await help.getByLabel('解释 nil、长度与操作的关系',{exact:true}).fill('追加零项仍为 nil');await help.getByRole('button',{name:'提交并核对'}).click();await expect(help).toContainText('本次预测吻合');await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',original!);
  await page.emulateMedia({reducedMotion:'reduce'});for(const width of [390,320]){await page.setViewportSize({width,height:844});expect(await lab.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBeTruthy();expect(await help.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBeTruthy();}
  await help.getByRole('button',{name:'换一组输入'}).focus();await page.keyboard.press('Enter');expect(JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({variant:1,checked:false});
});
