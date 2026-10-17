import {test, expect} from '@playwright/test';

test('188 checksum, reachability, revision and rollback remain separate', async ({page}) => {
  await page.goto('/#lesson/188', {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('security-lab-188');
  await expect(lab).toBeVisible();
  const step = lab.locator('[data-security-action="step"]');
  await expect(step).toBeDisabled();
  await lab.getByLabel('预测漏洞判断').selectOption('reachable');
  await lab.getByLabel('预测理由').fill('生产标签开启并保留调用边');
  await step.click();
  await expect(lab).toContainText('只证明内容与预期一致');
  await step.click();
  await step.click();
  await expect(lab).toContainText('停止交付：存在明确阻断证据');
  await lab.getByLabel('保留 adapter → Decode 调用边').uncheck();
  await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', /"phase":0/);
  await lab.getByLabel('预测漏洞判断').selectOption('unreachable');
  await lab.getByLabel('预测理由').fill('切断所建模的调用路径');
  await step.click(); await step.click();
  await expect(lab).toContainText('E2 暴露判断：已知漏洞在当前构建不可达');
  await lab.locator('[data-security-action="back"]').click();
  await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', /"phase":1/);
  await lab.locator('[data-security-action="reset"]').click();
  await expect(lab.getByLabel('保留 adapter → Decode 调用边')).toBeChecked();
  await expect(lab.getByLabel('预测理由')).toHaveValue('');
});

test('188 small screen has no horizontal overflow and keyboard controls work', async ({page}) => {
  await page.setViewportSize({width: 320, height: 800});
  await page.goto('/#lesson/188', {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('security-lab-188');
  const edge = lab.getByLabel('保留 adapter → Decode 调用边');
  await edge.focus(); await page.keyboard.press('Space');
  await expect(edge).not.toBeChecked();
  expect(await lab.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('188 four help modes change models and require an explained transfer prediction', async ({page}) => {
  await page.goto('/#lesson/188', {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  await page.getByRole('button', {name: '举例子', exact: true}).click();
  let help = page.getByTestId('security-help-188');
  await expect(help).toContainText('反例成立');
  await help.getByLabel('此批次有召回公告').uncheck();
  await expect(help).toContainText('未知缺陷不存在');
  await page.getByRole('button', {name: '画图', exact: true}).click();
  help = page.getByTestId('security-help-188');
  await help.getByLabel('连接 adapter → Decode').uncheck();
  await expect(help).toContainText('已知漏洞在当前构建不可达');
  await page.getByRole('button', {name: '拆步骤', exact: true}).click();
  help = page.getByTestId('security-help-188');
  for (let i = 0; i < 3; i++) await help.getByRole('button', {name: '收集下一项证据'}).click();
  await expect(help).toContainText('可进入受控发布评审');
  await help.getByRole('button', {name: '撤回上一项证据'}).click();
  await expect(help).toContainText('暂缓交付');
  await page.getByRole('button', {name: '让我试试', exact: true}).click();
  help = page.getByTestId('security-help-188');
  await expect(help.getByRole('button', {name: '验证新情境预测'})).toBeDisabled();
  await help.getByLabel('预测漏洞判断').selectOption('unknown');
  await help.getByLabel('预测理由').fill('生产配置与分析配置不一致');
  await help.getByRole('button', {name: '验证新情境预测'}).click();
  await expect(help).toContainText('判断与证据一致');
  await expect(help).toContainText('按生产标签重做分析');
});
