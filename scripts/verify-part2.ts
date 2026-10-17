import {isCodeLesson} from '../src/content/types';
import m4 from '../src/content/module04';
import m5 from '../src/content/module05';
import m6 from '../src/content/module06';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'go100-part2-'));
let failures=0; let checked=0;
try {
const only=process.argv.slice(2).map(Number); for(const l of [...m4,...m5,...m6].filter(isCodeLesson).filter(l=>!only.length||only.includes(l.id))) {
  for(const kind of ['solution','code'] as const) {
    writeFileSync(join(dir,'main.go'),l[kind]);
    const build=spawnSync('go',['build','-o',join(dir,'demo.exe'),join(dir,'main.go')],{cwd:dir,encoding:'utf8',timeout:60000,env:{...process.env,GOTOOLCHAIN:'local',GOPROXY:'off',GOSUMDB:'off'}});
    const r=build.status===0?spawnSync(join(dir,'demo.exe'),[],{cwd:dir,encoding:'utf8',timeout:5000,maxBuffer:256*1024}):build;
    const actual=r.stdout?.trim();
    const expected=kind==='solution'?l.expectedOutput:l.starterOutput;
    const ok=expected!==undefined?r.status===0&&actual===expected:(l.starterFailure==='compile'?build.status!==0:l.starterFailure==='timeout'?!!r.error:r.status!==0);
    if(!ok) {failures++; console.error(l.id,kind,{expected,actual,status:r.status,err:r.stderr,error:r.error});}
  }
  checked++; console.log(`checked ${l.id} ${l.title}`);
}
} finally {rmSync(dir,{recursive:true,force:true});}
console.log(`${checked} lessons / ${checked*2} programs: ${failures} failures`);
process.exitCode=failures?1:0;


