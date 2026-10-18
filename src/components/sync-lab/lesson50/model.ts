export type Strategy = 'fields' | 'mutex' | 'snapshot';
export type Pair = {version:number;limit:number};
export type Action = 'writer' | 'reader' | 'mutate';
export type State = {
  strategy:Strategy; old:Pair; target:Pair; shared:Pair; draft:Pair;
  objects:Record<string,Pair>; published:string; captured:string|null;
  writer:number; reader:number; owner:'writer'|'reader'|null;
  observed:Partial<Pair>; unsafe:boolean; message:string; events:string[];
};
export function initialState(strategy:Strategy='fields',limit=20):State {
  const old={version:1,limit:10};
  return {strategy,old,target:{version:2,limit},shared:{...old},draft:{...old},objects:{old:{...old}},published:'old',captured:null,writer:0,reader:0,owner:null,observed:{},unsafe:false,message:'先决定调度谁。旧配置是 1 / 10，新配置的两个字段必须一起生效。',events:[]};
}
export function result(s:State):'pending'|'old'|'new'|'mixed' {
  if(s.reader<3)return 'pending';
  if(s.observed.version===s.old.version&&s.observed.limit===s.old.limit)return 'old';
  if(s.observed.version===s.target.version&&s.observed.limit===s.target.limit)return 'new';
  return 'mixed';
}
export function nextLabel(s:State,actor:'writer'|'reader'):string {
  if(actor==='writer')return [s.strategy==='mutex'?'写者获取共同锁':s.strategy==='snapshot'?'写者开始构建私有对象':'写者准备两个独立 Store','写者写 version=2',`写者写 limit=${s.target.limit}`,s.strategy==='mutex'?'写者释放共同锁':s.strategy==='snapshot'?'写者原子发布新对象':'写者结束更新','写者已完成'][s.writer];
  return [s.strategy==='mutex'?'读者获取共同锁':s.strategy==='snapshot'?'读者原子加载一次指针':'读者准备两个独立 Load','读者读取 version','读者读取 limit',s.strategy==='mutex'?'读者释放共同锁':'读者完成快照','读者已完成'][s.reader];
}
export function transition(s:State,action:Action):State {
  if(action==='mutate'){
    if(s.strategy!=='snapshot'||s.writer!==4||s.unsafe)return s;
    const pair={...s.objects[s.published],limit:s.target.limit+10};
    const message=`违规：发布后把同一对象 limit 改为 ${pair.limit}。已经持有该对象的引用仍指向被修改的对象；若无额外同步，实际 Go 程序可能数据竞争。`;
    return {...s,objects:{...s.objects,[s.published]:pair},shared:pair,unsafe:true,message,events:[...s.events,message]};
  }
  const phase=s[action];if(phase===4)return s;
  if(s.strategy==='mutex'&&s.owner!==null&&s.owner!==action){
    const message=`${action==='reader'?'读者':'写者'}等待：共同锁仍由${s.owner==='writer'?'写者':'读者'}持有，本次没有读取或修改字段。`;
    return {...s,message,events:[...s.events,message]};
  }
  let n:State={...s,observed:{...s.observed},shared:{...s.shared},draft:{...s.draft},objects:{...s.objects},[action]:phase+1};
  let message=nextLabel(s,action);
  if(action==='writer'){
    if(phase===0&&s.strategy==='mutex')n.owner='writer';
    if(phase===1){if(s.strategy==='snapshot')n.draft.version=2;else n.shared.version=2;}
    if(phase===2){if(s.strategy==='snapshot')n.draft.limit=s.target.limit;else n.shared.limit=s.target.limit;}
    if(phase===3){
      if(s.strategy==='mutex')n.owner=null;
      if(s.strategy==='snapshot'){n.published='new';n.objects.new={...s.draft};n.shared={...s.draft};message+='：后续 Load 得到新对象；已持有旧指针的读者继续使用旧对象。';}
    }
    if(phase===1||phase===2)message+=s.strategy==='snapshot'?'；只改变私有草稿，公开指针仍指向旧对象。':s.strategy==='mutex'?'；中间状态被同一把锁隔离，读者不能进入。':'；只保证这一个字段的操作，另一个字段没有随之更新。';
  }else{
    if(phase===0){if(s.strategy==='mutex')n.owner='reader';if(s.strategy==='snapshot')n.captured=s.published;}
    const source=s.strategy==='snapshot'?s.objects[s.captured??s.published]:s.shared;
    if(phase===1){n.observed.version=source.version;message+=` → ${source.version}，保存在读者局部变量。`;}
    if(phase===2){n.observed.limit=source.limit;message+=` → ${source.limit}；快照为 ${n.observed.version} / ${source.limit}。`;}
    if(phase===3&&s.strategy==='mutex')n.owner=null;
  }
  n={...n,message,events:[...s.events,message]};return n;
}
export function run(strategy:Strategy,actions:Action[],limit=20):State{return actions.reduce(transition,initialState(strategy,limit));}
export const interrupted:Action[]=['writer','writer','reader','reader','reader','reader','writer','writer'];
export function challenge(strategy:Strategy,mutate:boolean):State {
  let s=run(strategy,['writer','writer','writer','writer','reader','reader'],30);
  if(mutate)s=transition(s,'mutate');
  return transition(transition(s,'reader'),'reader');
}


