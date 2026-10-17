import {isCodeLesson} from '../src/content/types';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import m7 from '../src/content/module07';
import m8 from '../src/content/module08';
import m9 from '../src/content/module09';
import m10 from '../src/content/module10';
const ids=process.argv.slice(2).map(Number); const all=[...m7,...m8,...m9,...m10].filter(isCodeLesson).filter(l=>!ids.length||ids.includes(l.id));
let fails=0;
for(const l of all){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'go100-part3-'));
 fs.writeFileSync(path.join(dir,'go.mod'),'module lesson\n\ngo 1.26\n');
 for(const kind of ['code','solution'] as const){
 fs.writeFileSync(path.join(dir,'main.go'),l[kind]);
 const r=spawnSync('go',['run','.'],{cwd:dir,encoding:'utf8',timeout:60000,env:{...process.env,GOTOOLCHAIN:'local',GOPROXY:'off'}});
 const failure=kind==='code'?l.starterFailure:undefined;
 const expected=kind==='code'?l.starterOutput:l.expectedOutput;
 const ok=failure? r.status!==0 : r.status===0&&r.stdout.trim()===expected;
 if(!ok){fails++;console.log('FAIL',l.id,kind,JSON.stringify(r.stdout),r.stderr,r.error?.message)}
 }
 if(l.testCode){fs.writeFileSync(path.join(dir,'lesson_test.go'),l.testCode);const r=spawnSync('go',['test','.'],{cwd:dir,encoding:'utf8',timeout:60000,env:{...process.env,GOTOOLCHAIN:'local',GOPROXY:'off'}});if(r.status!==0){fails++;console.log('TEST FAIL',l.id,r.stdout,r.stderr)}}
 if(!path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(dir).startsWith("go100-part3-"))throw Error("unsafe temp cleanup");fs.rmSync(dir,{recursive:true,force:true});
 console.log('checked',l.id);
}
console.log(`${all.length} lessons checked; ${fails} failures`);process.exitCode=fails?1:0;
