import {test, expect, type Page} from '@playwright/test';
import {emptyProgress} from '../../src/learning';

const chapters = (page: Page) => page.locator('.chapter-toggle');
const search = (page: Page) => page.getByRole('textbox', {name: '搜索当前路径课程'});
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
}

test('desktop rail persists and chapter expansion is independent per path', async ({page}, info) => {
  await page.goto('/');
  await expect(chapters(page).first()).toHaveAttribute('aria-expanded', 'true');
  await chapters(page).nth(1).click();
  await expect(chapters(page).first()).toHaveAttribute('aria-expanded', 'true');
  await expect(chapters(page).nth(1)).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({path: info.outputPath('desktop-expanded.png')});
  const before = await page.locator('.main-shell').boundingBox();
  await page.getByRole('button', {name: '收起侧边栏', exact: true}).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '64px');
  expect((await page.locator('.main-shell').boundingBox())!.width).toBeGreaterThan(before!.width);
  await page.getByRole('link', {name: '复习中心', exact: true}).focus();
  await expect(page.locator('.rail-tooltip', {hasText: '复习中心'})).toBeVisible();
  await page.screenshot({path: info.outputPath('desktop-rail.png')});
  await page.reload();
  await expect(page.getByRole('button', {name: '展开侧边栏', exact: true})).toBeVisible();
  await page.getByRole('button', {name: '展开侧边栏', exact: true}).click();
  await expect(chapters(page).nth(1)).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', {name: /Go 架构师 100 题/}).click();
  await expect(chapters(page).nth(1)).toHaveAttribute('aria-expanded', 'false');
  await chapters(page).nth(2).click();
  await page.getByRole('button', {name: /Go 入门 100 题/}).click();
  await expect(chapters(page).nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(chapters(page).nth(2)).toHaveAttribute('aria-expanded', 'false');
  await noOverflow(page);
});

test('deep links reveal the active lesson without reopening manually folded chapters', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('go100:ui:expanded:architecture', '[]'));
  await page.goto('/#lesson/197');
  await expect(page.locator('.lesson-heading h1')).toBeVisible();
  const active = page.locator('.directory-lesson[aria-current="page"]');
  await expect(active).toContainText('197');
  await expect(active).toBeInViewport();
  await expect(chapters(page).last()).toHaveAttribute('aria-expanded', 'true');
  const pageScroll = await page.evaluate(() => scrollY);
  await chapters(page).last().click();
  await page.getByRole('button', {name: '先做预测', exact: true}).click();
  await expect(page.getByRole('button', {name: '先做预测', exact: true})).toHaveClass('active');
  await expect(page.locator('.quiz-card').first()).toBeVisible();
  await expect(chapters(page).last()).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => scrollY)).toBe(pageScroll);
  await page.getByRole('link', {name: '返回课程地图', exact: true}).click();
  await expect(page.locator('.module-card.selected')).toContainText('191');
  await expect(page.locator('.lesson-list-section')).toBeInViewport();
});

test('chapter selection, search reset and map back/forward preserve browsing context', async ({page}) => {
  await page.goto('/');
  await page.locator('.module-card').nth(1).click();
  await expect(page.locator('.lesson-list-section')).toBeInViewport();
  await search(page).fill('切片');
  await page.getByRole('combobox', {name: '筛选课程'}).selectOption('all');
  await expect(page.locator('.lesson-row')).toHaveCount(10);
  await expect(page.locator('.lesson-row').first()).toContainText('数组复制');
  const chosen = page.locator('.lesson-row-main').first();
  await chosen.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await chosen.click();
  await expect(page.locator('.lesson-heading h1')).toBeVisible();
  await page.getByRole('link', {name: '返回课程地图', exact: true}).click();
  await expect(search(page)).toHaveValue('切片');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  await page.goBack();
  await expect(page.locator('.lesson-heading')).toBeVisible();
  await page.goBack();
  await expect(search(page)).toHaveValue('切片');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  await page.goForward();
  await expect(page.locator('.lesson-heading')).toBeVisible();
  await page.goBack();
  await search(page).fill('不存在的课程关键词');
  await expect(page.getByRole('heading', {name: '没有匹配的课程'})).toBeVisible();
  await page.getByRole('button', {name: '显示本章全部课程'}).click();
  await expect(search(page)).toHaveValue('');
  await expect(page.locator('.lesson-row')).toHaveCount(10);
  await search(page).fill('001');
  await expect(page.locator('.lesson-row')).toHaveCount(1);
  await expect(page.locator('.lesson-row')).toContainText('变量遮蔽');
  await page.getByRole('button', {name: '清空搜索'}).click();
  await search(page).fill('值与变量');
  await expect(page.locator('.lesson-row')).toHaveCount(10);
  await page.getByRole('button', {name: '重置条件'}).click();
  await expect(page.locator('.lesson-row').first()).toContainText('011');
});

