import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const port=Number(process.env.GO100_PRODUCTION_SMOKE_PORT??26318);
assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535,'GO100_PRODUCTION_SMOKE_PORT must be an integer from 1024 to 65535');
const origin=`http://127.0.0.1:${port}`;
const dataDir='.runtime/architecture-production-smoke';
const screenshots='.runtime/screenshots/architecture-production';
// Refuse an occupied port rather than accidentally testing another local service.
await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(error=>error?reject(error):resolve()));});
const server=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{
 env:{...process.env,GO100_API_PORT:String(port),GO100_WEB_PORT:String(port),GO100_DATA_DIR:dataDir},
 stdio:['ignore','pipe','pipe','ipc'],windowsHide:true
});
let logs='',spawnError;server.stdout.on('data',b=>{logs+=b});server.stderr.on('data',b=>{logs+=b});server.on('error',error=>{spawnError=error});
let browser;
const external=[],pageErrors=[];
try{
 let ready=false;
 for(let i=0;i<250;i++){
  if(spawnError)throw spawnError;
  assert.equal(server.exitCode,null,'Production server exited before becoming ready: '+logs);
  try{if((await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(ready,'Production server did not start: '+logs);
 const session=await fetch(origin+'/api/session');assert.ok(session.ok);
 const {token}=await session.json();const headers={'x-lab-token':token,'content-type':'application/json'};
 async function api(path,method='GET',body){const response=await fetch(origin+'/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});assert.ok(response.ok,`${method} ${path}: ${response.status} ${await response.clone().text()}`);return response.json();}
 const health=await api('/health');assert.ok(health.available,'The original production Go capability check requires the installed toolchain');assert.match(health.goVersion,/go1\.26(?:\.|\s|$)/);
 browser=await chromium.launch({channel:'chrome'});
 async function guardedContext(mockGo=false){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});let mockedHealth=0;
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin){external.push(url.href);await route.abort();return;}
   if(mockGo&&url.pathname==='/api/health'){mockedHealth++;const response=await route.fetch();await route.fulfill({response,json:{...(await response.json()),available:false,goVersion:'未找到 Go',race:false,raceReason:'production smoke: no Go'}});return;}
   await route.continue();
  });
  context.on('page',page=>page.on('pageerror',error=>pageErrors.push(error.message)));
  return {context,healthCalls:()=>mockedHealth};
 }
 const {context}=await guardedContext();const page=await context.newPage();await mkdir(screenshots,{recursive:true});
 await page.goto(origin);await expect(page.getByRole('heading',{name:/写得出来/})).toBeVisible();
 await expect(page.locator('.module-card')).toHaveCount(10);
 await page.screenshot({path:screenshots+'/intro-home.png',fullPage:true});
 await page.goto(origin+'/#lesson/24');await page.getByRole('button',{name:'动手观察',exact:true}).click();await expect(page.getByTestId('live-model')).toBeVisible();
 await page.screenshot({path:screenshots+'/intro-lesson.png',fullPage:true});
 await page.getByRole('button',{name:/Go 架构师 100 题/}).click();
 await expect(page.getByRole('button',{name:/Go 架构师 100 题/})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.module-card')).toHaveCount(10);await expect(page.locator('.lesson-row').first()).toContainText('101');
 await page.screenshot({path:screenshots+'/architecture-home.png',fullPage:true});
 for(const id of [101,200]){
  await page.goto(origin+'/#lesson/'+id);await expect(page.locator('.lesson-heading .eyebrow')).toContainText(String(id));
  await expect(page.getByRole('textbox',{name:'架构决策记录'})).toBeVisible();await expect(page.locator('.cm-content')).toHaveCount(0);
  await page.getByRole('button',{name:'先做预测',exact:true}).click();await expect(page.getByTestId('mermaid-diagram')).toHaveCount(0);
 }
 await page.getByRole('button',{name:'迁移与复测',exact:true}).click();await page.getByRole('button',{name:'回到本路径第一课',exact:true}).click();await expect(page).toHaveURL(new RegExp('#lesson/101$'));
 await page.getByRole('button',{name:/Go 入门 100 题/}).click();await expect(page.locator('.lesson-row').first()).toContainText('001');
 await page.goto(origin+'/#lesson/100');await page.getByRole('button',{name:'迁移与复测',exact:true}).click();await page.getByRole('button',{name:'回到本路径第一课',exact:true}).click();await expect(page).toHaveURL(new RegExp('#lesson/1$'));
 for(const id of [101,131,175,197]){
  await page.goto(origin+'/#lesson/'+id);await page.getByRole('button',{name:'理解机制',exact:true}).click();
  await expect(page.locator('.learning-column [data-testid="mermaid-diagram"] svg').first()).toBeVisible();await expect(page.locator('.diagram-fallback')).toHaveCount(0);
  await page.locator('.learning-column').screenshot({path:`${screenshots}/diagram-${id}.png`});
 }
 const marker='production decision '+Date.now();await page.goto(origin+'/#lesson/101');await page.getByRole('textbox',{name:'架构决策记录'}).fill(marker);await expect(page.locator('.decision-notebook')).toContainText('已保存');
 await page.reload();await expect(page.getByRole('textbox',{name:'架构决策记录'})).toHaveValue(marker);
 const entry={lessonId:7,version:1,step:4,visited:true,completed:false,favorite:true,draft:'// production old backup',attempts:[],revealed:[],helpUsed:[],reviewLevel:0,updatedAt:new Date().toISOString()};
 async function restoreUi(backup,name,count){
  await page.goto(origin+'/#records');await expect(page.getByRole('button',{name:'恢复备份',exact:true})).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.getByRole('button',{name:'恢复记录',exact:true}).click();await expect(page.getByText(`已恢复 ${count} 节记录；被替换的记录已存入本地历史。`,{exact:true})).toBeVisible();
 }
 // Old schema-1 backups need neither architecture entries nor an archives property.
 await restoreUi({format:'go-100-lab',schemaVersion:1,progress:[entry]},'old-backup.json',1);
 const restoredOld=await api('/progress/7');assert.equal(restoredOld.draft,entry.draft);assert.equal(restoredOld.step,4);assert.equal(restoredOld.favorite,true);
 assert.equal((await api('/progress/101')).feynman,marker,'Old backup must not erase unrelated architecture progress');
 const modern=await api('/backup');assert.ok(modern.progress.some(p=>p.lessonId<=100)&&modern.progress.some(p=>p.lessonId>100),'Full backup must include both learning paths');
 const intro={...restoredOld,draft:'// production new backup'},architecture={...(await api('/progress/101')),feynman:marker+' restored'},last={...(await api('/progress/200')),feynman:'last decision restored',favorite:true};
 await restoreUi({...modern,progress:[intro,architecture,last],archives:[]},'two-path-backup.json',3);
 assert.equal((await api('/progress/7')).draft,intro.draft);assert.equal((await api('/progress/101')).feynman,architecture.feynman);assert.equal((await api('/progress/200')).feynman,last.feynman);
 const finalBackup=await api('/backup');assert.ok(finalBackup.archives.some(a=>a.id===101),'Restore must retain replaced architecture records');
 await page.goto(origin+'/#lesson/101');await expect(page.getByRole('textbox',{name:'架构决策记录'})).toHaveValue(architecture.feynman);
 await page.goto(origin+'/#lesson/200');await expect(page.getByRole('textbox',{name:'架构决策记录'})).toHaveValue(last.feynman);
 const rejection=await fetch(origin+'/api/runs',{method:'POST',headers,body:JSON.stringify({lessonId:101,code:'package main\nfunc main(){}',mode:'run'})});assert.equal(rejection.status,422);
 const noGo=await guardedContext(true),noGoPage=await noGo.context.newPage();await noGoPage.setViewportSize({width:390,height:844});
 for(const id of [101,200]){
  await noGoPage.goto(origin+'/#lesson/'+id);await expect(noGoPage.getByRole('textbox',{name:'架构决策记录'})).toBeVisible();await expect(noGoPage.locator('.cm-content')).toHaveCount(0);
  await noGoPage.getByRole('button',{name:'理解机制',exact:true}).click();await expect(noGoPage.locator('.learning-column [data-testid="mermaid-diagram"] svg').first()).toBeVisible();
  assert.ok(await noGoPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile page must not overflow horizontally');
 }
 assert.ok(noGo.healthCalls()>0,'Missing-Go health simulation was not exercised');
 await noGoPage.screenshot({path:screenshots+'/no-go-mobile.png',fullPage:true});
 assert.deepEqual(external,[],'Production assets attempted to access external origins');assert.deepEqual(pageErrors,[],'Browser runtime errors');
 console.log(JSON.stringify({production:'PASS',port,dataDir,twoPaths:'PASS',decisionLessons:[101,200],renderedDiagrams:[101,131,175,197],offlineAssets:'PASS',missingGoDecisionUi:'PASS (health mocked)',oldBackupRestore:'PASS',twoPathBackupRestore:'PASS',draftReload:'PASS',go:health.goVersion,race:health.race,screenshots}));
}finally{
 await browser?.close();
 if(server.exitCode===null&&!spawnError){await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill();resolve()},8000);server.once('exit',()=>{clearTimeout(timer);resolve()});if(server.connected)server.send({type:'shutdown'},()=>{});else server.kill();});}
}
