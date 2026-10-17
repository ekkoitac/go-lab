export type Statement = 'check' | 'reject' | 'return';
export type Verdict = 'PASS' | 'FAIL' | 'NO ASSERTION';
export interface ChargeResult { input:number; output:number; expected:number; path:Statement[]; verdict:Verdict }
export function chargeCase(input:number,fixed:boolean,assertions:boolean):ChargeResult {
  const output=fixed && input<0?0:input;
  return {input,output,expected:Math.max(0,input),path:fixed?(input<0?['check','reject']:['check','return']):['return'],verdict:assertions?(output===Math.max(0,input)?'PASS':'FAIL'):'NO ASSERTION'};
}
export function coverage(rows:ChargeResult[],fixed:boolean){
  const total=fixed?3:1;
  const visited=[...new Set(rows.flatMap(row=>row.path))];
  return {visited,total,percent:Math.round(visited.length/total*100)};
}
export function suiteVerdict(rows:ChargeResult[]):'未运行'|'PASS'|'FAIL' {
  return rows.length===0?'未运行':rows.some(row=>row.verdict==='FAIL')?'FAIL':'PASS';
}
export interface RunState { inputs:number[]; fixed:boolean; assertions:boolean; cursor:number; phase:'ready'|'output'|'checked'|'done'; rows:ChargeResult[] }
export const initialState=():RunState=>({inputs:[5],fixed:false,assertions:false,cursor:0,phase:'ready',rows:[]});
export function step(state:RunState):RunState{
  if(state.phase==='done'||state.inputs.length===0)return state;
  if(state.phase==='ready'||state.phase==='checked'){
    const row=chargeCase(state.inputs[state.cursor],state.fixed,state.assertions);
    return {...state,phase:'output',rows:[...state.rows,row]};
  }
  const cursor=state.cursor+1;
  return {...state,cursor,phase:cursor>=state.inputs.length?'done':'checked'};
}
export function permissionCase(role:'guest'|'admin',assertions:boolean,fixed:boolean){
  const actual=fixed?role==='admin':true;
  const expected=role==='admin';
  return {actual,expected,verdict:assertions?(actual===expected?'PASS':'FAIL'):'NO ASSERTION'};
}
