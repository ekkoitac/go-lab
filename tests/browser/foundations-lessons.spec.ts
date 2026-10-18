import {test, expect, type Page, type Locator} from '@playwright/test';

const helpModes = [
  ['举例子', 'example'], ['画图', 'diagram'], ['拆步骤', 'steps'], ['让我试试', 'try'],
] as const;
async function openLesson(page: Page, id: number) {
  await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.locator('.learning-column').getByTestId(`foundations-lab-${id}`);
  await expect(lab).toBeVisible();
  return lab;
}
async function textContrast(root: Locator) {
  return root.evaluate(element => {
    const rgb = (text: string) => (text.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    let current: Element | null = element;
    let background = [255, 255, 255];
    while (current) {
      const color = getComputedStyle(current).backgroundColor;
      if (color !== 'transparent' && !color.endsWith(', 0)')) { background = rgb(color); break; }
      current = current.parentElement;
    }
    const luminance = (color: number[]) => color.map(value => { const x = value / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const foreground = luminance(rgb(getComputedStyle(element).color)), back = luminance(background);
    return (Math.max(foreground, back) + .05) / (Math.min(foreground, back) + .05);
  });
}
for (let id = 1; id <= 10; id++) {
  test(`foundations ${id}: four distinct help tasks preserve observation and assessment`, async ({page}) => {
    const errors: string[] = [], assessmentWrites: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.method() === 'POST' && /\/api\/progress\/\d+\/(attempt|reveal)/.test(request.url())) assessmentWrites.push(request.url());
    });
    const lab = await openLesson(page, id);
    expect(await textContrast(lab), 'lesson body text contrast').toBeGreaterThanOrEqual(4.5);
    const model = lab.getByTestId('live-model').first();
    const state = await model.getAttribute('data-state');
    expect(state).toBeTruthy();
    const views: string[] = [];
    for (const [name, mode] of helpModes) {
      await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
      const help = page.locator(`[data-help-mode="${mode}"]`).getByTestId(`foundations-help-${id}`);
      await expect(help).toBeVisible();
      expect(await textContrast(help), 'help body text contrast').toBeGreaterThanOrEqual(4.5);
      views.push(await help.innerText());
      await expect(help.getByTestId(`foundations-lab-${id}`)).toHaveCount(0);
      expect(await help.locator('button,input,select,textarea').count(), `lesson ${id} ${mode} needs an operation`).toBeGreaterThan(0);
      await expect(model).toHaveAttribute('data-state', state!);
    }
    expect(new Set(views).size).toBe(4);
    expect(assessmentWrites).toEqual([]);
    expect(errors).toEqual([]);
  });
  test(`foundations ${id}: narrow screens and reduced motion keep all controls reachable`, async ({page}, info) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    for (const width of [390, 320]) {
      await page.setViewportSize({width, height: 844});
      const lab = await openLesson(page, id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id} ${width} page`).toBe(true);
      expect(await lab.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${id} ${width} lab`).toBe(true);
      for (const [name, mode] of helpModes) {
        await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
        const help = page.locator(`[data-help-mode="${mode}"]`).getByTestId(`foundations-help-${id}`);
        await expect(help).toBeVisible();
        expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${id} ${width} ${mode}`).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id} ${width} ${mode} page`).toBe(true);
      }
      if (width === 390 && [1, 6, 10].includes(id)) await lab.screenshot({path: info.outputPath(`lesson-${id}-mobile.png`)});
    }
  });
}
