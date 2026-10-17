import {test,expect} from '@playwright/test';
import {allLessons} from '../../src/content/catalog';
const architecture=(await allLessons()).filter(l=>l.id>100);
test('双学习路径分别展示目录、进度、最近课程和末课导航',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Go 架构师 100 题/}).click();
 await expect(page.getByRole('button',{name:/Go 架构师 100 题/})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.module-card')).toHaveCount(10);
 await expect(page.locator('.lesson-row').first()).toContainText('101');
 await page.goto('/#lesson/200');await expect(page.locator('.lesson-heading h1')).toHaveText(architecture.at(-1)!.title);
 await page.getByRole('button',{name:'迁移与复测',exact:true}).click();await page.getByRole('button',{name:'回到本路径第一课',exact:true}).click();
 await expect(page).toHaveURL(/#lesson\/101$/);
 await expect(page.locator('.lesson-heading .eyebrow')).toContainText('LESSON 101');
 await page.getByRole('button',{name:/Go 入门 100 题/}).click();
 await expect(page.locator('.lesson-row').first()).toContainText('001');
 await expect(page.locator('.module-card').first()).toContainText('值与变量');
 await page.goto('/#lesson/100');await page.getByRole('button',{name:'迁移与复测',exact:true}).click();await page.getByRole('button',{name:'回到本路径第一课',exact:true}).click();await expect(page).toHaveURL(/#lesson\/1$/);
 await page.getByRole('button',{name:/Go 架构师 100 题/}).click();await page.getByRole('button',{name:'继续上次学习',exact:true}).click();await expect(page).toHaveURL(/#lesson\/101$/);
});
test('100个架构课图解能渲染，两个实验分支均改变可见状态',async({page})=>{
 test.setTimeout(420000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const lesson of architecture){
  await page.goto('/#lesson/'+lesson.id);await expect(page.locator('.lesson-heading h1')).toHaveText(lesson.title);
  await page.getByRole('button',{name:'动手观察',exact:true}).click();
  if(lesson.id===121){
   const lab=page.getByTestId('bounded-lab');await expect(lab).toBeVisible();
   await lab.getByRole('button',{name:'提交这一批',exact:true}).click();
   await expect(lab.getByTestId('board-direct').getByTestId('lane-running').getByRole('button')).toHaveCount(8);
   await expect(lab.getByTestId('board-workers').getByTestId('lane-running').getByRole('button')).toHaveCount(2);
  }else{
  const panel=page.locator('.learning-column .experiment-panel'),scene=panel.getByTestId('experiment-scene');
  for(let i=0;i<lesson.experiment.scenarios.length;i++){
   await panel.locator('.scenario-tabs button').nth(i).click();
   const before=await scene.getAttribute('data-state');
   await panel.getByRole('button',{name:'下一步实验',exact:true}).click();
   await expect(scene).not.toHaveAttribute('data-state',before!);
   await expect(scene.locator('.scene-node').first()).toBeVisible();
  }
  }
  await page.getByRole('button',{name:'理解机制',exact:true}).click();
  const diagrams=page.locator('.learning-column [data-testid="mermaid-diagram"]');
  await expect(diagrams).toHaveCount(lesson.diagrams!.length);
  for(const diagram of await diagrams.all())await expect(diagram.locator('svg')).toBeVisible();
  await expect(page.locator('.diagram-fallback')).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});
test('决策草稿立即刷新与切课恢复，预测阶段不显示推荐方案图',async({page})=>{
 await page.goto('/#lesson/101');await page.getByRole('button',{name:'先做预测',exact:true}).click();
 await expect(page.getByTestId('mermaid-diagram')).toHaveCount(0);await expect(page.locator('.decision-comparison')).toHaveCount(0);await expect(page.locator('.cm-content')).toHaveCount(0);
 const marker='选择模块化单体；约束：两人团队；验证：发布耗时 '+Date.now();
 await page.getByRole('textbox',{name:'架构决策记录'}).fill(marker);await page.reload();
 await expect(page.getByRole('textbox',{name:'架构决策记录'})).toHaveValue(marker);
 await expect(page.locator('.decision-notebook')).toContainText('已保存');
 await page.goto('/#lesson/200');await page.goto('/#lesson/101');await expect(page.getByRole('textbox',{name:'架构决策记录'})).toHaveValue(marker);
});
test('离线图解、缺少Go的决策课堂、手机与放大查看',async({page})=>{
 const external:string[]=[];
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(url.hostname)){external.push(url.href);await route.abort();return;}if(url.pathname==='/api/health'){const response=await route.fetch();await route.fulfill({response,json:{...(await response.json()),available:false,goVersion:'未找到 Go',race:false}});return;}await route.continue();});
 await page.setViewportSize({width:390,height:844});await page.goto('/#lesson/101');
 await expect(page.getByRole('textbox',{name:'架构决策记录'})).toBeVisible();
 await page.getByRole('button',{name:'理解机制',exact:true}).click();await expect(page.getByTestId('mermaid-diagram').first().locator('svg')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:/放大图解/}).first().click();await expect(page.locator('dialog[open]')).toBeVisible();
 await page.getByRole('button',{name:'关闭放大图解',exact:true}).click();await expect(page.locator('dialog[open]')).toHaveCount(0);
 expect(external).toEqual([]);
});

