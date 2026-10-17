export type Method = 'Balance' | 'History' | 'Charge' | 'Refund' | 'Ping' | 'Init' | 'Handle' | 'Close';
export interface Config { context:'checkout'|'audit'|'plugin'; owner:'consumer'|'provider'; provider:'fake'|'adapter'|'raw'; history:boolean; extra:boolean; sdkV2:boolean; convert:boolean }
export interface Model extends Config { phase:number }
export const defaults:Config = {context:'checkout',owner:'provider',provider:'fake',history:false,extra:false,sdkV2:false,convert:true};
export const initial = ():Model => ({...defaults,phase:0});
export const needs = (c:Config):Method[] => c.context==='plugin'?['Handle']:c.context==='audit'?['Balance','History']:['Balance'];
export const full = (c:Config):Method[] => c.context==='plugin'?['Init','Handle','Close']:['Balance','History','Charge','Refund',...(c.sdkV2?['Ping' as const]:[])];
export const contract = (c:Config):Method[] => c.owner==='provider'?full(c):[needs(c)[0],...(c.history&&c.context!=='plugin'?['History' as const]:[])];
export function supplied(c:Config):Method[]{
 if(c.provider==='fake') { const methods:Method[] = c.context==='plugin'?['Handle',...(c.extra?['Init','Close'] as Method[]:[])]:['Balance',...(c.history?['History' as const]:[]),...(c.extra?['History','Charge','Refund',...(c.sdkV2?['Ping' as const]:[])] as Method[]:[])]; return [...new Set(methods)]; }
 if(c.context==='plugin') return full(c);
 if(c.provider==='raw') return full(c);
 return ['Balance',...(c.history?['History' as const]:[])];
}
export function evaluate(c:Config){
 const required=contract(c), available=supplied(c), missing=required.filter(m=>!available.includes(m));
 const unmet=needs(c).filter(m=>!required.includes(m));
 // The external SDK's Balance returns SDKMoney, not the business Money type.
 const signatureMismatch=c.context!=='plugin'&&c.owner==='consumer'&&c.provider==='raw';
 const assignment=missing.length===0&&!signatureMismatch;
 const protocol=c.context!=='plugin'||c.owner==='provider';
 const conversion=c.context==='plugin'||c.provider!=='adapter'||!c.sdkV2||c.convert;
 const usable=assignment&&unmet.length===0&&protocol&&conversion;
 return {required,available,missing,unmet,assignment,signatureMismatch,protocol,conversion,usable,stubMethods:required.length,unused:required.filter(m=>!needs(c).includes(m)).length};
}
export const advance=(m:Model):Model=>({...m,phase:Math.min(3,m.phase+1)});
export const rewind=(m:Model):Model=>({...m,phase:Math.max(0,m.phase-1)});
export const configure=(m:Model,patch:Partial<Config>):Model=>({...m,...patch,phase:0});
export function explanation(c:Config){const r=evaluate(c); if(r.missing.length)return `方法集合不满足：缺少 ${r.missing.join('、')}。赋值失败，尚不能调用。`;if(r.signatureMismatch)return '方法名相同仍不满足：SDK 的 Balance 返回 SDKMoney，调用方要求 Money；用适配器转换签名。';if(r.unmet.length)return `赋值成功，但契约缺少业务真正需要的 ${r.unmet.join('、')}，审计无法完成。`;if(!r.protocol)return '局部 Handle 接口可赋值，但没有履行宿主的 Init / Handle / Close 公共协议，不能据此宣称插件兼容。';if(!r.conversion)return '方法集合检查通过，但 SDK v2 的分值被当成元：12345 显示成 ¥12345.00。修复适配器的分→元转换。';return c.context==='plugin'?'方法集合满足；此模型检查的宿主公共协议已覆盖，发布时仍需验证版本与行为兼容。':c.provider==='adapter'?'方法集合满足；适配器将 SDK 数据转成业务 Money，余额 ¥123.45。':c.provider==='raw'?'完整 SDK 协议满足，但调用方直接承受 SDK 类型与版本变化；此处仅模拟调用，没有访问支付网络。':'方法集合满足，实际需求被覆盖；替身完成本次调用，不访问支付网络。';}

