import {reply,sameOrigin} from '../../_lib/auth.js';
const valid=url=>!url||/^\/scores\/[a-zA-Z0-9_./%-]+\.pdf(?:\?[a-zA-Z0-9_=&%-]+)?$/i.test(url)||/^https:\/\/[^\s<>"']+\.pdf(?:\?[^\s<>"']*)?$/i.test(url);
export async function onRequestGet({env}){
 try{const row=await env.DB.prepare("SELECT body FROM announcements WHERE id='praise-score-global-v1'").first();return reply({url:row?.body||''})}
 catch{return reply({error:'database_error'},500)}
}
export async function onRequestPut({env,request}){
 if(!sameOrigin(request))return reply({error:'invalid_origin'},403);
 let data;try{data=await request.json()}catch{return reply({error:'invalid_json'},400)}
 const url=typeof data?.url==='string'?data.url.trim():'';
 if(url.length>500||!valid(url))return reply({error:'invalid_pdf_url'},400);
 try{await env.DB.prepare("INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES('praise-score-global-v1','경배와 찬양 공통 악보',?,'2000-01-01','2099-12-31',0,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind(url).run();return reply({ok:true,url})}
 catch{return reply({error:'database_error'},500)}
}
