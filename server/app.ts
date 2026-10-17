import {localHosts} from './ports';
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';
import {z} from 'zod';
import {Store} from './store';
import {Runner,capabilities,formatGo} from './runner';
import {getLesson,catalog,isLessonId} from '../src/content/catalog';
import {recordAttempt} from '../src/learning';
const idSchema=z.coerce.number().int().refine(isLessonId,'课程不存在');
const stringList=z.array(z.string().max(10000)).max(500);
const attemptSchema=z.object({questionId:z.string().max(100),answer:stringList,correct:z.boolean(),assisted:z.boolean(),at:z.iso.datetime(),version:z.number().int().min(1)});
const progressSchema=z.object({lessonId:idSchema,version:z.number().int().min(1),step:z.number().int().min(0).max(5),visited:z.boolean(),completed:z.boolean(),favorite:z.boolean(),draft:z.string().max(65536).optional(),attempts:z.array(attemptSchema).max(10000),revealed:stringList,helpUsed:stringList,reviewLevel:z.number().int().min(0).max(3),nextReview:z.iso.datetime().optional(),feynman:z.string().max(20000).optional(),feynmanChecks:stringList.optional(),updatedAt:z.iso.datetime()});
export async function createApp(options:{store?:Store;production?:boolean;skipCapabilities?:boolean}={}){
 const app=Fastify({logger:false,bodyLimit:10*1024*1024});
 const store=options.store??new Store(),runner=new Runner(r=>store.saveRun(r));
 const token=randomBytes(32).toString('hex'),origins=new Set(localHosts.map(host=>'http://'+host)),hosts=new Set(localHosts);
 let caps=options.skipCapabilities?{goVersion:'test',available:true,race:false,raceReason:'test'}:await capabilities();
 app.addHook('onRequest',async(req,reply)=>{if(!hosts.has(req.headers.host??''))return reply.code(403).send({error:'无效 Host'});const origin=req.headers.origin;if(origin&&!origins.has(origin))return reply.code(403).send({error:'不允许跨站访问本机执行服务'});if(req.headers['sec-fetch-site']==='cross-site')return reply.code(403).send({error:'不允许跨站访问'});if(req.url.startsWith('/api/')&&!req.url.startsWith('/api/session')){const h=String(req.headers['x-lab-token']??'');if(Buffer.byteLength(h)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(h),Buffer.from(token)))return reply.code(401).send({error:'会话已失效，请刷新页面'});}});
 app.setErrorHandler((error,_req,reply)=>{if(error instanceof z.ZodError)return reply.code(400).send({error:'输入格式不正确',details:error.issues.map(x=>x.message)});reply.code(error instanceof Error && 'statusCode' in error ? Number(error.statusCode) : 400).send({error:error instanceof Error?error.message:String(error)});});
 app.get('/api/session',async()=>({token}));
 app.get('/api/health',async()=>({...caps,localOnly:true,busy:!!runner.active}));
 app.get('/api/progress',async()=>Promise.all(store.all().map(async p=>store.get(p.lessonId,(await getLesson(p.lessonId)).version))));
 app.get('/api/progress/:id',async(req)=>{const id=idSchema.parse((req.params as {id:string}).id),lesson=await getLesson(id);return store.get(id,lesson.version);});
 app.patch('/api/progress/:id',async(req)=>{const id=idSchema.parse((req.params as {id:string}).id),lesson=await getLesson(id),patch=progressSchema.pick({step:true,visited:true,completed:true,favorite:true,draft:true,feynman:true,feynmanChecks:true}).partial().parse(req.body);return store.save({...store.get(id,lesson.version),...patch});});
 app.post('/api/progress/:id/attempt',async(req)=>{const id=idSchema.parse((req.params as {id:string}).id),lesson=await getLesson(id),body=z.object({questionId:z.string(),answer:stringList}).parse(req.body),q=lesson.questions.find(q=>q.id===body.questionId);if(!q)throw Error('题目不存在');const p=store.get(id,lesson.version),attempt=recordAttempt(p,q,body.answer);return {attempt,progress:store.save(p)};});
 app.post('/api/progress/:id/help',async(req)=>{const id=idSchema.parse((req.params as {id:string}).id),lesson=await getLesson(id),body=z.object({mode:z.enum(['example','diagram','steps','try']),questionId:z.string().optional(),questionIds:z.array(z.string()).max(6).optional()}).parse(req.body);const ids=body.questionIds??(body.questionId?[body.questionId]:[]);if(ids.some(id=>!lesson.questions.some(q=>q.id===id)))throw Error('题目不存在');const p=store.get(id,lesson.version);p.helpUsed.push(...(ids.length?ids:['lesson']).map(id=>id+'|'+body.mode));return store.save(p);});
 app.post('/api/progress/:id/reveal',async(req)=>{const id=idSchema.parse((req.params as {id:string}).id),lesson=await getLesson(id),body=z.object({questionId:z.string()}).parse(req.body),p=store.get(id,lesson.version);const ids=body.questionId==='solution'?lesson.questions.filter(q=>q.stage!=='retest').map(q=>q.id):lesson.questions.filter(q=>q.id===body.questionId).map(q=>q.id);if(!ids.length)throw Error('题目不存在');p.revealed=[...new Set([...p.revealed,...ids])];return store.save(p);});
 app.get('/api/backup',async()=>store.backup());
 app.post('/api/backup',async(req)=>{const body=z.object({format:z.literal('go-100-lab'),schemaVersion:z.literal(1),progress:z.array(progressSchema).max(catalog.length),archives:z.array(z.object({id:idSchema,version:z.number().int().min(1),body:z.string().max(2000000),at:z.string()})).max(1000).optional()}).parse(req.body);if(new Set(body.progress.map(x=>x.lessonId)).size!==body.progress.length)throw Error('备份包含重复课程');for(const a of body.archives??[]){const archived=progressSchema.parse(JSON.parse(a.body));if(archived.lessonId!==a.id||archived.version!==a.version)throw Error('历史记录标识不匹配');}store.restore(body.progress,body.archives);return {imported:body.progress.length};});
 app.post('/api/runs',async(req,reply)=>{const body=z.object({lessonId:idSchema,exampleId:z.literal('main').default('main'),code:z.string().min(1).max(65536),mode:z.enum(['run','test','race','bench'])}).parse(req.body);const lesson=await getLesson(body.lessonId);if(lesson.practice==='decision')return reply.code(422).send({error:'本课为决策实践，没有 Go 运行任务'});if(!caps.available)return reply.code(503).send({error:'未找到 Go，请配置 GO100_GO_PATH 后重启服务'});if(body.mode==='race'&&!caps.race)return reply.code(422).send({error:caps.raceReason});if(runner.active)return reply.code(409).send({error:'已有任务运行中，请等待或取消'});return runner.start(lesson,body.code,body.mode);});
 app.get('/api/runs/:id',async(req,reply)=>{const id=z.string().uuid().parse((req.params as {id:string}).id),r=runner.records.get(id)??store.run(id);return r??reply.code(404).send({error:'运行记录不存在'});});
 app.delete('/api/runs/:id',async(req)=>({cancelled:await runner.cancel(z.string().uuid().parse((req.params as {id:string}).id))}));
 app.post('/api/format',async(req)=>({code:await formatGo(z.object({code:z.string().max(65536)}).parse(req.body).code)}));
 if(options.production){await app.register(staticPlugin,{root:resolve('dist')});app.setNotFoundHandler((req,reply)=>req.url.startsWith('/api/')?reply.code(404).send({error:'接口不存在'}):reply.sendFile('index.html'));}
 app.addHook('onClose',async()=>{if(runner.active){await runner.cancel(runner.active.record.id);for(let i=0;i<100&&runner.active;i++)await new Promise(r=>setTimeout(r,50));}store.close();});
 return {app,store,runner,token};
}
