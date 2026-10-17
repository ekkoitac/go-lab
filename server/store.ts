import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {emptyProgress} from '../src/learning';
import type {Progress} from '../src/content/types';
export class Store {
 db:DatabaseSync;
 constructor(path=resolve(process.env.GO100_DATA_DIR??'data','learning.sqlite')){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS archived_progress (id INTEGER, version INTEGER, body TEXT, at TEXT); CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, body TEXT NOT NULL);');for(const row of this.db.prepare('SELECT id,body FROM runs').all() as {id:string;body:string}[]){const r=JSON.parse(row.body);if(['queued','compiling','running'].includes(r.status)){r.status='interrupted';r.stderr+='\n服务重启：上次执行已中断，请重新运行。';this.saveRun(r);}}}
 all():Progress[]{return (this.db.prepare('SELECT body FROM progress').all() as {body:string}[]).map(x=>JSON.parse(x.body));}
 get(id:number,version=1){const row=this.db.prepare('SELECT body FROM progress WHERE id=?').get(id) as {body:string}|undefined;let p:Progress=row?JSON.parse(row.body):emptyProgress(id,version);if(p.version!==version){this.db.prepare('INSERT INTO archived_progress VALUES(?,?,?,?)').run(id,p.version,JSON.stringify(p),new Date().toISOString());p={...emptyProgress(id,version),favorite:p.favorite,draft:p.draft,attempts:p.attempts};this.save(p);}return p;}
 save(p:Progress){const previous=this.db.prepare('SELECT body FROM progress WHERE id=?').get(p.lessonId) as {body:string}|undefined;const last=previous?Date.parse(JSON.parse(previous.body).updatedAt):0;p.updatedAt=new Date(Math.max(Date.now(),Number.isFinite(last)?last+1:0)).toISOString();this.db.prepare('INSERT INTO progress VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(p.lessonId,JSON.stringify(p));return p;}
 saveRun(r:{id:string;[k:string]:unknown}){this.db.prepare('INSERT INTO runs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(r.id,JSON.stringify(r));}
 run(id:string){const row=this.db.prepare('SELECT body FROM runs WHERE id=?').get(id) as {body:string}|undefined;return row?JSON.parse(row.body):null;}
 backup(){return {format:'go-100-lab',schemaVersion:1,exportedAt:new Date().toISOString(),progress:this.all(),archives:this.db.prepare('SELECT * FROM archived_progress').all()};}
 restore(records:Progress[],archives:{id:number;version:number;body:string;at:string}[]=[]){this.db.exec('BEGIN');try{for(const p of records){const old=this.db.prepare('SELECT body FROM progress WHERE id=?').get(p.lessonId) as {body:string}|undefined;if(old)this.db.prepare('INSERT INTO archived_progress VALUES(?,?,?,?)').run(p.lessonId,JSON.parse(old.body).version,old.body,new Date().toISOString());this.save(p);}for(const a of archives){const exists=this.db.prepare('SELECT 1 FROM archived_progress WHERE id=? AND version=? AND body=? AND at=?').get(a.id,a.version,a.body,a.at);if(!exists)this.db.prepare('INSERT INTO archived_progress VALUES(?,?,?,?)').run(a.id,a.version,a.body,a.at);}this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
 close(){this.db.close();}
}