test('资源条图改变实际几何；架构代码课可以执行真实测试',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/#lesson/131');await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const panel=page.locator('.learning-column .experiment-panel');
 await expect(panel.getByTestId('resource-bar').first()).toBeVisible();
 const before=await panel.getByTestId('resource-bar').evaluateAll(bars=>bars.map(b=>b.getAttribute('width')));
 await panel.getByRole('button',{name:'下一步实验',exact:true}).click();
 const after=await panel.getByTestId('resource-bar').evaluateAll(bars=>bars.map(b=>b.getAttribute('width')));
 expect(after).not.toEqual(before);
 const codeLesson=architecture.find(l=>l.practice==='go')!;
 await page.goto('/#lesson/'+codeLesson.id);await expect(page.locator('.cm-content')).toBeVisible();
 await page.getByRole('button',{name:'载入参考修复',exact:true}).click();await page.getByRole('button',{name:'测试',exact:true}).click();
 await expect(page.locator('.run-status')).toContainText('完成',{timeout:80000});await expect(page.locator('.terminal pre')).toContainText('PASS');
});
test('记录与收藏按路径隔离，备份同时包含两个路径',async({page})=>{
 await page.goto('/#lesson/101');await expect(page.locator('.lesson-heading h1')).toBeVisible();
 await page.evaluate(async()=>{const {token}=await(await fetch('/api/session')).json();for(const id of [1,101])await fetch('/api/progress/'+id,{method:'PATCH',headers:{'Content-Type':'application/json','x-lab-token':token},body:JSON.stringify({completed:true,favorite:true})});});
 await page.reload();await expect(page.locator('.lesson-heading h1')).toBeVisible();
 const expected=await page.evaluate(async()=>{const {token}=await(await fetch('/api/session')).json();const ps=await(await fetch('/api/progress',{headers:{'x-lab-token':token}})).json();return {intro:ps.filter((p:{lessonId:number;completed:boolean})=>p.lessonId<=100&&p.completed).length,architecture:ps.filter((p:{lessonId:number;completed:boolean})=>p.lessonId>100&&p.completed).length};});
 await expect(page.locator('.progress-label b')).toHaveText(expected.architecture+' / 100');
 await page.goto('/#review');await page.getByRole('button',{name:'我的收藏',exact:true}).click();
 await expect(page.locator('.review-card').filter({hasText:'LESSON 101'})).toBeVisible();
 await expect(page.locator('.review-card').filter({hasText:'LESSON 001'})).toHaveCount(0);
 await page.getByRole('button',{name:/Go 入门 100 题/}).click();await expect(page.locator('.progress-label b')).toHaveText(expected.intro+' / 100');
 await page.goto('/#review');await page.getByRole('button',{name:'我的收藏',exact:true}).click();
 await expect(page.locator('.review-card').filter({hasText:'LESSON 001'})).toBeVisible();
 await expect(page.locator('.review-card').filter({hasText:'LESSON 101'})).toHaveCount(0);
 const ids=await page.evaluate(async()=>{const {token}=await(await fetch('/api/session')).json();return (await(await fetch('/api/backup',{headers:{'x-lab-token':token}})).json()).progress.map((p:{lessonId:number})=>p.lessonId);});
 expect(ids).toContain(1);expect(ids).toContain(101);
});
test('图形渲染失败保留解释与重试，不阻断课堂',async({page})=>{
 await page.goto('/#lesson/101');await page.getByRole('button',{name:'遇到问题',exact:true}).click();
 // Mutate the already loaded fixture so this tests renderer failure independently of module transport.
 await page.evaluate(async()=>{const path='/src/content/architecture/module11.ts';const {default:lessons}=await import(path);lessons[0].diagrams[0].source='invalidArchitectureDiagram';});
 await page.getByRole('button',{name:'理解机制',exact:true}).click();
 await expect(page.locator('.diagram-fallback')).toBeVisible();await expect(page.locator('.diagram-fallback p')).not.toBeEmpty();
 await page.getByRole('button',{name:'重试图形',exact:true}).click();await expect(page.locator('.diagram-fallback')).toBeVisible();
 await page.getByRole('button',{name:'迁移与复测',exact:true}).click();await expect(page.locator('.quiz-card')).toHaveCount(2);
});
test('保存架构课程截图供人工复核',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Go 架构师 100 题/}).click();await page.screenshot({path:'.runtime/architecture-map.png',fullPage:true});
 for(const id of [101,131,175,197]){
  await page.goto('/#lesson/'+id);await page.getByRole('button',{name:'理解机制',exact:true}).click();await expect(page.locator('.learning-column [data-testid="mermaid-diagram"] svg').first()).toBeVisible();
  await page.locator('.learning-column').screenshot({path:'.runtime/architecture-'+id+'.png'});
 }
 await page.setViewportSize({width:390,height:844});await page.goto('/#lesson/101');await page.getByRole('button',{name:'理解机制',exact:true}).click();await expect(page.locator('.learning-column [data-testid="mermaid-diagram"] svg').first()).toBeVisible();await page.screenshot({path:'.runtime/architecture-mobile.png',fullPage:true});
});


