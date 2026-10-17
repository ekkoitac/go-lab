import { test, expect, type Page } from '@playwright/test';
import type { Snapshot } from '../../src/components/bounded-lab/model';

test.setTimeout(90000);
async function open(page: Page) {
  await page.goto('/#lesson/121', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '动手观察', exact: true }).click();
  const lab = page.getByTestId('bounded-lab');
  await expect(lab).toBeVisible();
  const click = (name: string) => lab.getByRole('button', { name, exact: true }).click();
  const stage = (name: string) => lab.getByRole('navigation', { name: '并发实验阶段' }).getByRole('button', { name: new RegExp(name) }).click();
  const state = async () => JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!) as Snapshot;
  return { lab, click, stage, state };
}

test('same clock, real task transitions, rewind, playback pause and reset', async ({ page }) => {
  const { lab, click, state } = await open(page);
  const direct = lab.getByTestId('board-direct'), workers = lab.getByTestId('board-workers');
  await click('提交这一批');
  await expect(direct).toContainText('超过预算 6 项');
  await expect(direct.getByTestId('lane-running').getByRole('button')).toHaveCount(8);
  await expect(workers.getByTestId('lane-running').getByRole('button')).toHaveCount(2);
  await expect(workers.getByTestId('lane-queue').getByRole('button')).toHaveCount(6);
  const submitted = await state();
  await click('下一时间步'); await click('下一时间步');
  expect((await state()).time).toBe(2);
  await expect(direct.getByTestId('lane-done').getByRole('button')).toHaveCount(8);
  await expect(workers.getByTestId('lane-running')).toContainText('T3');
  await lab.getByRole('slider', { name: '实验历史' }).fill('1');
  expect(await state()).toEqual(submitted);
  await click('播放'); await expect.poll(async () => (await state()).time).toBeGreaterThan(0);
  await click('暂停'); const paused = await state();
  await page.waitForTimeout(1100); expect(await state()).toEqual(paused);
  await click('重置本轮'); expect((await state()).submitted).toBe(false);
  await expect(lab.getByRole('slider', { name: '实验历史' })).toHaveValue('0');
});

test('predictions, selected task, code and event evidence stay linked', async ({ page }) => {
  const { lab, click, stage } = await open(page);
  await stage('验证误解');
  await lab.getByRole('spinbutton', { name: 'goroutine 内获取许可预测执行峰值', exact: true }).fill('2');
  await lab.getByRole('spinbutton', { name: 'goroutine 内获取许可预测工作 goroutine 峰值', exact: true }).fill('2');
  await lab.getByRole('spinbutton', { name: '固定 worker + 有界队列预测执行峰值', exact: true }).fill('2');
  await lab.getByRole('spinbutton', { name: '固定 worker + 有界队列预测工作 goroutine 峰值', exact: true }).fill('2');
  await click('提交这一批');
  const sem = lab.getByTestId('board-semaphore'), workers = lab.getByTestId('board-workers');
  await sem.getByRole('button', { name: '查看 T3：等待许可', exact: true }).click();
  await expect(sem.getByTestId('task-inspector')).toContainText('G3 已存在');
  await expect(workers.getByTestId('task-inspector')).toContainText('排队任务没有各自的 goroutine');
  await sem.locator('.bounded-code summary').click();
  await expect(sem.locator('.is-current')).toContainText('sem <- struct{}{}');
  await sem.locator('.bounded-events summary').click();
  await expect(sem.locator('.bounded-events')).toContainText('已创建 G3');
  await click('运行到结束');
  await expect(lab.locator('.bounded-predictions')).toContainText('预测有差异');
  await expect(lab.locator('.bounded-predictions')).toContainText('预测吻合');
  await expect(sem.getByTestId('metric-工作 G 峰值')).toHaveText('8');
  await expect(workers.getByTestId('metric-工作 G 峰值')).toHaveText('2');
});

