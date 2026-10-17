import {test,expect} from '@playwright/test';
test('187 records a prediction, separates identity from authorization, and replays',async({page})=>{
 await page.goto('/#lesson/187',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.getByTestId('security-lab-187'),forward=lab.locator('[data-security-action="step"]');
 await expect(lab).toBeVisible();await expect(forward).toBeDisabled();
 await lab.getByLabel('预测三层检查结果').selectOption('permission');await lab.getByLabel('预测理由').fill('普通 Pod 的有效证书不能赋予订单服务权限');
 await forward.click();await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',/"stage":1/);
 await forward.click();await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',/"principal":"pod"/);
 await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',/"permission":"waiting"/);
 await forward.click();await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',/"outcome":"permission"/);
 await lab.locator('[data-security-action="back"]').click();await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',/"outcome":"pending"/);
 await forward.click();await expect(lab.getByText(/预测与模型一致/)).toBeVisible();
 await lab.locator('[data-security-action="reset"]').click();await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',/"stage":0/);await expect(forward).toBeDisabled();
});
test('187 changing a credential resets evidence and works at mobile width',async({page})=>{
 await page.setViewportSize({width:320,height:900});await page.goto('/#lesson/187',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();const lab=page.getByTestId('security-lab-187');
 await lab.getByLabel('调用方工作负载').selectOption('orders');await lab.getByLabel('客户端证书').selectOption('expired');await lab.getByLabel('预测三层检查结果').selectOption('identity');await lab.getByLabel('预测理由').fill('证书过期，身份无法建立');
 await lab.locator('[data-security-action="step"]').click();await lab.locator('[data-security-action="step"]').click();await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',/"outcome":"identity"/);
 await lab.getByLabel('客户端证书').selectOption('valid');await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',/"stage":0/);await expect(lab.getByLabel('预测理由')).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
