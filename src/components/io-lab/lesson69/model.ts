export const locations = {
  utc: {label:'UTC（共享对象）', offset:0, identity:'UTC'},
  east: {label:'UTC+8（对象 east）', offset:480, identity:'east'},
  twin: {label:'UTC+8（独立对象 twin）', offset:480, identity:'twin'},
  west: {label:'UTC−5（对象 west）', offset:-300, identity:'west'},
} as const;
export type LocationId=keyof typeof locations;
export interface TimeInput { a:LocationId;b:LocationId;delta:number }
export const baseline:TimeInput={a:'utc',b:'east',delta:0};
const epoch=Date.UTC(2026,0,1);
export function representation(delta:number,location:LocationId){
  const zone=locations[location];
  const wall=new Date(epoch+(delta+zone.offset)*60000).toISOString();
  return {date:wall.slice(0,10),clock:wall.slice(11,16),minutes:((delta+zone.offset)%1440+1440)%1440,offset:zone.offset,identity:zone.identity};
}
export function timeState(input:TimeInput,step=3){
  if(!locations[input.a]||!locations[input.b]||!Number.isInteger(input.delta)||Math.abs(input.delta)>780||!Number.isInteger(step)||step<0||step>3)throw new Error('Invalid time model input');
  return {...input,step,aDisplay:representation(0,input.a),bDisplay:representation(input.delta,input.b),aInstant:epoch,bInstant:epoch+input.delta*60000,equal:input.delta===0,structEqual:input.delta===0&&locations[input.a].identity===locations[input.b].identity};
}
export function matchingWallTime(input:TimeInput):TimeInput{return {...input,delta:locations[input.a].offset-locations[input.b].offset};}
export const challenges:TimeInput[]=[{a:'east',b:'twin',delta:0},{a:'west',b:'utc',delta:-300},{a:'west',b:'west',delta:60}];
