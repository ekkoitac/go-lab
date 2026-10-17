export type Config={amount:number;handle:'tx'|'db';valid:boolean;commit:'ok'|'unknown-applied'|'unknown-aborted'};
export type Balances={sender:number;recipient:number};
export type State={config:Config;stage:number;committed:Balances;pending:Balances;status:'new'|'active'|'committed'|'rolled-back'|'unknown';event:string;code:string};
export const initialConfig:Config={amount:30,handle:'tx',valid:false,commit:'ok'};
export const labels={unchanged:'余额恢复原状',partial:'事务外扣款仍保留',transferred:'转账已确认',unknown:'客户端无法确定提交结果'};
export function start(config:Config=initialConfig):State {return {config:{...config,amount:Math.max(1,Math.min(100,config.amount))},stage:0,committed:{sender:100,recipient:40},pending:{sender:0,recipient:0},status:'new',event:'尚未开始；A 有 100，B 有 40。',code:'// 等待 BeginTx'};}
export function step(s:State):State {
 if(s.stage>=6)return s;
 const n:State={...s,stage:s.stage+1,committed:{...s.committed},pending:{...s.pending}};
 const c=s.config;
 if(n.stage===1){n.status='active';n.event='BeginTx 成功，安排 defer Rollback；此刻还没有回滚。';n.code='tx, err := db.BeginTx(ctx, nil)\nif err != nil { return err }\ndefer tx.Rollback()';}
 if(n.stage===2){if(c.handle==='tx')n.pending.sender-=c.amount;else n.committed.sender-=c.amount;n.code=`_, err = ${c.handle}.ExecContext(ctx, debitSQL, ${c.amount})`;n.event=c.handle==='tx'?'扣款只在事务的暂存修改中。':'db 扣款在事务外独立提交；本实验假定连接充足且无锁冲突。';}
 if(n.stage===3){n.code='if !recipientValid { return errInvalidRecipient }';n.event=c.valid?'收款校验通过，继续向 B 入账。':'收款校验失败，跳过入账与 Commit，准备离开作用域。';}
 if(n.stage===4){if(c.valid)n.pending.recipient+=c.amount;n.code=c.valid?`_, err = tx.ExecContext(ctx, creditSQL, ${c.amount})`:'// 错误路径：不执行 credit，也不执行 Commit';n.event=c.valid?'B 的入账暂存在 tx 内，尚未提交。':'失败路径没有新增修改；等待 defer Rollback。';}
 if(n.stage===5){
  if(!c.valid){n.pending={sender:0,recipient:0};n.status='rolled-back';n.code='// 作用域退出\ntx.Rollback()';n.event='回滚只撤销 tx 的修改；不能撤销 db 已提交的扣款。';}
  else {n.code='err = tx.Commit()\nif err != nil { return reconcileByTransferID(err) }';if(c.commit!=='unknown-aborted'){n.committed.sender+=n.pending.sender;n.committed.recipient+=n.pending.recipient;}n.pending={sender:0,recipient:0};n.status=c.commit==='ok'?'committed':'unknown';n.event=c.commit==='ok'?'Commit 返回 nil，转账结果已确认。':'Commit 返回错误：客户端无法仅凭此错误判断是否提交，需凭转账标识确认结果。';}
 }
 if(n.stage===6){n.code=c.valid?'// defer tx.Rollback()\n// 已结束的 Tx 返回 sql.ErrTxDone':'// 失败路径的 defer Rollback 已执行\n// 检查回滚后的余额';n.event=c.valid?'Tx 已结束，defer Rollback 不改变余额；提交错误也不会因此变成“确定回滚”。':'失败返回已执行 defer Rollback；事务内修改被撤销，事务外 db 修改仍保留。';}
 return n;
}
export function finish(c:Config){let s=start(c);while(s.stage<6)s=step(s);return s;}
export function outcome(s:State):keyof typeof labels {if(s.status==='unknown')return 'unknown';if(s.status==='committed')return 'transferred';return s.committed.sender===100&&s.committed.recipient===40?'unchanged':'partial';}
export function clientView(s:State){return {stage:s.stage,status:s.status,committed:s.status==='unknown'?null:s.committed,pending:s.pending,outcome:s.stage>=5?outcome(s):null};}

