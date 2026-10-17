export type Wiring = 'split' | 'shared' | 'escape';
export type Fault = 'none' | 'credit' | 'commit';
export type Outcome = 'pending' | 'success' | 'rolledback' | 'partial' | 'unknown';
export type Balances = {a:number;b:number};
export type Config = {amount:number;fault:Fault};
export type Snapshot = {step:number;wiring:Wiring;committed:Balances|null;draft:Balances|null;possibilities:Balances[];outcome:Outcome;message:string;code:string};
export const wiringNames:Record<Wiring,string> = {split:'仓储各自提交',shared:'用例共用 Tx',escape:'扣款误用全局 DB'};
export const outcomeNames:Record<Outcome,string> = {pending:'仍在执行',success:'转账成功',rolledback:'已回滚',partial:'只扣未加',unknown:'结果待核对'};
export const initialBalances:Balances = {a:100,b:20};
export const total = (b:Balances)=>b.a+b.b;
export function snapshot(config:Config,wiring:Wiring,requestedStep:number):Snapshot {
  const amount=Number.isFinite(config.amount)?Math.max(1,Math.min(100,Math.round(config.amount))):30;
  const step=Math.max(0,Math.min(4,Math.floor(requestedStep)));
  const original={...initialBalances},debit={a:100-amount,b:20},paid={a:100-amount,b:20+amount};
  const base:Snapshot={step,wiring,committed:original,draft:null,possibilities:[],outcome:'pending',message:'初始总额 120 元。先预测最终可确认的结果。',code:'A = 100; B = 20'};
  if(step===0)return base;
  if(step===1)return {...base,draft:wiring==='split'?null:original,message:wiring==='split'?'两个仓储独立开启、结束事务，没有共同提交点。':'用例创建一个 Tx；草稿尚未对外提交。',code:wiring==='split'?'debitRepo(); creditRepo()':'tx := db.BeginTx(ctx, nil)'};
  const afterDebit=wiring==='shared'?original:debit;
  if(step===2)return {...base,committed:afterDebit,draft:wiring==='split'?null:debit,message:wiring==='shared'?'扣 A 只改 Tx 草稿，已提交余额仍为 100 / 20。':wiring==='escape'?'DB.Exec 独立提交扣款，Tx 回滚不能撤销它。':'扣款仓储已经提交 A，入账仓储还没执行。',code:wiring==='shared'?'tx.Exec("扣 A")':wiring==='escape'?'db.Exec("扣 A") // 逃出 tx':'debitRepo.Commit()'};
  if(config.fault==='credit') {
    if(step===3)return {...base,committed:afterDebit,draft:wiring==='split'?null:debit,message:'入账语句失败；下一步处理失败并尝试回滚事务内写入。',code:'credit() → error'};
    return {...base,committed:afterDebit,outcome:wiring==='shared'?'rolledback':'partial',message:wiring==='shared'?'Rollback 丢弃扣款草稿，A+B 仍为 120。':'回滚只能撤销当前 Tx 的写入；已独立提交的扣款保留，总额减少。',code:wiring==='split'?'creditRepo.Rollback()':'tx.Rollback()'};
  }
  // On a split path, the final step commits the second repository. Its draft is shown
  // separately so a lost commit acknowledgement has the same honest uncertainty.
  if(step===3)return {...base,committed:afterDebit,draft:paid,message:wiring==='split'?'入账仓储的独立事务准备加 B；A 的扣款已提交。':wiring==='escape'?'加 B 在 Tx 草稿中；A 的扣款早已在事务外提交。':'扣 A、加 B 都在同一 Tx 草稿内；对外余额尚未改变。',code:wiring==='split'?'creditTx.Exec("加 B")':'tx.Exec("加 B")'};
  if(config.fault==='commit')return {...base,committed:null,possibilities:[afterDebit,paid],outcome:'unknown',message:'提交确认丢失：可能已提交，也可能未提交。不可报告成功或确定回滚，应按稳定业务键核对，避免盲目重试扣款。',code:wiring==='split'?'creditTx.Commit() → error':'tx.Commit() → error'};
  return {...base,committed:paid,outcome:'success',message:wiring==='shared'?'同一 Tx 一次提交，两笔余额一起可见，总额 120。':'本次碰巧都成功；中途失败仍会暴露独立提交的风险。',code:wiring==='split'?'creditTx.Commit()':'tx.Commit()'};
}
export const predictionOptions:Exclude<Outcome,'pending'>[]=['success','rolledback','partial','unknown'];
export function feedback(prediction:Outcome,state:Snapshot):string {
  if(state.step<4)return '执行尚未结束，继续比较已提交余额和草稿。';
  return `${prediction===state.outcome?'预测与观察一致。':'预测与观察不同：'}最终可确认的是「${outcomeNames[state.outcome]}」。${state.message}`;
}