test('切换阶段关闭已打开和迟到的帮助，迁移题不带入旧阶段图解',async({page})=>{
 await page.goto('/#lesson/101');await page.getByRole('button',{name:'修复与决策',exact:true}).click();
 await page.getByRole('button',{name:'画图',exact:true}).click();await expect(page.locator('.help-content')).toBeVisible();
 await page.locator('.lesson-navigation').getByRole('button',{name:'下一步',exact:true}).click();
 await expect(page.locator('.help-content')).toHaveCount(0);
 await page.getByRole('button',{name:'修复与决策',exact:true}).click();
 await page.route('**/api/progress/101/help',async route=>{const response=await route.fetch();await new Promise(resolve=>setTimeout(resolve,500));await route.fulfill({response});});
 await page.getByRole('button',{name:'画图',exact:true}).click();
 await page.locator('.lesson-navigation').getByRole('button',{name:'下一步',exact:true}).click();
 await expect(page.getByRole('button',{name:'迁移与复测',exact:true})).toHaveClass('active');
 await page.waitForTimeout(700);await expect(page.locator('.help-content')).toHaveCount(0);
});


test('慢保存跨切课共享顺序，旧实例不会覆盖重新编辑的新决策',async({page})=>{
 const first='旧保存-'+Date.now(),second='离开前草稿',latest='返回后最新决策';
 let release!:()=>void,started!:()=>void;const held=new Promise<void>(resolve=>{release=resolve}),began=new Promise<void>(resolve=>{started=resolve});
 await page.route('**/api/progress/101',async route=>{
  if(route.request().method()==='PATCH'&&route.request().postDataJSON()?.feynman===first){const response=await route.fetch();started();await held;await route.fulfill({response});}else await route.continue();
 });
 await page.goto('/#lesson/101');await page.getByRole('textbox',{name:'架构决策记录'}).fill(first);await began;
 await page.getByRole('textbox',{name:'架构决策记录'}).fill(second);
 await page.evaluate(()=>{location.hash='lesson/200'});await expect(page.locator('.lesson-heading .eyebrow')).toContainText('200');
 await page.evaluate(()=>{location.hash='lesson/101'});await expect(page.locator('.lesson-heading .eyebrow')).toContainText('101');
 await page.getByRole('textbox',{name:'架构决策记录'}).fill(latest);await page.waitForTimeout(500);release();
 await expect(page.locator('.decision-notebook')).toContainText('已保存');
 await page.reload();await expect(page.getByRole('textbox',{name:'架构决策记录'})).toHaveValue(latest);
});



test('两条路径代码草稿立即刷新恢复，并继续使用原有版本缓存键',async({page})=>{
 for(const id of [1,113]){
  await page.goto('/#lesson/'+id);await expect(page.locator('.lesson-heading .eyebrow')).toContainText('LESSON '+String(id).padStart(3,'0'));
  const editor=page.locator('.cm-content');await expect(editor).toBeVisible();
  const marker='draft-'+id+'-'+Date.now();await editor.fill('package main\nfunc main() {}\n// '+marker);
  expect(await page.evaluate(id=>localStorage.getItem('go100:draft:'+id+':1'),id)).toContain(marker);
  await page.reload();await expect(page.locator('.cm-content')).toContainText(marker);
  await expect(page.locator('.editor-title')).toContainText('已保存');
 }
});
