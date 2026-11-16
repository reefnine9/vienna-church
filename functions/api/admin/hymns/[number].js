import {reply,authenticated,sameOrigin} from '../../../_lib/auth.js';
const valid=n=>/^(?:[1-9]|[1-9]\d|[1-5]\d\d|6[0-3]\d|64[0-5])$/.test(String(n));
export async function onRequestPost({request,env,params}){
 if(!await authenticated(request,env))return reply({error:'로그인이 필요합니다.'},401);
 if(!sameOrigin(request))return reply({error:'요청 출처가 올바르지 않습니다.'},403);
 if(!env.SCORES)return reply({error:'R2 SCORES 저장소 연결이 필요합니다.'},503);
 const number=String(params.number||'');
 if(!valid(number))return reply({error:'찬송가 번호는 1~645장이어야 합니다.'},400);
 try{
  const data=await request.formData(),file=data.get('file');
  if(!file||typeof file.arrayBuffer!=='function'||file.size<5||file.size>12*1024*1024)return reply({error:'12MB 이하의 PDF 악보를 선택해 주세요.'},400);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')return reply({error:'PDF 형식이 아닙니다.'},400);
  await env.SCORES.put('hymns/'+number+'.pdf',bytes,{httpMetadata:{contentType:'application/pdf',contentDisposition:'inline'}});
  return reply({ok:true,url:'/api/scores/hymns/'+number+'.pdf'});
 }catch{return reply({error:'악보 업로드 실패'},500)}
}
export async function onRequestDelete({request,env,params}){
 if(!await authenticated(request,env))return reply({error:'로그인이 필요합니다.'},401);
 if(!sameOrigin(request))return reply({error:'요청 출처가 올바르지 않습니다.'},403);
 if(!env.SCORES)return reply({error:'R2 SCORES 저장소 연결이 필요합니다.'},503);
 const number=String(params.number||'');if(!valid(number))return reply({error:'잘못된 번호'},400);
 await env.SCORES.delete('hymns/'+number+'.pdf');return reply({ok:true});
}
export async function onRequestGet({request,env,params}){
 if(!await authenticated(request,env))return reply({error:'로그인이 필요합니다.'},401);
 if(!env.SCORES)return reply({error:'R2 SCORES 저장소 연결이 필요합니다.'},503);
 const number=String(params.number||'');if(!valid(number))return reply({error:'잘못된 번호'},400);
 return reply({exists:!!await env.SCORES.head('hymns/'+number+'.pdf')});
}