import { test, expect, type Locator } from '@playwright/test';
async function read(root: Locator) { await root.locator('[data-arch-action=step]').click(); }
for (const width of [1440, 390]) test('116 pagination drift and help isolation ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const attempts: string[] = []; page.on('request', r => { if (r.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(r.url())) attempts.push(r.url()); });
  await page.goto('/#lesson/116'); await page.getByRole('button', { name: '动手观察', exact: true }).click();
  const lab = page.locator('.learning-column').getByTestId('architecture-lab-116');
  const start = await lab.getByTestId('live-model').getAttribute('data-state');
  await read(lab); await expect(lab.getByTestId('pagination-key')).toContainText('ID 1');
  await lab.getByRole('button', { name: '前方补入记录', exact: true }).click();
  await expect(lab.getByTestId('pagination-offset')).toContainText('下次从位置 2');
  await read(lab); await expect(lab.getByTestId('pagination-offset').locator('.arch116-duplicate')).toHaveCount(2);
  await expect(lab.getByTestId('pagination-key').locator('li').nth(1)).toContainText('ID 3');
  await lab.locator('[data-arch-action=reset]').click(); await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', start!);
  await read(lab); await lab.getByRole('button', { name: '删除最前记录', exact: true }).click(); await read(lab);
  await expect(lab.getByTestId('skipped-offset')).toHaveText('3'); await expect(lab.getByTestId('skipped-key')).toHaveText('无');
  await lab.locator('[data-arch-action=reset]').click(); await read(lab); await lab.getByRole('button', { name: '后方追加记录', exact: true }).click(); await read(lab); await read(lab); await read(lab);
  await expect(lab.getByTestId('pagination-key').locator('li').last()).toContainText('ID 7');
  const saved = await lab.getByTestId('live-model').getAttribute('data-state');
  const code = await page.locator('.cm-content').innerText();
  for (const mode of ['举例子', '画图', '拆步骤', '让我试试']) {
    await page.locator('.help-panel').getByRole('button', { name: mode, exact: true }).click();
    const help = page.getByTestId('architecture-help-116'); await expect(help).toBeVisible();
    if (mode === '举例子') { await read(help); await help.getByRole('button', { name: '删除最前记录', exact: true }).click(); await read(help); await expect(help.getByTestId('skipped-offset')).toHaveText('30'); }
    if (mode === '画图') { await help.getByLabel('第一页之后的变化').selectOption('delete'); await help.locator('.arch116-records').getByRole('button', { name: /ID 3 / }).click(); await expect(help.locator('.arch116-trace')).toContainText('当前位置 1'); await expect(help.getByTestId('pagination-key').locator('.arch116-selected')).toContainText('ID 3'); }
    if (mode === '拆步骤') { await read(help); await read(help); await read(help); await expect(help.getByTestId('pagination-offset').locator('.arch116-duplicate')).toHaveCount(2); await help.locator('[data-arch-action=back]').click(); await expect(help.getByTestId('pagination-offset').locator('li')).toHaveCount(1); await help.locator('[data-arch-action=reset]').click(); await expect(help.getByTestId('pagination-key')).toContainText('尚未读取'); }
    if (mode === '让我试试') { await expect(help.getByTestId('challenge-feedback')).toHaveCount(0); await help.getByLabel('你的判断').selectOption('0'); await help.getByLabel('判断理由').fill('位置左移，但 ID 稳定'); await help.getByRole('button', { name: '提交并看反馈' }).click(); await expect(help.getByTestId('challenge-feedback')).toContainText('判断符合模型'); await help.getByRole('button', { name: '换一个情境' }).click(); await expect(help.getByTestId('challenge-feedback')).toHaveCount(0); await help.getByLabel('你的判断').selectOption('1'); await help.getByLabel('判断理由').fill('实时游标不是快照'); await help.getByRole('button', { name: '提交并看反馈' }).click(); await expect(help.getByTestId('challenge-feedback')).toContainText('判断符合模型'); }
    await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', saved!); await expect(page.locator('.cm-content')).toHaveText(code, {useInnerText: true});
    expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); expect(attempts).toEqual([]);
});

