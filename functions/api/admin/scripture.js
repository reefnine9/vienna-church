import {reply,authenticated,sameOrigin} from '../../_lib/auth.js';
const normalize=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').replace(/[–—~〜]/g,'-').replace(/：/g,':').trim();
export async function onRequestPut({request,env}){
 if(!await authenticated(request,env))return reply({error:'관리자 로그인이 필요합니다.'},401);
 if(!sameOrigin(request))return reply({error:'invalid_origin'},403);
 let body;try{body=await request.json()}catch{return reply({error:'invalid_json'},400)}
 const reference=normalize(body?.reference);
 if(!reference||reference.length>120||typeof body?.text!=='string'||body.text.length>30000)return reply({error:'invalid_data'},400);
 try{await env.DB.prepare("INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES(?,?,?,'2000-01-01','2099-12-31',0,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind('scripture-krv-'+reference,'성경 봉독 · 개역개정 · '+reference,body.text.trim()).run();return reply({ok:true,reference})}catch{return reply({error:'save_failed'},500)}
}
