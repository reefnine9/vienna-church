import {reply,authenticated,sameOrigin} from '../../../_lib/auth.js';
const valid=n=>/^(?:[1-9]|[1-9]\d|[1-5]\d\d|6[0-3]\d|64[0-5])$/.test(String(n));
const key=n=>'hymn-drive-'+n;
function fileId(input){
 const s=String(input||'').trim();
 const m=s.match(/^https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=download&)?id=)([A-Za-z0-9_-]{15,})(?:[/?&#].*)?$/);
 return m?.[1]||(/^[A-Za-z0-9_-]{15,}$/.test(s)?s:null);
}
export async function onRequestGet({request,env,params}){
 if(!await authenticated(request,env))return reply({error:'로그인이 필요합니다.'},401);
 const n=String(params.number||'');if(!valid(n))return reply({error:'잘못된 번호'},400);
 try{const row=await env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind(key(n)).first();return reply({exists:!!row?.body,fileId:row?.body||''})}catch{return reply({error:'database_error'},500)}
}
export async function onRequestPut({request,env,params}){
 if(!await authenticated(request,env))return reply({error:'로그인이 필요합니다.'},401);
 if(!sameOrigin(request))return reply({error:'요청 출처가 올바르지 않습니다.'},403);
 const n=String(params.number||'');if(!valid(n))return reply({error:'찬송가 번호는 1~645장이어야 합니다.'},400);
 let data;try{data=await request.json()}catch{return reply({error:'invalid_json'},400)}
 const id=fileId(data?.url);if(!id)return reply({error:'Google Drive PDF 공유 링크를 확인해 주세요.'},400);
 try{await env.DB.prepare("INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES(?,?,?,'2000-01-01','2099-12-31',0,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind(key(n),'찬송가 '+n+'장 Google Drive PDF',id).run();return reply({ok:true,fileId:id})}catch{return reply({error:'database_error'},500)}
}
export async function onRequestDelete({request,env,params}){
 if(!await authenticated(request,env))return reply({error:'로그인이 필요합니다.'},401);
 if(!sameOrigin(request))return reply({error:'요청 출처가 올바르지 않습니다.'},403);
 const n=String(params.number||'');if(!valid(n))return reply({error:'잘못된 번호'},400);
 try{await env.DB.prepare('DELETE FROM announcements WHERE id=?').bind(key(n)).run();return reply({ok:true})}catch{return reply({error:'database_error'},500)}
}