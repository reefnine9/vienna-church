import {reply,authenticated,sameOrigin} from '../../_lib/auth.js';
const zone='Europe/Vienna';
const dayFmt=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
const partsFmt=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function localMidnightUTC(day){const guess=Date.parse(day+'T00:00:00Z');const parts=Object.fromEntries(partsFmt.formatToParts(new Date(guess)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));const shown=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second);return new Date(guess-(shown-guess)).toISOString().slice(0,19).replace('T',' ')}
export async function onRequestPost({request,env}){
 if(!await authenticated(request,env))return reply({error:'관리자 로그인이 필요합니다.'},401);
 if(!sameOrigin(request))return reply({error:'invalid_origin'},403);
 if(!env.DB)return reply({error:'DB unavailable'},503);
 try{
  const day=dayFmt.format(new Date());
  const next=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const start=localMidnightUTC(day),end=localMidnightUTC(next);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS bulletin_likes (visitor_id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS bulletin_like_clicks (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  const results=await env.DB.batch([
   env.DB.prepare('DELETE FROM bulletin_like_clicks WHERE created_at >= ? AND created_at < ?').bind(start,end),
   env.DB.prepare('DELETE FROM bulletin_likes WHERE created_at >= ? AND created_at < ?').bind(start,end)
  ]);
  return reply({ok:true,date:day,deleted:results.reduce((sum,r)=>sum+Number(r.meta?.changes||0),0)});
 }catch{return reply({error:'좋아요 초기화에 실패했습니다.'},500)}
}
