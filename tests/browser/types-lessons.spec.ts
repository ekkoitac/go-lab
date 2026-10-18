import {test, expect, type Page} from '@playwright/test';

// Cold Vite dependency scans can exceed 90s while other chapters are edited concurrently.
test.setTimeout(180000);
async function openLesson(page: Page, id: number) {
  await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.locator('.learning-column').getByTestId(`types-lab-${id}`);
  await expect(lab).toBeVisible();
  return lab;
}
const modes = [['举例子', 'example'], ['画图', 'diagram'], ['拆步骤', 'steps'], ['让我试试', 'try']] as const;
for (let id = 21; id <= 30; id++) {
  test(`types ${id}: four distinct help views preserve observation and assessment`, async ({page}) => {
    const errors: string[] = [], writes: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {if (r.method() === 'POST' && /\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url())) writes.push(r.url());});
    const lab = await openLesson(page, id);
    const model = lab.getByTestId('live-model').first();
    const initial = await model.getAttribute('data-state');
    expect(initial).toBeTruthy();
    const views: string[] = [];
    for (const [name, mode] of modes) {
      await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
      const help = page.locator(`[data-help-mode=${mode}]`).getByTestId(`types-help-${id}`);
      await expect(help).toBeVisible();
      views.push(await help.innerText());
      await expect(help.getByTestId(`types-lab-${id}`)).toHaveCount(0);
      // Every help view contains an operation, rather than only replacing explanatory prose.
      expect(await help.locator('button, input, select, textarea').count()).toBeGreaterThan(0);
    }
    expect(new Set(views).size).toBe(4);
    if (id === 22 || id === 29) await lab.screenshot({path: `.runtime/types-${id}-desktop.png`});
    await expect(model).toHaveAttribute('data-state', initial!);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
  test(`types ${id}: narrow layout with reduced motion`, async ({page}) => {
    await page.setViewportSize({width: 320, height: 844});
    await page.emulateMedia({reducedMotion: 'reduce'});
    const lab = await openLesson(page, id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await lab.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (id === 23 || id === 30) await lab.screenshot({path: `.runtime/types-${id}-mobile.png`});
    for (const [name, mode] of modes) {
      await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
      const help = page.locator(`[data-help-mode=${mode}]`).getByTestId(`types-help-${id}`);
      await expect(help).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id} ${mode} page overflow`).toBe(true);
      expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${id} ${mode} help overflow`).toBe(true);
    }
  });
}
test('types 21: keyboard prediction distinguishes direct call from interface assignment', async ({page}) => {
  const lab = await openLesson(page, 21);
  const check = async (outcome: string) => {
    await lab.getByLabel('本次结果').selectOption(outcome);
    await lab.getByLabel('为什么？', {exact: true}).fill('可寻址性只用于调用便利，接口只检查方法集');
    await lab.getByRole('button', {name: '验证预测', exact: true}).focus();
    await page.keyboard.press('Enter');
  };
  await check('increment');
  await expect(lab.getByTestId('live-model')).toContainText('N = 1');
  await lab.getByLabel('操作入口').selectOption('interface');
  await check('compile-error');
  await expect(lab.getByTestId('live-model')).toContainText('编译失败，未执行');
  await lab.getByRole('button', {name: '修复为指针，再预测验证'}).click();
  await check('increment');
  await expect(lab.getByTestId('live-model')).toContainText('N = 1');
});

test('types 22: shared write, rewind, isolate then write', async ({page}) => {
  const lab = await openLesson(page, 22);
  const model = lab.getByTestId('live-model').first();
  const before = await model.getAttribute('data-state');
  const act = async (action: string, prediction: string) => {
    await lab.getByRole('combobox', {name: '下一步操作', exact: true}).selectOption(action);
    await lab.getByLabel('原订单的可见值会改变吗？').selectOption(prediction);
    await lab.getByLabel('依据哪条字段或引用路径？').fill('沿描述符检查目标数组');
    await lab.getByRole('button', {name: '执行并验证', exact: true}).click();
  };
  await act('element', 'yes');
  expect(JSON.parse((await model.getAttribute('data-state'))!).arrays.A).toEqual(['SALE']);
  await lab.getByRole('button', {name: '回退一步', exact: true}).click();
  await expect(model).toHaveAttribute('data-state', before!);
  await act('clone', 'no');
  await act('element', 'no');
  const isolated = JSON.parse((await model.getAttribute('data-state'))!);
  expect(isolated.arrays.A).toEqual(['VIP']);
  expect(isolated.arrays[isolated.draft.tags]).toEqual(['SALE']);
});

