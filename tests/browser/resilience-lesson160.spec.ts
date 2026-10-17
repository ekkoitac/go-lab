import {test,expect} from '@playwright/test';
test('160 recovery model replays overload, rewinds, repairs and resets',async({page})=>{
 await page.goto('/#lesson/160');await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.getByTestId('resilience-lab-160'),live=lab.getByTestId('live-model');await expect(lab).toBeVisible();const initial=await live.getAttribute('data-state');
 await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('失败 36');await lab.locator('[data-resilience-action="back"]').click();await expect(live).toHaveAttribute('data-state',initial!);
 for(let i=0;i<2;i++)await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('下窗剔除');
 await lab.getByRole('button',{name:'回到健康权重并限速预热'}).click();await expect(lab.getByRole('slider',{name:'线上权重',exact:true})).toHaveValue('4');
 for(let i=0;i<8;i++)await lab.locator('[data-resilience-action="step"]').click();await expect(lab.getByRole('button',{name:'证据达标：加 10% 权重'})).toBeEnabled();
 await lab.getByRole('button',{name:'证据达标：加 10% 权重'}).click();await expect(lab.getByRole('slider',{name:'线上权重',exact:true})).toHaveValue('14');await expect(lab.getByRole('button',{name:'证据达标：加 10% 权重'})).toBeDisabled();
 await lab.locator('[data-resilience-action="reset"]').click();await expect(live).toHaveAttribute('data-state',initial!);
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});expect(await lab.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
 await lab.getByRole('slider',{name:'线上权重',exact:true}).focus();await page.keyboard.press('ArrowLeft');await expect(lab.getByRole('slider',{name:'线上权重',exact:true})).toHaveValue('98');
});
test('160 help uses matched counterfactuals and prediction before reveal',async({page})=>{
 await page.goto('/#lesson/160');await page.getByRole('button',{name:'举例子',exact:true}).click();let help=page.getByTestId('resilience-help-160');await expect(help.getByTestId('live-model')).toHaveCount(2);await help.getByRole('button',{name:'两边同步推进'}).click();await expect(help).toContainText('失败 36');
 await page.getByRole('button',{name:'画图',exact:true}).click();help=page.getByTestId('resilience-help-160');await help.getByRole('slider',{name:'因果实验预热预算'}).fill('8');await expect(help).toContainText('净预热收益为 0');
 await page.getByRole('button',{name:'拆步骤',exact:true}).click();help=page.getByTestId('resilience-help-160');await expect(help.getByRole('button',{name:'证据满足，放量一级'})).toBeDisabled();for(let i=0;i<2;i++)await help.getByRole('button',{name:'采样本档流量'}).click();await expect(help.getByRole('button',{name:'证据满足，放量一级'})).toBeEnabled();
 await page.getByRole('button',{name:'让我试试',exact:true}).click();help=page.getByTestId('resilience-help-160');await expect(help.getByTestId('live-model')).toHaveCount(0);await expect(help.getByRole('button',{name:'运行并揭晓'})).toBeDisabled();await help.getByRole('combobox',{name:'恢复决策预测'}).selectOption('hold');await help.getByRole('textbox',{name:'恢复预测理由'}).fill('容量12减预热4只剩8，小于流量10，将排队2。');await help.getByRole('button',{name:'提交预测与理由'}).click();await help.getByRole('button',{name:'运行并揭晓'}).click();await expect(help).toContainText('预测吻合');await expect(help.getByTestId('live-model')).toContainText('排队 2');await help.getByRole('button',{name:'换个新情境'}).click();await expect(help.getByTestId('live-model')).toHaveCount(0);
});
