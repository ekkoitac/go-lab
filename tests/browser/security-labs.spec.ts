import {test, expect, type Locator, type Page} from '@playwright/test';

test.use({actionTimeout: 10000});
const ids = process.env.SECURITY_TEST_IDS?.split(',').map(Number) ?? Array.from({length: 10}, (_, i) => 181 + i);
async function fits(page: Page, panel: Locator, context: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), context + ': page width').toBe(true);
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 2), context + ': panel width').toBe(true);
  const clipped = await panel.locator('svg text').evaluateAll(nodes => nodes.filter(node => {
    const text = node as SVGGraphicsElement, svg = text.ownerSVGElement!;
    const b = text.getBoundingClientRect(), v = svg.getBoundingClientRect();
    return v.width > 0 && (b.left < v.left - 2 || b.top < v.top - 2 || b.right > v.right + 2 || b.bottom > v.bottom + 2);
  }).map(n => n.textContent));
  expect(clipped, context + ': SVG labels').toEqual([]);
}
for (const width of [1440, 390, 320]) for (const id of ids) {
  test(`${id} lab and four help modes remain isolated at ${width}px`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height: 1000});
    await page.emulateMedia({reducedMotion: 'reduce'});
    const errors: string[] = [], attempts: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {if (r.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(r.url())) attempts.push(r.url());});
    await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
    await page.getByRole('button', {name: '动手观察', exact: true}).click();
    const lab = page.locator('.learning-column').getByTestId('security-lab-' + id);
    await expect(lab).toBeVisible();
    const model = lab.getByTestId('live-model').first();
    await expect(model).toBeVisible();
    const initial = await model.getAttribute('data-state');
    expect(initial).toBeTruthy();
    await fits(page, lab, `${id} observation`);
    if (process.env.SECURITY_SCREENSHOTS === '1' && ((id === 181 && width === 1440) || (id === 189 && width === 320))) await lab.screenshot({path: testInfo.outputPath('observation.png')});
    const editor = page.locator('.workbench-column .cm-content').first();
    const draft = page.locator('.decision-notebook textarea').first();
    const code = await editor.count() ? await editor.innerText() : null;
    const note = await draft.count() ? await draft.inputValue() : null;
    const modes: string[] = [];
    for (const name of ['举例子', '画图', '拆步骤', '让我试试']) {
      const modeButton = page.locator('.help-panel').getByRole('button', {name, exact: true});
      await modeButton.click();
      await expect(modeButton).toHaveClass(/selected/);
      const help = page.getByTestId('security-help-' + id);
      await expect(help).toBeVisible();
      await fits(page, help, `${id} ${name}`);
      modes.push(await help.innerText());
      expect(await help.locator('button,input,select,textarea').count(), `${id} ${name} has learner controls`).toBeGreaterThan(0);
      await expect(model).toHaveAttribute('data-state', initial!);
    }
    expect(new Set(modes).size).toBe(4);
    await page.getByRole('button', {name:'收起帮助', exact: true}).click();
    await expect(model).toHaveAttribute('data-state', initial!);
    if (code !== null) expect(await editor.innerText()).toBe(code);
    if (note !== null) expect(await draft.inputValue()).toBe(note);
    expect(attempts).toEqual([]);
    expect(errors).toEqual([]);
  });
}
