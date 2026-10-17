import { test, expect, type Locator } from '@playwright/test';
async function tick(root: Locator, count = 1) { for (let i = 0; i < count; i++) await root.locator('[data-arch-action=step]').click(); }
for (const width of [1440, 390]) test('119 visible flow control, cancellation and expiry ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const attempts: string[] = []; page.on('request', r => { if (r.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(r.url())) attempts.push(r.url()); });
  await page.goto('/#lesson/119'); await page.getByRole('button', { name: '动手观察', exact: true }).click();
  const lab = page.locator('.learning-column').getByTestId('architecture-lab-119');
  await tick(lab); await expect(lab.getByTestId('stream-queue')).toContainText('#3');
  await tick(lab); await expect(lab.getByTestId('stream-status')).toHaveText('已断开'); await expect(lab.getByTestId('stream-queue')).toContainText('占用 0');
  await lab.getByRole('button', { name: '按游标新建订阅' }).click(); await expect(lab.getByTestId('stream-queue')).toContainText('#2');
  await lab.locator('[data-arch-action=reset]').click();
  await lab.getByLabel('策略', { exact: true }).selectOption('backpressure'); await lab.getByRole('button', { name: '暂停读取', exact: true }).click(); await tick(lab, 3);
  await expect(lab.getByTestId('stream-queue')).toContainText('占用 4 / 4'); await expect(lab.getByTestId('stream-status')).toHaveText('订阅中');
  await lab.getByRole('button', { name: '恢复读取', exact: true }).click(); await tick(lab); await expect(lab.getByTestId('stream-client')).toContainText('#1');
  await lab.getByRole('button', { name: '取消订阅', exact: true }).click(); await tick(lab); await expect(lab.getByTestId('stream-status')).toHaveText('已取消'); await expect(lab.locator('.arch119-metrics')).toContainText('订阅生产任务 0');
  await lab.locator('[data-arch-action=reset]').click(); await tick(lab); await lab.getByRole('button', { name: '主动断开', exact: true }).click(); await tick(lab, 5); await lab.getByRole('button', { name: '按游标新建订阅' }).click(); await expect(lab.getByTestId('stream-gap')).toContainText('#1～#6');
  await lab.getByRole('button', { name: '接受跳过，改从最新位置订阅' }).click(); await expect(lab).toContainText('明确接受的跳过范围：#1～#18');
  const saved = await lab.getByTestId('live-model').getAttribute('data-state');
  const notebook = page.getByRole('textbox', { name: '架构决策记录' }), note = await notebook.inputValue();
  for (const mode of ['举例子', '画图', '拆步骤', '让我试试']) {
    await page.locator('.help-panel').getByRole('button', { name: mode, exact: true }).click(); const help = page.getByTestId('architecture-help-119'); await expect(help).toBeVisible();
    if (mode === '举例子') { await help.getByRole('button', { name: '暂停读取', exact: true }).click(); await tick(help, 3); await expect(help.getByTestId('stream-queue')).toContainText('占用 3 / 3'); await help.getByLabel('策略', { exact: true }).selectOption('unbounded'); await tick(help); await expect(help.getByTestId('stream-queue')).toContainText('占用 5 / 无上限'); }
    if (mode === '画图') { await help.getByLabel('对照策略').selectOption('unbounded'); await expect(help.getByTestId('stream-queue')).toContainText('占用 6 / 无上限'); await help.getByRole('button', { name: '全局可重放日志', exact: true }).click(); await expect(help.getByTestId('stream-log')).toHaveClass(/arch119-selected/); await help.getByLabel('对照策略').selectOption('backpressure'); await expect(help.getByTestId('stream-queue')).toContainText('占用 4 / 4'); }
    if (mode === '拆步骤') { await tick(help, 2); await expect(help.getByTestId('stream-status')).toHaveText('已断开'); await help.locator('[data-arch-action=back]').click(); await expect(help.getByTestId('stream-status')).toHaveText('订阅中'); await help.locator('[data-arch-action=reset]').click(); await expect(help.getByTestId('stream-log')).toContainText('本步新增 0'); }
    if (mode === '让我试试') { await expect(help.getByTestId('challenge-feedback')).toHaveCount(0); await help.getByLabel('你的判断').selectOption('1'); await help.getByLabel('判断理由').fill('上游能安全减速'); await help.getByRole('button', { name: '提交并看反馈' }).click(); await expect(help.getByTestId('challenge-feedback')).toContainText('选择符合约束'); await help.getByRole('button', { name: '换一个情境' }).click(); await expect(help.getByTestId('challenge-feedback')).toHaveCount(0); await help.getByLabel('你的判断').selectOption('1'); await help.getByLabel('判断理由').fill('保留期不能由游标突破'); await help.getByRole('button', { name: '提交并看反馈' }).click(); await expect(help.getByTestId('challenge-feedback')).toContainText('选择符合约束'); }
    await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', saved!); await expect(notebook).toHaveValue(note);
    expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); expect(attempts).toEqual([]);
});