test('types 23: ambiguity, depth change and explicit shipping path', async ({page}) => {
  const lab = await openLesson(page, 23);
  const check = async (answer: string) => {
    await lab.getByLabel('预测选择结果').selectOption(answer);
    await lab.getByLabel('你的理由', {exact: true}).fill('查找最浅的唯一 City，或显式指定 Shipping');
    await lab.getByRole('button', {name: '验证选择器', exact: true}).click();
  };
  await check('ambiguous');
  await expect(lab.getByTestId('live-model')).toContainText('编译失败：选择器歧义');
  await lab.getByLabel('Shipping 放置位置').selectOption('nested');
  await check('billing');
  await expect(lab.getByTestId('live-model')).toContainText('o.Billing.City → 上海');
  await lab.getByRole('button', {name: '辅助修复：明确读取送货城市'}).click();
  await check('shipping');
  await expect(lab.getByTestId('live-model')).toContainText('o.Envelope.Shipping.City → 杭州');
});

test('types 24: typed nil branch, safe method, dereference panic and guarded return', async ({page}) => {
  const lab = await openLesson(page, 24);
  const run = async (isNil: string, call: string) => {
    await lab.getByLabel('err == nil 的结果').selectOption(isNil);
    await lab.getByLabel('调用方最终行为').selectOption(call);
    await lab.getByLabel('预测理由', {exact: true}).fill('接口保留类型；只有方法解引用 nil 才发生本例 panic');
    await lab.getByRole('button', {name: '提交预测并执行返回'}).click();
    await lab.getByRole('button', {name: '执行 nil 比较'}).click();
    await lab.getByRole('button', {name: '执行调用分支'}).click();
  };
  await run('false', 'returned');
  await expect(lab.getByTestId('live-model')).toContainText('调用正常返回');
  await lab.getByLabel('Error 方法实现').selectOption('dereference');
  await run('false', 'panic');
  await expect(lab.getByTestId('live-model')).toContainText('panic：解引用 nil 接收者 p.Msg');
  await lab.getByRole('button', {name: '保留对照，修复返回契约后再验证'}).click();
  await run('true', 'skipped');
  await expect(lab.getByTestId('live-model')).toContainText('成功路径，未调用 Error()');
  await lab.getByLabel('实际检查结果').selectOption('problem');
  await run('false', 'returned');
  await expect(lab.getByTestId('live-model')).toContainText('磁盘已满');
});
test('types 25: assertion failure is not conversion and typed nil can match', async ({page}) => {
  const lab = await openLesson(page, 25);
  const run = async (outcome: string) => {
    await lab.getByRole('combobox', {name: '最终结果', exact: true}).selectOption(outcome);
    await lab.getByLabel('依据哪两个类型作判断？').fill('比较动态类型和目标类型身份');
    await lab.getByRole('button', {name: '提交预测，读取类型'}).click();
    await lab.getByRole('button', {name: '比对类型身份'}).click();
    await lab.getByRole('button', {name: '执行断言', exact: true}).click();
  };
  await run('panic');
  await expect(lab).toContainText('结果预测吻合');
  await lab.getByRole('button', {name: '保留相同输入，换一种断言形式'}).click();
  await run('zero');
  await expect(lab.getByTestId('live-model').first()).toContainText(/ok\s*=\s*false/);
  await lab.getByRole('combobox', {name: '插件载荷', exact: true}).selectOption('empty');
  await run('success');
  await expect(lab.getByTestId('live-model').first()).toContainText(/ok\s*=\s*true/);
  await lab.getByRole('combobox', {name: '插件载荷', exact: true}).selectOption('typedNil');
  await lab.getByRole('combobox', {name: '目标具体类型', exact: true}).selectOption('*Version');
  await run('success');
  await expect(lab).toContainText('断言成功不代表指针可以解引用');
});

test('types 26: unknown payload rejection and grouped-case static type', async ({page}) => {
  const lab = await openLesson(page, 26);
  const run = async (status: string) => {
    await lab.getByRole('combobox', {name: '返回状态', exact: true}).selectOption(status);
    await lab.getByLabel('你的理由', {exact: true}).fill('按动态类型匹配，未知类型需要拒绝出口');
    await lab.getByRole('button', {name: '提交预测，读取类型'}).click();
    await lab.getByRole('button', {name: '选择匹配通道'}).click();
    await lab.getByRole('button', {name: '执行返回', exact: true}).click();
  };
  await run('空成功');
  await lab.getByRole('button', {name: '保留同输入对照，补上 default 再预测'}).click();
  await run('明确拒绝');
  await expect(lab.getByTestId('live-model').first()).toContainText('unsupported bool');
  await lab.getByLabel('送进 any 的输入').selectOption('int');
  await lab.getByLabel('合并为 case int, string', {exact: false}).check();
  await run('支持');
  await expect(lab).toContainText('x 的静态类型为 any');
  await expect(lab).toContainText('不允许这个操作');
});

