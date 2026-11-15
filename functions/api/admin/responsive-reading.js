import {reply,sameOrigin} from '../../_lib/auth.js';
const valid=n=>Number.isInteger(n)&&n>=1&&n<=200;
export async function onRequestGet({request,env}){
 const n=Number(new URL(request.url).searchParams.get('number'));
 if(!valid(n))return reply({error:'invalid_number'},400);
 try{const row=await env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('responsive-reading-'+n).first();return reply({number:n,text:row?.body||''})}catch{return reply({error:'database_error'},500)}
}
export async function onRequestPut({request,env}){
 if(!sameOrigin(request))return reply({error:'invalid_origin'},403);
 let body;try{body=await request.json()}catch{return reply({error:'invalid_json'},400)}
 if(!valid(body?.number)||typeof body.text!=='string'||body.text.length>20000)return reply({error:'invalid_data'},400);
 try{await env.DB.prepare("INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES(?,?,?,'2000-01-01','2099-12-31',0,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind('responsive-reading-'+body.number,'교독문 '+body.number+'번',body.text.trim()).run();return reply({ok:true,number:body.number})}catch{return reply({error:'save_failed'},500)}
}