test('path switches use separate map snapshots including same-hash history', async ({page}) => {
  await page.goto('/');
  await search(page).fill('切片');
  await page.getByRole('combobox', {name: '筛选课程'}).selectOption('favorite');
  await page.getByRole('button', {name: /Go 架构师 100 题/}).click();
  await expect(search(page)).toHaveValue('');
  await search(page).fill('缓存');
  await page.goBack();
  await expect(page.getByRole('button', {name: /Go 入门 100 题/})).toHaveAttribute('aria-pressed', 'true');
  await expect(search(page)).toHaveValue('切片');
  await expect(page.getByRole('combobox', {name: '筛选课程'})).toHaveValue('favorite');
  await page.goForward();
  await expect(search(page)).toHaveValue('缓存');
  await page.reload();
  await expect(search(page)).toHaveValue('缓存');
});

test('view chapter navigates to its list; selecting the current lesson closes the mobile drawer', async ({page}) => {
  await page.goto('/#lesson/14');
  await expect(page.locator('.lesson-heading')).toBeVisible();
  await page.getByRole('button', {name: /^查看本章：/}).first().click();
  await expect(page).toHaveURL(/#map$/);
  await expect(page.locator('.lesson-list-section')).toBeInViewport();
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/#lesson/14');
  await expect(page.locator('.lesson-heading')).toBeVisible();
  await page.getByRole('button', {name: '打开导航', exact: true}).click();
  await page.locator('.directory-lesson[aria-current="page"]').click();
  await expect(page.getByRole('dialog', {name: '学习导航'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: '打开导航', exact: true})).toBeFocused();
});

test('mobile drawer traps focus, restores focus, locks scroll and cleans up at the breakpoint', async ({page}, info) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/');
  const opener = page.getByRole('button', {name: '打开导航', exact: true});
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  await opener.click();
  await expect(page.getByRole('button', {name: '关闭导航', exact: true})).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.screenshot({path: info.outputPath('mobile-drawer.png')});
  await page.locator('.sidebar a.brand').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(chapters(page).last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.sidebar a.brand')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await opener.click();
  await page.getByRole('button', {name: '点击遮罩关闭导航'}).click({position: {x: 370, y: 300}});
  await expect(opener).toBeFocused();
  await opener.click();
  await page.setViewportSize({width: 1000, height: 800});
  await expect(page.locator('.sidebar-overlay')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.getByRole('button', {name: '收起侧边栏'}).click();
  await page.setViewportSize({width: 390, height: 844});
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  await opener.click();
  await expect(chapters(page).first()).toBeVisible();
  await noOverflow(page);
});

test('collapsing preserves the mounted editor, experiment state and decision draft', async ({page}, info) => {
  await page.goto('/#lesson/14');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  await page.getByRole('slider', {name: '切片容量'}).fill('4');
  const collectionsLab = page.getByTestId('collections-lab-14');
  await collectionsLab.getByLabel('我的预测').selectOption('yes');
  await collectionsLab.getByLabel('我的依据').fill('容量 4 可容纳三个元素，仍然共享 A');
  await collectionsLab.getByRole('button', {name: '执行并核对预测', exact: true}).click();
  const collectionsState = await collectionsLab.getByTestId('live-model').getAttribute('data-state');
  const editor = page.locator('.cm-content');
  await editor.fill('package main\nfunc main() { println("navigation draft") }');
  const handle = await editor.elementHandle();
  await page.getByRole('button', {name: '收起侧边栏'}).click();
  await expect(page.getByRole('slider', {name: '切片容量'})).toHaveValue('4');
  await expect(collectionsLab.getByTestId('live-model')).toHaveAttribute('data-state', collectionsState!);
  await expect(collectionsLab).toContainText('b = [10, 20, 30]');
  await expect(editor).toContainText('navigation draft');
  expect(await handle!.evaluate(e => e.isConnected)).toBeTruthy();
  await page.screenshot({path: info.outputPath('lesson-rail.png')});
  await noOverflow(page);
  await page.getByRole('button', {name: '展开侧边栏'}).click();
  await expect(editor).toContainText('navigation draft');
  await page.goto('/#lesson/101');
  const decision = page.getByRole('textbox', {name: '架构决策记录'});
  await decision.fill('先保持模块化单体，等边界稳定后重新评估。');
  const decisionHandle = await decision.elementHandle();
  await page.getByRole('button', {name: '收起侧边栏'}).click();
  await expect(decision).toHaveValue('先保持模块化单体，等边界稳定后重新评估。');
  expect(await decisionHandle!.evaluate(e => e.isConnected)).toBeTruthy();
  await page.getByRole('button', {name: '展开侧边栏'}).click();
  await expect(decision).toHaveValue('先保持模块化单体，等边界稳定后重新评估。');
});

test('navigation survives unavailable preference storage', async ({page}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {throw new DOMException('Blocked', 'SecurityError');};
    Storage.prototype.setItem = () => {throw new DOMException('Blocked', 'SecurityError');};
  });
  await page.goto('/');
  await expect(page.locator('.module-card')).toHaveCount(10);
  await page.getByRole('button', {name: '收起侧边栏'}).click();
  await page.getByRole('button', {name: '展开侧边栏'}).click();
  await chapters(page).nth(1).click();
  await expect(chapters(page).nth(1)).toHaveAttribute('aria-expanded', 'true');
  await search(page).fill('切片');
  await page.getByRole('button', {name: /Go 架构师 100 题/}).click();
  await page.getByRole('button', {name: /Go 入门 100 题/}).click();
  await expect(search(page)).toHaveValue('切片');
});