test('types 27: narrow interface preserves real business requirements', async ({page}) => {
  const lab = await openLesson(page, 27);
  const run = async (outcome: string) => {
    await lab.getByRole('combobox', {name: '预测', exact: true}).selectOption(outcome);
    await lab.getByLabel('判断理由', {exact: true}).fill('业务需要被接口覆盖，接口需要被提供者满足');
    await lab.getByRole('button', {name: '提交预测，检查函数体'}).click();
    await lab.getByRole('button', {name: '检查提供者能否接入'}).click();
    await lab.getByRole('button', {name: '尝试执行业务'}).click();
  };
  await run('provider-missing');
  await lab.getByRole('button', {name: '以实际业务重建接口，保留原方案对照'}).click();
  await run('ready');
  await expect(lab.getByTestId('live-model').first()).toContainText('hello Ada');
  await lab.getByRole('group', {name: '消费方实际业务要做什么', exact: true}).getByLabel('Save()', {exact: true}).check();
  await run('contract-missing');
  await expect(lab).toContainText('接口遗漏业务所需方法');
});
test('types 28: slice key repair and different-type comparison avoid false panic rules', async ({page}) => {
  const lab = await openLesson(page, 28);
  const run = async (answer: string) => {
    await lab.getByRole('combobox', {name: '你预测的结果', exact: true}).selectOption(answer);
    await lab.getByLabel('依据是什么？').fill('先检查操作和动态类型，再判断是否比较内部值');
    await lab.getByRole('button', {name: '提交预测，检查静态类型'}).click();
    await lab.getByRole('button', {name: '读取动态检查条件'}).click();
    await lab.getByRole('button', {name: '执行当前分支'}).click();
  };
  await run('panic');
  await lab.getByRole('button', {name: '保留这两个数，把切片改成 [2]int 再试', exact: true}).click();
  await run('stored');
  await expect(lab.getByTestId('live-model')).toContainText('写入成功，查找 true');
  await lab.getByRole('combobox', {name: '操作', exact: true}).selectOption('equal');
  await lab.getByRole('group', {name: '左值 x', exact: true}).getByRole('combobox').selectOption('slice');
  await lab.getByRole('group', {name: '右值 y', exact: true}).getByRole('combobox').selectOption('int');
  await run('false');
  await expect(lab.getByTestId('live-model')).toContainText('不会进入动态值比较');
});

test('types 29: whole constraint, named type and exact integer overflow', async ({page}) => {
  const lab = await openLesson(page, 29);
  const run = async (answer: string) => {
    await lab.getByRole('combobox', {name: '这次会发生什么？', exact: true}).selectOption(answer);
    await lab.getByLabel('为什么？', {exact: true}).fill('先验证所有成员的加法，再验证本次命名类型和数值边界');
    await lab.getByRole('button', {name: '提交预测，检查函数体'}).click();
    await lab.getByRole('button', {name: '检查实参准入'}).click();
    await lab.getByRole('button', {name: '尝试运行加法'}).click();
  };
  await run('body-error');
  await lab.getByRole('button', {name: '保留同一输入，改为 ~int | ~int64 对照', exact: true}).click();
  await run('sum');
  await expect(lab.getByTestId('live-model')).toContainText('Cents(150)');
  await lab.getByRole('checkbox', {name: 'int64', exact: true}).check();
  await run('argument-error');
  await lab.getByRole('checkbox', {name: '~int64', exact: true}).check();
  await lab.getByLabel('变量 a', {exact: true}).fill('9223372036854775807');
  await lab.getByLabel('变量 b', {exact: true}).fill('1');
  await run('overflow');
  await expect(lab.getByTestId('live-model')).toContainText('Cents(-9223372036854775808)');
});

test('types 30: explicit interface type argument and reversible dispatch', async ({page}) => {
  const lab = await openLesson(page, 30);
  const model = lab.getByTestId('live-model');
  const predict = async (answer: string) => {
    await lab.getByRole('combobox', {name: '本次装配能否通过编译？', exact: true}).selectOption(answer);
    await lab.getByLabel('为什么？', {exact: true}).fill('显式 T=Sender 容纳不同动态类型，推断不会自动寻找公共接口');
    await lab.getByRole('button', {name: '验证预测', exact: true}).click();
  };
  await predict('fail');
  await expect(model).toContainText('编译失败，运行未开始');
  await lab.getByRole('button', {name: '保持输入，修复为 Sender 后重新预测'}).click();
  await predict('pass');
  await lab.getByRole('button', {name: '构造容器', exact: true}).click();
  await expect(model).toContainText('容器就绪，尚未调用 Send');
  await lab.getByRole('button', {name: '单步发送', exact: true}).click();
  expect(JSON.parse((await model.getAttribute('data-state'))!).output).toEqual(['mail:ok']);
  await lab.getByRole('button', {name: '单步发送', exact: true}).click();
  expect(JSON.parse((await model.getAttribute('data-state'))!).output).toEqual(['mail:ok','sms:ok']);
  await lab.getByRole('button', {name: '回退一步', exact: true}).click();
  expect(JSON.parse((await model.getAttribute('data-state'))!).output).toEqual(['mail:ok']);
});