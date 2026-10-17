export type Guard = 'none' | 'present' | 'floor';
export type Scenario = 'delete-first' | 'late-fill' | 'delete-failure' | 'double-delete';
export type Event = 'delete' | 'read' | 'commit' | 'fill' | 'fresh' | 'fail' | 'retry' | 'wait';
export type Config = {scenario:Scenario; guard:Guard; ttl:number; base:number};
export type State = {config:Config; step:number; time:number; db:number; cache:number|null; reader:number|null; floor:number; expires:number|null; retry:boolean; rejected:number; log:string[]};
export const labels:Record<Event,string> = {delete:'删除缓存',read:'读者读取数据库',commit:'提交数据库新版本',fill:'迟到读者回填',fresh:'新读者读取并回填',fail:'删除请求失败',retry:'重试失效',wait:'推进到缓存过期'};
export const scenarios:Record<Scenario,{title:string;events:Event[];hint:string}> = {
 'delete-first':{title:'先删缓存，再写数据库',events:['delete','read','commit','fill'],hint:'读者趁数据库提交前读取旧版本，然后回填。'},
 'late-fill':{title:'先写库后删除，仍有迟到读',events:['read','commit','delete','fill'],hint:'初始缓存为空；读者在写事务前取到快照，回填发生在删除之后。'},
 'delete-failure':{title:'数据库成功，删除失败',events:['commit','fail','retry','fresh'],hint:'初始缓存有旧值；比较失败当下与可靠重试之后的读路径。'},
 'double-delete':{title:'双删之后才回填的反例',events:['delete','read','commit','delete','fill'],hint:'第二次删除已经完成，旧请求仍能更晚返回。固定等待不能覆盖无界延迟。'},
};
export function initial(config:Partial<Config>={}):State {
 const c:Config={scenario:'delete-first',guard:'none',ttl:3,base:1,...config};
 c.ttl=Math.max(1,Math.min(9,Math.trunc(c.ttl)||1));
 return {config:c,step:0,time:0,db:c.base,cache:c.scenario==='late-fill'?null:c.base,reader:null,floor:c.base,expires:c.scenario==='late-fill'?null:c.ttl,retry:false,rejected:0,log:['初始：数据库为权威；缓存操作和数据库提交互不原子。']};
}
export const stale=(s:State)=>s.cache!==null&&s.cache<s.db;
export function apply(s:State,event:Event):State {
 const n:State={...s,log:[...s.log],step:s.step+1};
 const log=(v:string)=>n.log.push(v);
 const fill=(version:number)=>{
  const threshold=n.config.guard==='floor'?Math.max(n.floor,n.cache??0):n.config.guard==='present'?(n.cache??0):0;
  if(version<threshold){n.rejected++;log('回填 v'+version+' < 门槛 v'+threshold+'：拒绝；缓存'+(n.cache===null?'仍为空':'保留 v'+n.cache)+'。');}
  else {n.cache=version;n.expires=n.time+n.config.ttl;log('回填 v'+version+' 被接受；TTL 从本次回填起计 '+n.config.ttl+' 格。');}
 };
 switch(event){
  case 'commit': n.db=s.config.base+1; log('数据库提交 v'+n.db+'；缓存和读者快照不会自动更新。');break;
  case 'read':n.reader=n.db;log('读者从数据库取得 v'+n.reader+'，先挂起回填。');break;
  case 'delete':case 'retry':n.cache=null;n.expires=null;n.retry=false;if(n.config.guard==='floor')n.floor=n.db;log('缓存失效成功'+(n.config.guard==='floor'?'，同时保留版本门槛 v'+n.floor:'')+'；在途读者仍持有 v'+(n.reader??'—')+'。');break;
  case 'fill':if(n.reader!==null)fill(n.reader);else log('没有在途快照，不能回填。');break;
  case 'fresh':fill(n.db);break;
  case 'fail':n.retry=true;log('缓存删除失败；旧缓存'+(n.cache===null?'为空':' v'+n.cache+' 仍在')+'，必须保留重试责任。');break;
  case 'wait':n.time=n.expires??n.time;if(n.cache!==null){n.cache=null;n.expires=null;log('到达该缓存条目的 TTL，条目过期；下一次读需回源。');}else log('缓存已为空，没有可过期条目。');break;
 }
 return n;
}
export function next(s:State):State {const event=scenarios[s.config.scenario].events[s.step];return event?apply(s,event):s;}
export function run(config:Partial<Config>,events?:Event[]):State {let s=initial(config);for(const event of events??scenarios[s.config.scenario].events)s=apply(s,event);return s;}