test('malformed stored preferences fall back to usable navigation defaults', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('go100:ui:expanded:intro', '{broken');
    sessionStorage.setItem('go100:ui:map:intro', JSON.stringify({module: 999, query: 42, filter: 'invalid', scrollY: -100}));
  });
  await page.goto('/');
  await expect(chapters(page).first()).toHaveAttribute('aria-expanded', 'true');
  await expect(search(page)).toHaveValue('');
  await expect(page.getByRole('combobox', {name: '筛选课程'})).toHaveValue('all');
  await expect(page.locator('.lesson-row').first()).toContainText('001');
});

test('browsing other chapters never snaps the directory back to the active lesson', async ({page}) => {
  await page.goto('/#lesson/197');
  await expect(page.locator('.directory-lesson[aria-current="page"]')).toBeInViewport();
  await page.locator('.course-directory').evaluate(e => {e.scrollTop = 0;});
  await chapters(page).first().click();
  await expect(chapters(page).first()).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.locator('.course-directory').evaluate(e => e.scrollTop)).toBe(0);
  await expect(page.locator('.directory-lesson[aria-current="page"]')).not.toBeInViewport();
});

test('restoring a filtered map waits for delayed progress before restoring its scroll position', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 800});
  await page.addInitScript(() => sessionStorage.setItem('go100:ui:map:intro', JSON.stringify({module: 0, query: '', filter: 'favorite', scrollY: 1100})));
  let release!: () => void;
  const loaded = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/progress', async route => {
    await loaded;
    await route.fulfill({json: Array.from({length: 10}, (_, index) => ({...emptyProgress(index + 1, 1), favorite: true}))});
  });
  await page.goto('/');
  await expect(page.getByRole('combobox', {name: '筛选课程'})).toHaveValue('favorite');
  await expect(page.locator('.lesson-row')).toHaveCount(0);
  release();
  await expect(page.locator('.lesson-row')).toHaveCount(10);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(1100);
});

test('long chapter titles and navigation fit both sides of responsive breakpoints', async ({page}, info) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/#lesson/191');
  await expect(page.locator('.lesson-heading')).toBeVisible();
  for (const width of [320, 720, 721, 960, 1180]) {
    await page.setViewportSize({width, height: 900});
    if (width <= 720) await page.getByRole('button', {name: '打开导航', exact: true}).click();
    await expect(page.locator('.directory-lesson[aria-current="page"]')).toBeInViewport();
    expect(await page.locator('.course-directory').evaluate(e => e.scrollWidth <= e.clientWidth)).toBeTruthy();
    await noOverflow(page);
    if (width === 721) await page.screenshot({path: info.outputPath('tablet-navigation.png')});
    if (width <= 720) await page.keyboard.press('Escape');
  }
});
