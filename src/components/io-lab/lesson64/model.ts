export type Failure = 'disk-full' | 'none';
export interface Config { input: string; capacity: number; allowance: number; failure: Failure }
export interface State { phase: number; input: string; buffer: string; target: string; writeN: number | null; writeError: string | null; flushError: string | null; stickyError: string | null; calls: number; event: string; ignored: string; checked: string }
export const initialConfig: Config = {input:'ABC', capacity:4, allowance:0, failure:'disk-full'};
export function initial(config:Config):State { return {phase:0,input:config.input,buffer:'',target:'',writeN:null,writeError:null,flushError:null,stickyError:null,calls:0,event:'缓冲为空；尚未调用 Write。',ignored:'等待完成',checked:'等待完成'}; }
function underlying(state:State, data:string, config:Config) {
  const n=config.failure==='none'?data.length:Math.min(data.length, Math.max(0,config.allowance-state.target.length));
  return {n,error:n<data.length?'disk full':null};
}
export function advance(state:State, config:Config):State {
  if(state.phase>=4)return state;
  const next={...state,phase:state.phase+1};
  if(state.phase===0){
    if(config.input.length<=config.capacity){
      next.buffer=config.input;next.writeN=config.input.length;next.event=`Write 返回 (${next.writeN}, nil)：${next.writeN} 字节进入内存缓冲，下层尚未接收。`;
    }else{
      const result=underlying(state,config.input,config);next.target=config.input.slice(0,result.n);next.calls++;next.writeN=result.n;next.writeError=result.error;next.stickyError=result.error;
      next.event=`输入超过空缓冲容量，Write 直接调用底层：返回 (${result.n}, ${result.error??'nil'})；剩余 ${config.input.length-result.n} 字节未被接受。`;
    }
  }else if(state.phase===1){
    if(state.stickyError){next.flushError=state.stickyError;next.event=`Flush 返回已保存的 ${state.stickyError}；没有再次调用底层。`;}
    else if(!state.buffer){next.event='Flush 返回 nil；缓冲已空，没有调用底层。';}
    else{
      const result=underlying(state,state.buffer,config);next.calls++;next.target+=state.buffer.slice(0,result.n);next.buffer=state.buffer.slice(result.n);next.flushError=result.error;next.stickyError=result.error;
      next.event=`Flush 将 ${result.n} 字节交给底层，返回 ${result.error??'nil'}；缓冲还剩 ${next.buffer.length} 字节。`;
    }
  }else if(state.phase===2){
    next.event=state.stickyError?`再调用 Flush 仍返回 ${state.stickyError}；错误被保存，底层调用次数仍是 ${state.calls}。`:'再次 Flush 返回 nil；没有待提交字节。';
  }else{
    next.ignored=state.writeError?`失败：${state.writeError}`:'报告成功';
    next.checked=state.writeError||state.flushError?`失败：${state.writeError||state.flushError}`:'报告提交成功';
    next.event=state.flushError&&!state.writeError?'只检查 Write 的方案误报成功；检查 Flush 的方案把最终错误交给调用者。':'结合 Write 和 Flush 的返回值判断结果；成功仅表示本模型的底层 Writer 接收了数据。';
  }
  return next;
}
export function atStep(config:Config,step:number):State {let state=initial(config);for(let n=0;n<Math.min(4,step);n++)state=advance(state,config);return state;}
export function outcome(config:Config):string {const s=atStep(config,4);return s.writeError?'write-error':s.flushError?'flush-error':'success';}

