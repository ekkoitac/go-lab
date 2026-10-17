import {test,expect} from '@playwright/test';
test('159 probes can be stepped, rewound, repaired and switched to safe degradation',async({page})=>{
 await page.goto('/#lesson/159');await page.getByRole('button',{name:'动手观察',exact:true}).click();const lab=page.getByTestId('resilience-lab-159');await expect(lab).toBeVisible();const live=lab.getByTestId('live-model');const start=await live.getAttribute('data-state');
 await lab.locator('[data-resilience-action="step"]').click();await lab.locator('[data-resilience-action="back"]').click();await expect(live).toHaveAttribute('data-state',start!);
 await lab.locator('[data-resilience-action="step"]').click();await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('重启并撤流');
 await lab.getByRole('button',{name:'修复：存活只查进程'}).click();await lab.locator('[data-resilience-action="step"]').click();await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('撤流，保留进程');
 await lab.getByLabel('就绪判据').selectOption('degraded');await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('保留降级流量');
 await lab.getByLabel('故障注入').selectOption('slow');await lab.getByRole('checkbox',{name:'启用 startup 保护（6 周期）'}).check();for(let i=0;i<4;i++)await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('startup 保护中：未采样');await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('正常接流量');
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});expect(await lab.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();await lab.locator('[data-resilience-action="reset"]').focus();await page.keyboard.press('Enter');await expect(live).toContainText('等待探针采样');
});
test('159 help requires prediction and reason before reveal and supports causal rewiring',async({page})=>{
 await page.goto('/#lesson/159');await page.getByRole('button',{name:'让我试试',exact:true}).click();const help=page.getByTestId('resilience-help-159');await expect(help).toBeVisible();await expect(help.getByRole('button',{name:'运行并揭晓'})).toBeDisabled();
 await help.getByLabel('预测系统动作').selectOption('保留降级流量');await help.getByLabel('预测理由').fill('内部进程健康，本地索引满足只读业务，所以不需要重启或撤流。');await help.getByRole('button',{name:'提交预测与理由'}).click();await help.getByRole('button',{name:'运行并揭晓'}).click();await expect(help).toContainText('动作预测吻合');await expect(help.getByTestId('live-model')).toContainText('保留降级流量');
 await help.getByRole('button',{name:'换个新情境'}).click();await expect(help.getByRole('button',{name:'运行并揭晓'})).toBeDisabled();await expect(help.getByTestId('live-model')).toHaveCount(0);
 await page.getByRole('button',{name:'画图',exact:true}).click();await expect(help.getByTestId('live-model')).toContainText('撤流，保留进程');await help.getByRole('checkbox',{name:'把数据库失败连接到 liveness'}).check();await expect(help.getByTestId('live-model')).toContainText('重启并撤流');
});
