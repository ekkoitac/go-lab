export type Kind = 'Tx' | 'Rows';
export type Status = 'active' | 'waiting' | 'released' | 'cancelled' | 'timeout';
export type Request = {id:number;kind:Kind;status:Status;connection:number|null;deadline:number};
export type State = {max:number;clock:number;connections:{id:number;owner:number|null}[];requests:Request[];nextId:number;txOperations:number;waitCount:number;code:string;event:string};
export type Action = {type:'acquire';kind:Kind;timeout?:number}|{type:'release'|'cancel';id:number}|{type:'tick'}|{type:'tx-operation';id:number};
export const statusLabel:Record<Status,string>={active:'持有连接',waiting:'等待连接',released:'已归还',cancelled:'已取消',timeout:'等待超时'};
export function start(max=1):State {return {max:Math.max(1,Math.min(4,Math.trunc(max)||1)),clock:0,connections:[],requests:[],nextId:1,txOperations:0,waitCount:0,code:`db.SetMaxOpenConns(${Math.max(1,Math.min(4,Math.trunc(max)||1))})`,event:'池预算已设置；连接按需打开，容量槽不是已经打开的连接。'};}
export function stats(s:State){const inUse=s.connections.filter(c=>c.owner!==null).length;return {Open:s.connections.length,InUse:inUse,Idle:s.connections.length-inUse,Waiting:s.requests.filter(r=>r.status==='waiting').length,WaitCount:s.waitCount};}
function grant(s:State,r:Request){let c=s.connections.find(c=>c.owner===null);if(!c&&s.connections.length<s.max){c={id:s.connections.length+1,owner:null};s.connections.push(c);}if(!c)return false;c.owner=r.id;r.status='active';r.connection=c.id;return true;}
function serve(s:State){for(const r of s.requests.filter(r=>r.status==='waiting')){if(!grant(s,r))break;}}
export function transition(state:State,a:Action):State {
 const s:State={...state,connections:state.connections.map(c=>({...c})),requests:state.requests.map(r=>({...r}))};
 if(a.type==='acquire'){
  const r:Request={id:s.nextId++,kind:a.kind,status:'waiting',connection:null,deadline:s.clock+Math.max(1,a.timeout??5)};s.requests.push(r);
  s.code=a.kind==='Tx'?'tx, err := db.BeginTx(ctx, nil)':'rows, err := db.QueryContext(ctx, query)';
  if(grant(s,r))s.event=`${r.kind} #${r.id} 取得连接 #${r.connection}，在释放前持续占用。`;
  else {s.waitCount++;s.event=`${r.kind} #${r.id} 等待：${s.max} 条连接均被占用；截止模拟时刻 ${r.deadline}。`;}
 } else if(a.type==='tick'){
  s.clock++;s.code='// 推进 1 单位模拟时间；等待 context 的 deadline';const expired=s.requests.filter(r=>r.status==='waiting'&&r.deadline<=s.clock);for(const r of expired)r.status='timeout';s.event=expired.length?`${expired.map(r=>'#'+r.id).join('、')} 等待超时，未取得连接；现有持有者仍须释放。`:'模拟时间前进；持有者不会因为等待者的 deadline 自动释放。';
 } else {
  const r=s.requests.find(r=>r.id===a.id);if(!r)return {...s,event:'请求不存在，状态不变。'};
  if(a.type==='tx-operation'){
   s.code='txRows, err := tx.QueryContext(ctx, query)\n// 消费并关闭 txRows；事务继续持有连接' ;if(r.kind==='Tx'&&r.status==='active'){s.txOperations++;s.event=`tx 查询并关闭结果，复用事务 #${r.id} 的连接 #${r.connection}；未向 db 池申请新连接。`;}else s.event='需要一个仍持有连接的事务。';
  }else if(a.type==='cancel'){
   s.code='cancelWaitingContext()';if(r.status==='waiting'){r.status='cancelled';s.event=`取消等待 #${r.id}；没有连接需要归还，持有者不变。`;}else s.event='此操作仅取消尚未取得连接的请求。';
  }else{
   s.code=r.kind==='Rows'?'rows.Close()':'tx.Rollback() // 或成功 Commit 后结束事务';
   if(r.status==='active'){const c=s.connections.find(c=>c.owner===r.id);if(c)c.owner=null;r.status='released';r.connection=null;serve(s);s.event=`${r.kind} #${r.id} 归还连接；等待队列可复用它，否则连接留在 Idle。`;}else s.event='该请求未持有连接，不发生重复归还。';
  }
 }
 return s;
}
export const script:Action[]=[{type:'acquire',kind:'Tx'},{type:'acquire',kind:'Rows'}];
export function run(max:number,actions:Action[]){return actions.reduce(transition,start(max));}

