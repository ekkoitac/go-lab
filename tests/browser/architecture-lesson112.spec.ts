import { test, expect, type Locator } from '@playwright/test';
async function run(root: Locator) { for (let i = 0; i < 3; i++) await root.locator('[data-arch-action=step]').click(); }
for (const width of [1440, 390]) test(`112 DTO field routes, independent help and transfer at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const attempts: string[] = []; page.on('request', req => { if (req.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(req.url())) attempts.push(req.url()); });
  await page.goto('/#lesson/112'); await page.getByRole('button', { name: '动手观察', exact: true }).click();
  const lab = page.getByTestId('architecture-lab-112');
  await lab.getByLabel('新增内部风控字段').check(); await lab.getByLabel('预测结果').selectOption('fail'); await lab.getByLabel('预测理由').fill('直接编码会带出新字段');
  await run(lab); await expect(lab.getByTestId('dto-response')).toContainText('riskScore'); await expect(lab.getByTestId('dto-contract')).toContainText('失败');
  await lab.getByLabel('编码方式').selectOption('dto'); await expect(lab.getByTestId('dto-response')).toContainText('尚未编码'); await run(lab); await expect(lab.getByTestId('dto-response')).not.toContainText('riskScore'); await expect(lab.getByTestId('dto-contract')).toContainText('通过');
  await lab.getByLabel('映射 riskScore', { exact: true }).check(); await run(lab); await expect(lab.getByTestId('dto-contract')).toContainText('失败');
  const before = await lab.getByTestId('live-model').getAttribute('data-state');
  const notebook = await page.getByRole('textbox', { name: '架构决策记录' }).inputValue();
  async function help(mode: string) { await page.locator('.help-panel').getByRole('button', { name: mode, exact: true }).click(); return page.getByTestId('architecture-help-112'); }
  let panel = await help('举例子'); await panel.getByLabel('把 supplierCost 加入商品 DTO').check(); await expect(panel.getByTestId('example-response')).toContainText('supplierCost');
  panel = await help('画图'); await panel.getByLabel('连接 riskScore 到公开映射').check(); await panel.getByRole('button', { name: /riskScore:/ }).click(); await expect(panel.locator('[data-field=riskScore]')).toHaveAttribute('data-routed', 'true'); await expect(panel.getByTestId('dto-response')).toContainText('riskScore');
  panel = await help('拆步骤'); await run(panel); await expect(panel.getByTestId('dto-contract')).toContainText('失败'); await panel.locator('[data-arch-action=back]').click(); await expect(panel.getByTestId('dto-contract')).toContainText('尚未检查'); await panel.getByLabel('修复路径').selectOption('dto'); await run(panel); await expect(panel.getByTestId('dto-contract')).toContainText('通过'); await panel.locator('[data-arch-action=reset]').click(); await expect(panel.getByTestId('dto-response')).toContainText('尚未编码');
  panel = await help('让我试试'); await expect(panel.getByTestId('challenge-feedback')).toHaveCount(0); await expect(panel.getByRole('button', { name: '提交判断并揭晓' })).toBeDisabled(); await panel.getByLabel('你的修复方案').selectOption('remove'); await panel.getByLabel('判断理由').fill('内部备注不属于公开契约'); await panel.getByRole('button', { name: '提交判断并揭晓' }).click(); await expect(panel.getByTestId('challenge-feedback')).toContainText('方案符合当前契约'); await panel.getByRole('button', { name: '换一个情境' }).click(); await expect(panel.getByTestId('challenge-feedback')).toHaveCount(0); await panel.getByLabel('你的修复方案').selectOption('restore'); await panel.getByLabel('判断理由').fill('status 是原契约要求的字段'); await panel.getByRole('button', { name: '提交判断并揭晓' }).click(); await expect(panel.getByTestId('challenge-feedback')).toContainText('status 丢失');
  await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', before!); await expect(page.getByRole('textbox', { name: '架构决策记录' })).toHaveValue(notebook); expect(attempts).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
