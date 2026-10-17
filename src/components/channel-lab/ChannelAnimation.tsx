import {AbsoluteFill,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import type {LabState,Status} from './model';

export const statusLabels:Record<Status,string>={ready:'可运行',send:'发送阻塞',receive:'接收阻塞',working:'处理中',cleanup:'待清理',done:'已退出',panic:'panic'};
const color=(s:Status)=>s==='panic'?'#c9463e':s==='send'||s==='receive'?'#b47720':s==='done'?'#71827d':'#087f82';
export type AnimationProps={before:LabState;after:LabState;compact:boolean};
export const movieHeight=(s:LabState,compact:boolean)=>compact?380+(Math.ceil(s.actors.length/2)-1)*115+Math.max(0,s.channels.length-1)*120:425;
export function ChannelAnimation({before,after,compact}:AnimationProps){
  const frame=useCurrentFrame(),{fps}=useVideoConfig();
  const t=interpolate(frame,[0.45*fps,1.75*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const settled=frame>=1.75*fps,s=settled?after:before;
  const width=compact?400:800,height=movieHeight(after,compact),center=width/2;
  const positions:Record<string,{x:number;y:number}>={signal:{x:center,y:44}};
  const count=s.actors.length;
  s.actors.forEach((a,i)=>{positions[a.id]={x:compact?(count===1?200:100+(i%2)*200):100+i*600/Math.max(1,count-1),y:123+(compact?Math.floor(i/2)*115:0)};});
  s.channels.forEach((c,i)=>{positions[c.id]={x:compact?200:s.channels.length===1?400:220+i*360,y:compact?240+(Math.ceil(count/2)-1)*115+i*120:300};});
  return <AbsoluteFill style={{background:'#f2f8f6',fontFamily:'"Segoe UI","Microsoft YaHei",sans-serif'}}>
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="通信机制动画">
      <defs><pattern id="channel-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#dce9e3"/></pattern></defs>
      <rect width={width} height={height} fill="url(#channel-dots)"/>
      <text x="24" y="31" fill="#57746c" fontSize="14">{frame<fps*0.45?'① 操作前 · 读取当前状态':settled?'③ 操作完成 · 更新状态与执行位置':'② 通信过程 · 交接 / 等待 / 唤醒'}</text>
      {s.cancelled&&<g><rect x={center-93} y="40" width="186" height="30" rx="15" fill="#f7e3bb"/><text x={center} y="61" textAnchor="middle" fontSize="14" fill="#845d20">ctx.Done 已关闭</text></g>}
      {s.actors.map(a=>{const p=positions[a.id],changed=before.actors.find(x=>x.id===a.id)?.line!==after.actors.find(x=>x.id===a.id)?.line;return <g key={a.id} transform={`translate(${p.x-73} ${p.y-38})`}>
        {changed&&!settled&&<rect x="-5" y="-5" width="156" height="109" rx="18" fill="none" stroke="#cf942f" strokeWidth="3" opacity={0.3+0.7*t}/>}
        <rect width="146" height="99" rx="14" fill="white" stroke={color(a.status)} strokeWidth="2"/>
        <text x="73" y="29" textAnchor="middle" fontSize="16" fill="#25463f">{a.name}</text>
        <circle cx="22" cy="55" r="5" fill={color(a.status)}/><text x="35" y="60" fontSize="15" fill={color(a.status)}>{statusLabels[a.status]}</text>
        <text x="73" y="84" textAnchor="middle" fontSize="13" fill="#688078">{a.job!==undefined?`任务 ${a.job}`:a.status==='send'?`待发送 ${a.value}`:a.status==='receive'?'等待通信完成':a.status==='done'?'收到退出确认':'由你安排下一步'}</text>
      </g>;})}
      {s.channels.map(c=>{const p=positions[c.id];return <g key={c.id} transform={`translate(${p.x-135} ${p.y-42})`}>
        <rect width="270" height="104" rx="16" fill={c.nil?'#e9eeeb':'#fff'} stroke={c.closed?'#bc8b4b':'#9abeb2'} strokeDasharray={c.nil?'6 5':undefined}/>
        <text x="135" y="26" textAnchor="middle" fontSize="16" fill="#345b50">{c.name} · {c.nil?'nil':c.closed?'已关闭':'开放'}</text>
        {c.nil?<text x="135" y="65" textAnchor="middle" fontSize="16" fill="#75887f">无可通信对象</text>:s.lesson===56&&c.id==='b'?<text x="135" y="65" textAnchor="middle" fontSize="16" fill="#087f82">{c.closed?'取消通知已就绪':'等待取消通知'}</text>:c.capacity===0?<text x="135" y="65" textAnchor="middle" fontSize="16" fill="#087f82">会合点 · 无存储槽</text>:Array.from({length:c.capacity},(_,i)=><g key={i} transform={`translate(${135-c.capacity*23+i*46} 40)`}><rect width="40" height="35" rx="7" fill={c.queue[i]===undefined?'#eff4f1':'#d3eee3'} stroke="#aacabd"/><text x="20" y="24" textAnchor="middle" fontSize="17" fill="#235e4a">{c.queue[i]??'·'}</text></g>)}
        <text x="135" y="94" textAnchor="middle" fontSize="12" fill="#70847c">len {c.nil?0:c.queue.length} / cap {c.nil?0:c.capacity}</text>
      </g>;})}
      {!s.channels.length&&<g><rect x={compact?20:150} y="230" width={compact?360:500} height="104" rx="16" fill="white" stroke="#b4cec4"/><text x={center} y="268" textAnchor="middle" fontSize={compact?14:18} fill="#315c4d">取消通知 → 主动观察 → 释放资源 → done</text><text x={center} y="302" textAnchor="middle" fontSize="15" fill="#718078">已确认退出 {s.actors.filter(a=>a.status==='done').length} / {s.actors.length}</text></g>}
      {!settled&&after.flows.map((f,i)=>{const from=positions[f.from],to=positions[f.to];if(!from||!to)return null;const progress=f.blocked?Math.min(t,0.38):t;const x=from.x+(to.x-from.x)*progress,y=from.y+(to.y-from.y)*progress;return <g key={i} opacity={frame<fps*.45?0:1}>
        <line x1={from.x} y1={from.y+35} x2={to.x} y2={to.y} stroke={f.blocked?'#c48a30':'#269c82'} strokeWidth="2" strokeDasharray="6 5"/>
        <rect x={x-34} y={y-16+i*30} width="68" height="30" rx="15" fill={f.blocked?'#f8db9c':'#087f82'}/><text x={x} y={y+5+i*30} textAnchor="middle" fill={f.blocked?'#78511e':'#fff'} fontSize="14">{f.value}</text>
      </g>;})}
      <text x={center} y={height-24} textAnchor="middle" fontSize="14" fill="#5d7b6f">{settled?after.label:frame<fps*.45?before.label:'正在展示本次操作的机制'}</text>
      <rect x="0" y={height-5} width={width*frame/(fps*2.6-1)} height="5" fill="#259c86"/>
    </svg>
  </AbsoluteFill>;
}
