import {reply,authenticated,sameOrigin} from '../../_lib/auth.js';
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T12:00:00Z').getUTCDay()===0;
const validUrl=s=>!s||/^\/api\/scores\/(?:google|drive)\/[A-Za-z0-9_-]+\.pdf$/.test(s)||/^\/api\/scores\/choir\/[a-zA-Z0-9._-]+\.pdf$/.test(s)||/^\/scores\/[a-zA-Z0-9_./%-]+\.pdf(?:\?[a-zA-Z0-9_=&%-]+)?$/i.test(s)||/^https:\/\/[^\s<>"']+\.pdf(?:\?[^\s<>"']*)?$/i.test(s);
export async function onRequestPut({env,request}){
 if(!await authenticated(request,env))return reply({error:'로그인이 필요합니다.'},401);
 if(!sameOrigin(request))return reply({error:'invalid_origin'},403);
 let data;try{data=await request.json()}catch{return reply({error:'invalid_json'},400)}
 const date=String(data?.date||''),url=String(data?.url||'').trim();
 if(!validDate(date)||url.length>600||!validUrl(url))return reply({error:'invalid_date_or_pdf_url'},400);
 try{
  const query=url?"INSERT INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?) ON CONFLICT(sunday_date,slot) DO UPDATE SET value=excluded.value":"DELETE FROM annual_schedule WHERE sunday_date=? AND slot='choir_pdf_url'";
  if(url)await env.DB.prepare(query).bind(date+'-choir_pdf_url',date,'choir_pdf_url',url).run();
  else await env.DB.prepare(query).bind(date).run();
  return reply({ok:true,date,url});
 }catch{return reply({error:'database_error'},500)}
}
