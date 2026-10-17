import {test, expect, type Page} from '@playwright/test';
async function open(page: Page) {await page.goto('/#lesson/190', {waitUntil: 'domcontentloaded'}); await page.getByRole('button', {name: '动手观察', exact: true}).click(); return page.getByTestId('security-lab-190');}
test('190 prediction, structured injection, permissions and rewind', async ({page}) => {
  const lab = await open(page); const next = lab.locator('[data-security-action="step"]');
  await expect(next).toBeDisabled();
  await lab.getByRole('button', {name: '放入换行伪造事件样本'}).click();
  await lab.getByLabel('预测业务结果').selectOption('completed'); await lab.getByLabel('预测理由').fill('授权通过并且实际完成后保存');
  for (let i = 0; i < 4; i++) await next.click();
  const json = await lab.getByTestId('audit-json').textContent();
  const events = json!.split('\n').map(line => JSON.parse(line));
  expect(events).toHaveLength(2); expect(events[0].actor).toBe('trusted:admin-7'); expect(events[0].note).toContain('\n');
  await lab.getByLabel('查询角色').selectOption('operator'); await expect(lab.getByTestId('audit-json')).toHaveCount(0); await expect(lab).toContainText('读取拒绝');
  await lab.getByLabel('查询角色').selectOption('investigator'); await expect(lab.getByTestId('audit-json')).toBeVisible();
  await lab.getByLabel('仍在规定保留期内').uncheck(); await expect(lab.getByTestId('audit-json')).toHaveCount(0);
  await lab.locator('[data-security-action="back"]').click(); await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', /"phase":3/);
  await lab.locator('[data-security-action="reset"]').click(); await expect(lab.getByLabel('预测理由')).toHaveValue('');
});
test('190 post-completion save failure retains actual business outcome', async ({page}) => {
  const lab = await open(page); await lab.getByLabel('审计保存故障').selectOption('after'); await lab.getByLabel('预测业务结果').selectOption('completed'); await lab.getByLabel('预测理由').fill('业务先完成，保存失败无法撤销');
  for (let i = 0; i < 4; i++) await lab.locator('[data-security-action="step"]').click();
  await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', /"outcome":"completed"/);
  await expect(lab).toContainText('缺证 completed'); expect((await lab.getByTestId('audit-json').textContent())!.split('\n')).toHaveLength(1);
});
test('190 all help modes manipulate evidence and transfer predictions', async ({page}) => {
  await open(page);
  const help = page.getByTestId('security-help-190');
  for (const [name, heading] of [['举例子', '借阅登记簿'], ['画图', '断开关联边'], ['拆步骤', '单步追踪'], ['让我试试', '迁移练习']]) {
    const button = page.getByRole('button', {name, exact: true}); await button.click(); await expect(button).toHaveClass(/selected/); await expect(help).toContainText(heading);
    if (name === '举例子') {await help.getByLabel('登记可信借阅证编号').check(); await help.getByLabel('夹入身份证复印件占位卡').uncheck(); await expect(help).toContainText('已移除多余敏感材料');}
    if (name === '画图') {await help.getByLabel('用 correlationId 连接请求和完成').uncheck(); await expect(help).toContainText('无可靠连接');}
    if (name === '拆步骤') {for (let i = 0; i < 3; i++) await help.getByRole('button', {name: '推进一个时刻'}).click(); await expect(help).toContainText('不得伪装回滚');}
    if (name === '让我试试') {await expect(help.getByRole('button', {name: '验证迁移预测'})).toBeDisabled(); await help.getByLabel('预测业务结果').selectOption('completed'); await help.getByLabel('预测理由').fill('资金先转出，后续失败仅影响完成证据'); await help.getByRole('button', {name: '验证迁移预测'}).click(); await expect(help).toContainText('预测一致');}
  }
});
test('190 fits 320px and supports keyboard checkbox interaction', async ({page}) => {
  await page.setViewportSize({width: 320, height: 800}); const lab = await open(page); const checkbox = lab.getByLabel('保留可信 actor 字段'); await checkbox.focus(); await page.keyboard.press('Space'); await expect(checkbox).not.toBeChecked(); expect(await lab.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
});
