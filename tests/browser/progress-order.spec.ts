import {test,expect,type APIRequestContext,type APIResponse,type Page,type Response} from '@playwright/test';
import type {Progress} from '../../src/content/types';
import {emptyProgress} from '../../src/learning';

function deferred<T>(){
 let resolve!:(value:T)=>void;
 const promise=new Promise<T>(done=>{resolve=done;});
 return {promise,resolve:(value:T)=>resolve(value)};
}

async function seed(request:APIRequestContext,id:number){
 const session=await request.get('/api/session');
 expect(session.ok()).toBeTruthy();
 const {token}=await session.json() as {token:string};
 const headers={'x-lab-token':token};
 const current=await request.get('/api/progress/'+id,{headers});
 expect(current.ok()).toBeTruthy();
 const {version}=await current.json() as Progress;
 // This suite uses the dedicated E2E database. Reset only its own lesson so
 // repeated runs never inherit assistance, attempts, or cached draft state.
 const restored=await request.post('/api/backup',{headers,data:{
  format:'go-100-lab',schemaVersion:1,progress:[emptyProgress(id,version)]
 }});
 expect(restored.ok()).toBeTruthy();
 const response=await request.patch('/api/progress/'+id,{headers,data:{step:0,visited:true}});
 expect(response.ok()).toBeTruthy();
 return {headers,progress:await response.json() as Progress};
}

async function consumed(page:Page,response:Response){
 // The response is deliberately released only after the newer snapshot is visible.
 // Drain its body and two paint turns so an assertion cannot pass before React applies it.
 await response.finished();
 await page.evaluate(()=>new Promise<void>(resolve=>{
  requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()));
 }));
}

test('迟到的 visited PATCH 快照不能把已选择的观察步骤退回场景',async({page,request})=>{
 const id=102;
 const {headers}=await seed(request,id);
 const held=deferred<void>(),captured=deferred<Progress>();
 let intercepted=false;
 await page.route('**/api/progress/'+id,async route=>{
  const req=route.request();
  const body=req.method()==='PATCH'?req.postDataJSON():null;
  if(!intercepted&&body?.visited===true&&body.step===undefined){
   intercepted=true;
   // Commit the automatic visit first; hold only delivery of its old step=0 snapshot.
   const response=await route.fetch();
   const snapshot=await response.json() as Progress;
   captured.resolve(snapshot);
   await held.promise;
   await route.fulfill({response,json:snapshot});
  }else await route.continue();
 });
 try{
  await page.goto('/#lesson/'+id);
  await expect(page.locator('.lesson-heading .eyebrow')).toContainText('LESSON 102');
  const old=await captured.promise;
  expect(old.step).toBe(0);
  const observation=page.getByRole('button',{name:'动手观察',exact:true});
  await observation.click();
  await expect(observation).toHaveClass('active');
  await expect(page.getByTestId('experiment-scene')).toBeVisible();
  const saved=await (await request.get('/api/progress/'+id,{headers})).json() as Progress;
  expect(saved.step).toBe(2);
  expect(saved.updatedAt>old.updatedAt).toBeTruthy();

  const arriving=page.waitForResponse(response=>{
   const req=response.request();
   return new URL(response.url()).pathname==='/api/progress/'+id&&
    req.method()==='PATCH'&&req.postDataJSON()?.visited===true;
  });
  held.resolve(undefined);
  await consumed(page,await arriving);
  await expect(observation).toHaveClass('active');
  await expect(page.getByTestId('experiment-scene')).toBeVisible();
 }finally{
  held.resolve(undefined);
 }
});

test('迟到的首屏 progress 整批快照不能覆盖新步骤和已保存求助证据',async({page,request})=>{
 const id=103;
 const {headers,progress:before}=await seed(request,id);
 const held=deferred<void>(),captured=deferred<Progress[]>();
 let initialResponse:Promise<APIResponse>|undefined;
 await page.route('**/api/progress',async route=>{
  if(route.request().method()==='GET'){
   // StrictMode may start two initial reads. Deliver the same real, frozen old
   // snapshot to both so a second initialization cannot mask the race.
   initialResponse??=route.fetch();
   const response=await initialResponse;
   const snapshot=await response.json() as Progress[];
   captured.resolve(snapshot);
   await held.promise;
   await route.fulfill({response,json:snapshot});
  }else await route.continue();
 });
 try{
  await page.goto('/#lesson/'+id);
  await expect(page.locator('.lesson-heading .eyebrow')).toContainText('LESSON 103');
  const old=(await captured.promise).find(p=>p.lessonId===id)!;
  expect(old.step).toBe(0);
  expect(old.helpUsed).toHaveLength(before.helpUsed.length);
  await expect(page.locator('.local-badge')).toContainText('连接本机服务中');

  const transfer=page.getByRole('button',{name:'迁移与复测',exact:true});
  await transfer.click();
  await expect(transfer).toHaveClass('active');
  await page.getByRole('button',{name:'拆步骤',exact:true}).click();
  await expect(page.locator('.help-content')).toBeVisible();
  const saved=await (await request.get('/api/progress/'+id,{headers})).json() as Progress;
  expect(saved.step).toBe(5);
  expect(saved.helpUsed).toHaveLength(before.helpUsed.length+2);
  expect(saved.helpUsed.slice(-2)).toEqual(['103:transfer|steps','103:retest|steps']);
  const evidence=page.locator('.lesson-evidence > span').last();
  const expectedEvidence=`${saved.attempts.length} 次作答 · ${saved.helpUsed.length} 次求助`;
  await expect(evidence).toHaveText(expectedEvidence);

  const arriving=page.waitForResponse(response=>
   new URL(response.url()).pathname==='/api/progress'&&response.request().method()==='GET');
  held.resolve(undefined);
  await consumed(page,await arriving);
  // The badge flips only when the initial Promise.all has consumed the delayed batch.
  await expect(page.locator('.local-badge')).toContainText('本地学习 · 数据保存在此设备');
  await expect(transfer).toHaveClass('active');
  await expect(evidence).toHaveText(expectedEvidence);
  await expect(page.locator('.help-content')).toBeVisible();
 }finally{
  held.resolve(undefined);
 }
});



