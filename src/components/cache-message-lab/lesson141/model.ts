export type Scheme = 'local' | 'shared' | 'layered';
export type Config = {scheme: Scheme; ttl: number; broadcast: boolean; invalidateShared: boolean; immutable: boolean; instances: number};
export type Entry = {price: number; expires: number};
export type Read = {instance: 'A' | 'B'; price: number; source: string; time: number};
export type Snapshot = {phase: number; time: number; database: number; a: Entry | null; b: Entry | null; shared: Entry | null; lastRead: Read | null; reads: Read[]; networkReads: number; databaseReads: number; checkout: number | null; note: string};
export const defaults: Config = {scheme:'local',ttl:60,broadcast:false,invalidateShared:true,immutable:false,instances:30};
export const stages = ['预热：两实例都读过 100 元','t=1：权威价格变更','t=1：执行失效协议','t=2：用户访问 A','t=3：用户切换 B','t=6：检查 5 秒承诺','t=6：提交订单，权威校验','t=121：观察自然过期'];
export function validate(c:Config) {
  if(!['local','shared','layered'].includes(c.scheme)||![3,60].includes(c.ttl)||![3,30,100].includes(c.instances)||typeof c.broadcast!=='boolean'||typeof c.invalidateShared!=='boolean'||typeof c.immutable!=='boolean')throw new Error('Invalid cache experiment configuration');
}
export function inspect(config:Config,phase=0):Snapshot {
  validate(config);if(!Number.isInteger(phase)||phase<0||phase>=stages.length)throw new Error('Invalid phase');
  const local=config.scheme!=='shared';
  const state:Snapshot={phase:0,time:0,database:100,a:local?{price:100,expires:config.ttl}:null,b:local?{price:100,expires:config.ttl}:null,shared:config.scheme!=='local'?{price:100,expires:60}:null,lastRead:null,reads:[],networkReads:0,databaseReads:0,checkout:null,note:'预热不计入本轮读取次数；A、B 代表不同进程。'};
  function read(instance:'A'|'B',time:number) {
    state.time=time;const key=instance==='A'?'a':'b';const entry=state[key];let price:number;let source:string;
    if(local&&entry&&entry.expires>time){price=entry.price;source=`${instance} 的 L1 命中`;}
    else if(config.scheme==='local'){state.databaseReads++;price=state.database;source='本地未命中 → 数据库';state[key]={price,expires:time+config.ttl};}
    else {
      state.networkReads++;
      if(state.shared&&state.shared.expires>time){price=state.shared.price;source='共享缓存命中';}
      else {state.databaseReads++;price=state.database;state.shared={price,expires:time+60};source='共享未命中 → 数据库';}
      if(local){state[key]={price,expires:time+config.ttl};source=`L1 未命中 → ${source}`;}
    }
    state.lastRead={instance,price,source,time};state.reads.push({...state.lastRead});
    state.note=`${instance} 返回 ${price} 元：${source}。${price!==state.database?'此时缓存与权威价格不同。':'本次读取与权威价格相同。'}`;
  }
  for(let p=1;p<=phase;p++) {
    state.phase=p;
    if(p===1){state.time=1;state.database=config.immutable?100:120;state.note=config.immutable?'不可变版本键的内容仍为 100；新内容使用另一个键，本实验继续读取旧键。':'数据库提交 120 元；缓存副本不会因数据库更新自动改变。';}
    if(p===2){
      if(config.immutable){state.note='同一版本键没有变更，因此不需要发送失效事件。';continue;}
      if(local)state.a=null;
      if(config.scheme!=='local'&&config.invalidateShared)state.shared=null;
      if(config.scheme==='layered'&&config.broadcast)state.b=null;
      state.note=config.scheme==='local'?'写入实例只清空 A；B 是另一块进程内存，仍持有旧价。':`${config.invalidateShared?'已清空共享缓存':'共享失效丢失，旧值仍在'}；${config.scheme==='shared'?'所有请求经过这一份缓存。':config.broadcast?'A、B 的 L1 都收到失效。':'仅 A 清空 L1，B 漏收广播。'}`;
    }
    if(p===3)read('A',2);
    if(p===4)read('B',3);
    if(p===5)read('B',6);
    if(p===6){state.checkout=state.database;state.note=`订单按权威数据库的 ${state.database} 元校验；页面曾展示的 ${state.lastRead?.price} 元不能直接当成交价。`;}
    if(p===7)read('B',121);
  }
  return state;
}
export function verdict(s:Snapshot):'pending'|'fresh'|'stale' {const r=s.reads.find(read=>read.time===6);return r?r.price===s.database?'fresh':'stale':'pending';}
export function memoryMB(c:Config){validate(c);return c.scheme==='shared'?0:c.instances*200;}
export type Prediction={value:'fresh'|'stale';reason:string};
export type Timeline={config:Config;phase:number;prediction:Prediction|null};
export function initial(config:Config=defaults):Timeline {validate(config);return {config:{...config},phase:0,prediction:null};}
export function step(t:Timeline,prediction?:Prediction):Timeline {
  if(t.phase===stages.length-1)return t;
  const p=t.prediction??prediction;
  if(!p||!['fresh','stale'].includes(p.value)||!p.reason.trim())throw new Error('先填写预测与理由');
  return {...t,phase:t.phase+1,prediction:{...p,reason:p.reason.trim()}};
}
export function back(t:Timeline):Timeline {return t.phase===0?t:{...t,phase:t.phase-1,prediction:t.phase===1?null:t.prediction};}
