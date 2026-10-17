import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app';
import {Store} from '../server/store';
import {emptyProgress,independent} from '../src/learning';
import {getLesson} from '../src/content/catalog';

const host='127.0.0.1:4317';
async function withApp(fn:(ctx:Awaited<ReturnType<typeof createApp>>)=>Promise<void>){const ctx=await createApp({store:new Store(':memory:'),skipCapabilities:true});try{await fn(ctx);}finally{await ctx.app.close();}}

test('API 校验 Host、Origin、Fetch Metadata 和会话令牌',async()=>withApp(async({app,token})=>{
 const session=await app.inject({url:'/api/session',headers:{host}});
 assert.equal(session.statusCode,200);assert.equal(session.json().token,token);
 for(const headers of [{host:'attacker.example:4317'},{host,origin:'https://attacker.example'},{host,'sec-fetch-site':'cross-site'}]){
  const r=await app.inject({url:'/api/session',headers});assert.equal(r.statusCode,403);
 }
 for(const supplied of [undefined,'wrong-token','a'.repeat(64),'界'.repeat(64)]){
  const r=await app.inject({url:'/api/health',headers:{host,...(supplied?{'x-lab-token':supplied}:{})}});
  assert.equal(r.statusCode,401,'错误令牌应统一拒绝，包括相同字符数但字节数不同的输入');
 }
 const health=await app.inject({url:'/api/health',headers:{host,origin:'http://localhost:4318','x-lab-token':token}});
 assert.equal(health.statusCode,200);assert.equal(health.json().localOnly,true);assert.equal(health.json().race,false);
}));

test('API 只接收课程模板、源码和固定执行模式',async()=>withApp(async({app,token,runner})=>{
 const headers={host,'x-lab-token':token};
 const valid={lessonId:31,exampleId:'main',code:'package main\nfunc main(){}',mode:'run'};
 const invalid=[{...valid,exampleId:'../../outside.go'},{...valid,mode:'run; whoami'},{...valid,lessonId:201},{...valid,lessonId:'../31'},{...valid,code:{path:'C:/Windows/system.ini'}},{...valid,code:'x'.repeat(65537)}];
 for(const payload of invalid){const r=await app.inject({method:'POST',url:'/api/runs',headers,payload});assert.equal(r.statusCode,400);assert.equal(runner.active,null);}
 const race=await app.inject({method:'POST',url:'/api/runs',headers,payload:{...valid,mode:'race'}});
 assert.equal(race.statusCode,422);assert.equal(runner.active,null,'缺少 race 条件是能力状态，不启动失败任务');
 const unknown=await app.inject({url:`/api/runs/${randomUUID()}`,headers});assert.equal(unknown.statusCode,404);
 const badId=await app.inject({url:'/api/runs/not-a-uuid',headers});assert.equal(badId.statusCode,400);
}));

test('服务器自行判题，客户端不能伪造 correct、assisted、version 或已有作答',async()=>withApp(async({app,token})=>{
 const headers={host,'x-lab-token':token},lesson=await getLesson(31),q=lesson.questions.find(x=>x.stage==='transfer')!;
 const forged=await app.inject({method:'POST',url:'/api/progress/31/attempt',headers,payload:{questionId:q.id,answer:['not-an-answer'],correct:true,assisted:false,version:999}});
 assert.equal(forged.statusCode,200);const attempt=forged.json().attempt;
 assert.equal(attempt.correct,false);assert.equal(attempt.version,lesson.version);assert.equal(attempt.assisted,false);
 const patch=await app.inject({method:'PATCH',url:'/api/progress/31',headers,payload:{favorite:true,attempts:[{...attempt,correct:true}],revealed:[],reviewLevel:3}});
 assert.equal(patch.statusCode,200);assert.equal(patch.json().favorite,true);assert.equal(patch.json().attempts[0].correct,false);
 const corrected=await app.inject({method:'POST',url:'/api/progress/31/attempt',headers,payload:{questionId:q.id,answer:q.answer,assisted:false}});
 assert.equal(corrected.statusCode,200);assert.equal(corrected.json().attempt.correct,true);assert.equal(corrected.json().attempt.assisted,true);
 assert.equal(independent(corrected.json().progress),false,'先提交过的题不能作为全新独立证据');
 const missing=await app.inject({method:'POST',url:'/api/progress/31/attempt',headers,payload:{questionId:'99:retest',answer:['fake']}});
 assert.equal(missing.statusCode,400);
}));

