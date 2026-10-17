import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app';
import {Store} from '../server/store';
import {emptyProgress,independent} from '../src/learning';
import {catalog,courses,lessonsForCourse,nextLesson,isLessonId,getLesson,allLessons} from '../src/content/catalog';
import {Runner} from '../server/runner';
const host='127.0.0.1:4317';
test('两条路径稳定分离，末课留在自己的路径',()=>{
 assert.equal(catalog.length,200);assert.equal(courses.length,2);
 assert.deepEqual(lessonsForCourse('intro').map(l=>l.id),Array.from({length:100},(_,i)=>i+1));
 assert.deepEqual(lessonsForCourse('architecture').map(l=>l.id),Array.from({length:100},(_,i)=>i+101));
 assert.equal(nextLesson(100),1);assert.equal(nextLesson(200),101);assert.equal(nextLesson(101),102);
 for(const id of [0,201,NaN,101.5,Infinity])assert.equal(isLessonId(id),false);
});
test('旧课程保持原ID和版本；架构课具备独立的案例与图解',async()=>{
 const all=await allLessons();assert.equal(all.length,200);
 assert.ok(all.filter(l=>l.id<=100).every(l=>l.version===1&&l.practice!=='decision'));
 const architecture=all.filter(l=>l.id>100);
 assert.equal(new Set(architecture.map(l=>l.scenario)).size,100);
 assert.equal(new Set(architecture.map(l=>l.questions[4].prompt)).size,100);
 assert.ok(architecture.every(l=>l.diagrams?.length&&l.decision?.options.length));
 assert.ok(architecture.some(l=>l.practice==='go')&&architecture.some(l=>l.practice==='decision'));
});
test('新课API、决策草稿和辅助证据独立；拒绝决策课代码执行',async()=>{
 const ctx=await createApp({store:new Store(':memory:'),skipCapabilities:true});const {app,token,runner}=ctx,headers={host,'x-lab-token':token};
 try{
  const lesson=await getLesson(101);assert.equal(lesson.practice,'decision');
  const draft=await app.inject({method:'PATCH',url:'/api/progress/101',headers,payload:{visited:true,step:4,feynman:'选择模块化单体；验证交付周期；接受进程内故障域。'}});assert.equal(draft.statusCode,200);
  const q=lesson.questions[4];
  await app.inject({method:'POST',url:'/api/progress/101/help',headers,payload:{mode:'diagram',questionIds:[q.id]}});
  const attempted=await app.inject({method:'POST',url:'/api/progress/101/attempt',headers,payload:{questionId:q.id,answer:q.answer}});
  assert.equal(attempted.statusCode,200);assert.equal(independent(attempted.json().progress),false);
  const run=await app.inject({method:'POST',url:'/api/runs',headers,payload:{lessonId:101,code:'package main;func main(){}',mode:'run'}});
  assert.equal(run.statusCode,422);assert.equal(runner.active,null);
  assert.throws(()=>new Runner().start(lesson,'package main;func main(){}','run'),/决策实践/);
  const p=(await app.inject({url:'/api/progress/101',headers})).json();assert.match(p.feynman,/模块化单体/);
  assert.equal((await app.inject({url:'/api/progress/200',headers})).statusCode,200);
  assert.equal((await app.inject({url:'/api/progress/201',headers})).statusCode,400);
 }finally{await app.close();}
});
test('200课备份与旧备份兼容，恢复入门课不会覆盖架构记录',async()=>{
 const ctx=await createApp({store:new Store(':memory:'),skipCapabilities:true});const {app,token,store}=ctx,headers={host,'x-lab-token':token};
 try{
  const records=catalog.map(c=>({...emptyProgress(c.id),feynman:c.id>100?'决策-'+c.id:undefined,draft:c.id<=100?'code-'+c.id:undefined}));
  const r=await app.inject({method:'POST',url:'/api/backup',headers,payload:{format:'go-100-lab',schemaVersion:1,progress:records}});assert.equal(r.statusCode,200);assert.equal(r.json().imported,200);
  const old=await app.inject({method:'POST',url:'/api/backup',headers,payload:{format:'go-100-lab',schemaVersion:1,progress:[{...emptyProgress(1),draft:'old restored'}]}});
  assert.equal(old.statusCode,200);assert.equal(store.get(101).feynman,'决策-101');assert.equal(store.get(1).draft,'old restored');
  const backup=(await app.inject({url:'/api/backup',headers})).json();assert.equal(backup.progress.length,200);assert.ok(backup.archives.some((a:{id:number})=>a.id===1));
  const bad=await app.inject({method:'POST',url:'/api/backup',headers,payload:{format:'go-100-lab',schemaVersion:1,progress:[{...emptyProgress(101),feynman:'must not persist'},emptyProgress(201)]}});
  assert.equal(bad.statusCode,400);assert.equal(store.get(101).feynman,'决策-101');
 }finally{await app.close();}
});
