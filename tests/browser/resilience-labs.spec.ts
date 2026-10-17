import {test,expect,type Locator,type Page} from '@playwright/test';

async function fits(page:Page,root:Locator,context:string){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),context+' 页面横向溢出').toBe(true);
  expect(await root.evaluate(el=>el.scrollWidth<=el.clientWidth+1),context+' 面板横向溢出').toBe(true);
  const clipped=await root.locator('svg text').evaluateAll(nodes=>nodes.filter(node=>{
    const text=node as SVGGraphicsElement,svg=text.ownerSVGElement;
    if(!svg)return false;
    const box=text.getBoundingClientRect(),view=svg.getBoundingClientRect();
    return view.width>0&&(box.left<view.left-2||box.right>view.right+2||box.top<view.top-2||box.bottom>view.bottom+2);
  }).map(n=>n.textContent));
  expect(clipped,context+' 图中文字被裁切').toEqual([]);
}

for(const id of Array.from({length:10},(_,i)=>151+i))for(const width of [1440,390]){
  test(`${id} isolated observation and four help views at ${width}px`,async({page})=>{
    test.setTimeout(90000);
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors:string[]=[],attempts:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))attempts.push(r.url());});
    await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'动手观察',exact:true}).click();
    const lab=page.getByTestId('resilience-lab-'+id);
    await expect(lab).toBeVisible();
    await fits(page,lab,`${id} 观察`);
    const model=lab.getByTestId('live-model').first();
    await expect(model).toBeVisible();
    const before=await model.getAttribute('data-state');
    expect(before).toBeTruthy();
    const notebook=page.getByRole('textbox',{name:'架构决策记录'});
    const editor=page.locator('.cm-content').first();
    const draft=await notebook.count()?await notebook.inputValue():await editor.innerText();
    const views:string[]=[];
    for(const name of ['举例子','画图','拆步骤','让我试试']){
      const button=page.locator('.help-panel').getByRole('button',{name,exact:true});
      await button.focus();await page.keyboard.press('Enter');
      await expect(button).toHaveClass(/selected/);
      const help=page.getByTestId('resilience-help-'+id);
      await expect(help).toBeVisible();
      views.push(await help.innerText());
      await fits(page,help,`${id} ${name}`);
      await expect(model).toHaveAttribute('data-state',before!);
      if(name==='画图')await help.screenshot({path:`.runtime/resilience-qa/help-${id}-${width}.png`,animations:'disabled'});
    }
    expect(new Set(views).size).toBe(4);
    if(await notebook.count())await expect(notebook).toHaveValue(draft);
    else expect(await editor.innerText()).toBe(draft);
    await page.getByRole('button',{name:'收起帮助',exact:true}).click();
    await expect(model).toHaveAttribute('data-state',before!);
    await lab.screenshot({path:`.runtime/resilience-qa/lab-${id}-${width}.png`,animations:'disabled'});
    expect(errors).toEqual([]);expect(attempts).toEqual([]);
  });
}