test('queue capacity changes admission, zero buffer and reset stop playback', async ({ page }) => {
  const { lab, click, stage, state } = await open(page);
  await stage('缩小队列');
  await lab.getByRole('slider', { name: '等待队列容量' }).fill('2');
  await click('提交这一批');
  const board = lab.getByTestId('board-workers');
  await expect(board.getByTestId('lane-running').getByRole('button')).toHaveCount(2);
  await expect(board.getByTestId('lane-queue').getByRole('button')).toHaveCount(2);
  await expect(board.getByTestId('lane-source').getByRole('button')).toHaveCount(4);
  await click('播放');
  await lab.getByRole('slider', { name: '等待队列容量' }).fill('0');
  await expect(lab.getByRole('button', { name: '播放', exact: true })).toBeDisabled();
  expect((await state()).submitted).toBe(false);
  await click('提交这一批');
  await expect(board.getByTestId('lane-queue')).toContainText('无缓冲槽位');
  await expect(board.getByTestId('lane-queue').getByRole('button')).toHaveCount(0);
  await expect(board.getByTestId('lane-source').getByRole('button')).toHaveCount(6);
});

test('challenge diagnoses earliest failure, repairs and verifies sixteen tasks without grading', async ({ page }) => {
  const { lab, click, stage, state } = await open(page);
  const gradeWrites: string[] = [];
  page.on('request', req => { if (req.method() === 'POST' && /\/(attempt|help)/.test(req.url())) gradeWrites.push(req.url()); });
  await stage('修复与复验'); await click('运行到结束');
  const results = lab.getByTestId('challenge-results');
  await expect(results).toContainText('仍有资源超限');
  await click('定位首次超限：工作 goroutine 峰值 ≤ 2');
  expect((await state()).time).toBe(0); expect((await state()).submitted).toBe(true);
  await lab.getByRole('combobox', { name: '执行策略' }).selectOption('workers');
  await lab.getByRole('slider', { name: '等待队列容量' }).fill('2');
  await click('运行到结束');
  await expect(results).toContainText('全部约束通过');
  await expect(results).toContainText('4 轮执行');
  await click('保持配置，增加到 16 项复验');
  await click('运行到结束');
  await expect(results).toContainText('16 项复验也通过');
  await expect(results).toContainText('8 轮执行');
  expect(gradeWrites).toEqual([]);
  await lab.getByRole('slider', { name: '执行额度与 worker 数' }).fill('1');
  await click('运行到结束');
  await expect(results).toContainText('全部约束通过');
  await expect(results).toContainText('8 轮执行');
});

test('desktop and mobile are readable with reduced motion, keyboard controls and no console errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { lab, click, stage } = await open(page);
  await click('提交这一批');
  await page.screenshot({ path: 'test-results/bounded-desktop.png', fullPage: true });
  await lab.locator('.bounded-boards').screenshot({ path: 'test-results/bounded-desktop-boards.png' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const boxes = await lab.locator('.bounded-board').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
    expect(boxes[0].right <= boxes[1].x + 1 || boxes[0].bottom <= boxes[1].y + 1).toBeTruthy();
    const tokens = lab.locator('.bounded-tokens button');
    expect(await tokens.evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1))).toBeTruthy();
  }
  await lab.getByRole('button', { name: '回退一步', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(lab.getByRole('button', { name: '提交这一批', exact: true })).toBeEnabled();
  await stage('缩小队列'); await lab.getByRole('slider', { name: '等待队列容量' }).fill('2'); await click('提交这一批');
  await page.screenshot({ path: 'test-results/bounded-mobile.png', fullPage: true });
  await lab.getByTestId('board-workers').screenshot({ path: 'test-results/bounded-mobile-board.png' });
  expect(await lab.locator('.bounded-tokens button').first().evaluate(n => getComputedStyle(n).animationName)).toBe('none');
  expect(errors).toEqual([]);
});
