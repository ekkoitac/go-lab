import {apiPort} from './ports';
import {createApp} from './app';
const {app}=await createApp({production:process.argv.includes('--production')});
try{await app.listen({host:'127.0.0.1',port:apiPort});console.log(`Go 100 Lab 本机服务：http://127.0.0.1:${apiPort}`);}catch(e){console.error(`启动失败：请检查 ${apiPort} 端口是否被占用。`,e);process.exit(1);}
let closing=false;async function shutdown(){if(closing)return;closing=true;await app.close();process.exit(0);}
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void shutdown();});
process.on('message',m=>{if(m&&typeof m==='object'&&'type' in m&&m.type==='shutdown')void shutdown();});
process.on('disconnect',()=>{void shutdown();});
