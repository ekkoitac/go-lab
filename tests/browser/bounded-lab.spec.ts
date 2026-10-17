import { test, expect, type Page } from '@playwright/test';
import type { Config, Frame } from '../../src/components/concurrency-lab/lesson121/model';

test.setTimeout(90000);
async function open(page: Page) {
  await page.goto('/#lesson/121', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '动手观察', exact: true }).click();
  const lab = page.getByTestId('concurrency-lab-121');
  await expect(lab).toBeVisible();
  const state = async () => JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!) as { config: Config; frame: Frame };
  const predict = async (active = '2', goroutines = '8') => {
    await lab.getByLabel('预测执行数', { exact: true }).selectOption(active);
    await lab.getByLabel('预测工作G数', { exact: true }).selectOption(goroutines);
  };
  const step = () => lab.locator('[data-concurrency-action=step]').click();
  return { lab, state, predict, step };
}

test('prediction gates reveal; same input exposes three different resource allocations', async ({ page }) => {
  const { lab, state, predict, step } = await open(page);
  await expect(lab.locator('[data-concurrency-action=step]')).toBeDisabled();
  await predict('2', '2'); await step();
  await expect(lab.locator('.c121-feedback')).toContainText('首次实际：执行 2 / G 8');
  const [direct, inside, workers] = (await state()).frame.boards;
  expect(direct.tasks.filter(t => t.place === 'active')).toHaveLength(8);
  expect(inside.tasks.filter(t => t.place === 'waiting')).toHaveLength(6);
  expect(workers.tasks.filter(t => t.place === 'active')).toHaveLength(2);
  expect(workers.tasks.filter(t => t.place === 'queue')).toHaveLength(2);
  expect(workers.tasks.filter(t => t.place === 'source')).toHaveLength(4);
  await lab.getByRole('button', { name: '先启动，再等许可 T3：G 等待许可', exact: true }).click();
  await expect(lab.locator('.c121-trace')).toContainText('T3');
  await expect(lab.locator('.c121-trace')).toContainText('固定 worker + 有界队列 → 已接纳的队列');
  await expect(lab.locator('.c121-tasks button[aria-pressed=true]')).toHaveCount(3);
});

test('reversible steps and playback pause preserve snapshots; reset removes predictions', async ({ page }) => {
  const { lab, state, predict, step } = await open(page);
  const original = await state(); await predict(); await step(); const first = await state();
  await step(); await lab.locator('[data-concurrency-action=back]').click(); expect(await state()).toEqual(first);
  await lab.getByRole('button', { name: '播放', exact: true }).click();
  await expect.poll(async () => (await state()).frame.round).toBeGreaterThan(1);
  await lab.getByRole('button', { name: '暂停', exact: true }).click(); const paused = await state();
  await page.waitForTimeout(1100); expect(await state()).toEqual(paused);
  await lab.locator('[data-concurrency-action=reset]').click(); expect(await state()).toEqual(original);
  await expect(lab.getByLabel('预测执行数', { exact: true })).toHaveValue('');
});

test('zero buffer retains six source tasks; zero workers stalls and can be repaired', async ({ page }) => {
  const { lab, state, predict, step } = await open(page);
  await lab.getByRole('button', { name: '零缓冲队列', exact: true }).click(); await predict(); await step();
  let workers = (await state()).frame.boards[2];
  expect(workers.tasks.filter(t => t.place === 'queue')).toHaveLength(0);
  expect(workers.tasks.filter(t => t.place === 'source')).toHaveLength(6);
  await lab.getByRole('button', { name: '运行到结束', exact: true }).click();
  expect((await state()).frame.boards.every(b => b.tasks.every(t => t.place === 'done'))).toBe(true);
  await lab.getByRole('button', { name: '零额度会怎样', exact: true }).click(); await predict('0'); await step();
  await lab.getByRole('button', { name: '运行到结束', exact: true }).click();
  await expect(lab.locator('[data-strategy=workers]')).toContainText('额度为 0');
  await expect(lab.locator('[data-concurrency-action=step]')).toBeDisabled();
  await lab.getByRole('slider', { name: 'worker / 许可额度', exact: true }).fill('2'); await predict();
  await lab.getByRole('button', { name: '运行到结束', exact: true }).click();
  workers = (await state()).frame.boards[2]; expect(workers.tasks.filter(t => t.place === 'done')).toHaveLength(8);
});

test('independent help challenge diagnoses G limit and repairs without changing observation', async ({ page }) => {
  const { state } = await open(page); const original = await state();
  await page.locator('.help-panel').getByRole('button', { name: '让我试试', exact: true }).click();
  const help = page.getByTestId('concurrency-help-121');
  const writes: string[] = [];
  page.on('request', req => { if (req.method() === 'POST' && /\/progress\//.test(req.url())) writes.push(req.url()); });
  await help.getByRole('button', { name: '运行并核对约束', exact: true }).click();
  await expect(help.getByRole('status')).toContainText('G 峰值 7/2');
  await help.getByRole('combobox', { name: '提交策略', exact: true }).selectOption('workers');
  await help.getByRole('button', { name: '运行并核对约束', exact: true }).click();
  await expect(help.getByRole('status')).toContainText('本次配置满足三个约束');
  expect(await state()).toEqual(original); expect(writes).toEqual([]);
});

test('mobile and desktop keep visible task controls readable with keyboard and reduced motion', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { lab, predict, step } = await open(page); await predict(); await step();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await lab.evaluate(n => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
    expect(await lab.locator('.c121-tasks button').evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1))).toBe(true);
    await lab.screenshot({ path: `.runtime/concurrency-labs/bounded-${width}.png`, animations: 'disabled' });
  }
  await lab.locator('[data-concurrency-action=back]').focus(); await page.keyboard.press('Enter');
  await expect(lab.locator('[data-concurrency-action=step]')).toBeEnabled();
  expect(errors).toEqual([]);
});

