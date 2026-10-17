import { test, expect, type Locator } from '@playwright/test';
async function finish(lab: Locator) { for (let i = 0; i < 3; i++) await lab.locator('[data-arch-action=step]').click(); }
for (const width of [1440, 390]) test('113 PATCH visible semantics and isolated help ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const attempts: string[] = []; page.on('request', r => { if (r.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(r.url())) attempts.push(r.url()); });
  await page.goto('/#lesson/113'); await page.getByRole('button', { name: '动手观察', exact: true }).click();
  const lab = page.locator('.learning-column').getByTestId('architecture-lab-113');
  await expect(lab.getByTestId('patch-zero')).toContainText('等待解码');
  await finish(lab); await expect(lab.getByTestId('patch-zero')).toContainText('意图不符'); await expect(lab.getByTestId('patch-presence')).toContainText('保留旧值');
  await lab.getByRole('button', { name: '显式 null', exact: true }).click(); await finish(lab);
  await expect(lab.getByTestId('patch-pointer')).toContainText('意图不符'); await expect(lab.getByTestId('patch-presence')).toContainText('显式清空');
  await lab.getByRole('button', { name: '错误类型', exact: true }).click(); await finish(lab); await expect(lab.getByTestId('patch-presence')).toContainText('拒绝更新'); await expect(lab.getByTestId('patch-presence')).toContainText('"Ada"');
  const saved = await lab.getByTestId('live-model').getAttribute('data-state');
  const note = await page.locator('.cm-content').innerText();
  for (const mode of ['举例子', '画图', '拆步骤', '让我试试']) {
    await page.locator('.help-panel').getByRole('button', { name: mode, exact: true }).click(); const help = page.getByTestId('architecture-help-113'); await expect(help).toBeVisible();
    if (mode === '举例子') { await finish(help); await expect(help.getByTestId('patch-pointer')).toContainText('周末读书会'); await help.getByRole('button', { name: '字段缺失', exact: true }).click(); await finish(help); await expect(help.getByTestId('patch-presence')).toContainText('保留旧值'); }
    if (mode === '画图') { await help.getByLabel('图中的请求').selectOption('{"name":null}'); await help.getByRole('button', { name: '指针 *string', exact: true }).click(); await expect(help.locator('.arch113-path')).toContainText('name = nil'); await expect(help.locator('.arch113-path')).toContainText('保留旧值'); }
    if (mode === '拆步骤') { await finish(help); await expect(help.getByTestId('patch-presence')).toContainText('设置字符串'); await help.locator('[data-arch-action=back]').click(); await expect(help.getByTestId('patch-presence')).toContainText('"Ada"'); await help.locator('[data-arch-action=reset]').click(); await expect(help.getByTestId('patch-presence')).toContainText('等待解码'); }
    if (mode === '让我试试') { await expect(help.getByTestId('challenge-feedback')).toHaveCount(0); await help.getByLabel('你的判断').selectOption('keep'); await help.getByLabel('判断理由').fill('键没有提供，应保留'); await help.getByRole('button', { name: '提交并看反馈' }).click(); await expect(help.getByTestId('challenge-feedback')).toContainText('操作判断正确'); await help.getByRole('button', { name: '换一个情境' }).click(); await expect(help.getByTestId('challenge-feedback')).toHaveCount(0); await help.getByLabel('你的判断').selectOption('clear'); await help.getByLabel('判断理由').fill('null 明确清空'); await help.getByRole('button', { name: '提交并看反馈' }).click(); await expect(help.getByTestId('challenge-feedback')).toContainText('操作判断正确'); }
    expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', saved!); expect(await page.locator('.cm-content').innerText()).toBe(note);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); expect(attempts).toEqual([]);
});

