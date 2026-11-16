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
  const id='choir-score-weekly-'+date;
  await env.DB.prepare("INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES(?,?,?,? ,?,0,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind(id,'찬양대 악보 PDF',url,date,date).run();
  return reply({ok:true,date,url});
 }catch{return reply({error:'database_error'},500)}
}
