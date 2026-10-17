import {spawn,execFile} from 'node:child_process';
const server=spawn(process.execPath,['--import','tsx','server/index.ts'],{stdio:['inherit','inherit','inherit','ipc'],windowsHide:true});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit',windowsHide:true});
const children=[server,vite];let closing=false;
function force(child){if(!child.pid||child.exitCode!==null)return;if(process.platform==='win32')execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else child.kill('SIGKILL');}
function stop(code=0){if(closing)return;closing=true;if(server.connected)server.send({type:'shutdown'});else force(server);vite.kill();const timeout=setTimeout(()=>{children.forEach(force);process.exit(code)},8000);timeout.unref();server.once('exit',()=>{clearTimeout(timeout);process.exit(code)});}
for(const child of children){child.on('error',e=>{console.error(e);stop(1)});child.on('exit',code=>{if(!closing)stop(code??0)});}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