test('提示和揭示答案与独立复测证据分离，草稿及步骤可以保存',async()=>withApp(async({app,token})=>{
 const headers={host,'x-lab-token':token},lesson=await getLesson(32),q=lesson.questions.find(x=>x.stage==='transfer')!,retest=lesson.questions.find(x=>x.stage==='retest')!;
 await app.inject({method:'POST',url:'/api/progress/32/help',headers,payload:{mode:'steps',questionId:q.id}});
 const assisted=await app.inject({method:'POST',url:'/api/progress/32/attempt',headers,payload:{questionId:q.id,answer:q.answer}});
 assert.equal(assisted.json().attempt.assisted,true);assert.equal(independent(assisted.json().progress),false);
 const fresh=await app.inject({method:'POST',url:'/api/progress/32/attempt',headers,payload:{questionId:retest.id,answer:retest.answer}});
 assert.equal(fresh.json().attempt.assisted,false);assert.equal(independent(fresh.json().progress),true);
 await app.inject({method:'POST',url:'/api/progress/33/reveal',headers,payload:{questionId:'solution'}});
 const revealed=await app.inject({url:'/api/progress/33',headers});
 assert.equal(revealed.json().revealed.length,5);assert.ok(!revealed.json().revealed.includes('33:retest'));
 const draft='package main\n// 保留原始草稿与换行\n';
 const saved=await app.inject({method:'PATCH',url:'/api/progress/32',headers,payload:{step:4,draft,visited:true,favorite:true}});
 assert.equal(saved.statusCode,200);
 const read=await app.inject({url:'/api/progress/32',headers});
 assert.equal(read.json().draft,draft);assert.equal(read.json().step,4);assert.equal(read.json().attempts.length,2);
}));

test('备份先完整验证再恢复，保留历史归档及导入前记录',async()=>withApp(async({app,token,store})=>{
 const headers={host,'x-lab-token':token};
 const current={...emptyProgress(31),favorite:true,draft:'existing draft'};store.save(current);
 const good={format:'go-100-lab',schemaVersion:1,progress:[{...emptyProgress(31),step:3,draft:'restored draft'}]};
 for(const payload of [{...good,format:'other'},{...good,schemaVersion:999},{...good,progress:[{...good.progress[0],step:9}]},{...good,progress:[good.progress[0],good.progress[0]]}]){
  const rejected=await app.inject({method:'POST',url:'/api/backup',headers,payload});assert.equal(rejected.statusCode,400);assert.equal(store.get(31).draft,'existing draft');
 }
 const source=new Store(':memory:');
 let archiveBackup:ReturnType<Store['backup']>;
 try {source.save({...emptyProgress(32),draft:'version one draft'});source.get(32,2);archiveBackup=source.backup();}finally{source.close();}
 const imported=await app.inject({method:'POST',url:'/api/backup',headers,payload:{...good,archives:archiveBackup.archives}});
 assert.equal(imported.statusCode,200);assert.equal(imported.json().imported,1);assert.equal(store.get(31).draft,'restored draft');
 const exported=await app.inject({url:'/api/backup',headers});assert.equal(exported.statusCode,200);
 const backup=exported.json();assert.equal(backup.format,'go-100-lab');assert.equal(backup.schemaVersion,1);
 assert.ok(backup.archives.some((x:{id:number;body:string})=>x.id===31&&JSON.parse(x.body).draft==='existing draft'),'覆盖前记录归档，便于恢复');
 assert.ok(backup.archives.some((x:{id:number;body:string})=>x.id===32&&JSON.parse(x.body).draft==='version one draft'),'导入备份中的历史归档也必须保留');
}));

test('SQLite 重启保留学习记录，将未完成任务标为 interrupted',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'go100-store-test-')),path=join(dir,'learning.sqlite');
 let store:Store|undefined;
 try {
  store=new Store(path);store.save({...emptyProgress(35),step:4,draft:'persistent draft',favorite:true});
  const pending=['queued','compiling','running'].map(status=>({id:randomUUID(),lessonId:35,mode:'run',status,stdout:'partial',stderr:'',exitCode:null,createdAt:new Date().toISOString(),durationMs:0,phase:'运行'}));
  const success={...pending[0],id:randomUUID(),status:'success',stdout:'complete'};
  for(const r of [...pending,success])store.saveRun(r);
  store.close();store=new Store(path);
  assert.equal(store.get(35).draft,'persistent draft');assert.equal(store.get(35).step,4);assert.equal(store.get(35).favorite,true);
  for(const r of pending){const saved=store.run(r.id);assert.equal(saved.status,'interrupted');assert.equal(saved.stdout,'partial');assert.match(saved.stderr,/服务重启/);}
  assert.equal(store.run(success.id).status,'success');
 }finally{store?.close();const absolute=resolve(dir);assert.ok(absolute.startsWith(resolve(tmpdir())+sep));await rm(absolute,{recursive:true,force:true,maxRetries:4,retryDelay:100});}
});
