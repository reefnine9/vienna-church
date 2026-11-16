import {reply,authenticated,sameOrigin} from '../../_lib/auth.js';
const MAX=12*1024*1024;
export async function onRequestPost({request,env}){
 if(!await authenticated(request,env))return reply({error:'로그인이 필요합니다.'},401);
 if(!sameOrigin(request))return reply({error:'요청 출처가 올바르지 않습니다.'},403);
 if(!env.SCORES)return reply({error:'Cloudflare R2 SCORES 저장소 연결이 필요합니다.'},503);
 const length=Number(request.headers.get('content-length')||0);
 if(length>MAX+10000)return reply({error:'파일은 12MB 이하만 가능합니다.'},413);
 try{
  const data=await request.formData(),file=data.get('file');
  if(!file||typeof file.arrayBuffer!=='function')return reply({error:'PDF 파일을 선택해 주세요.'},400);
  if(file.size<5||file.size>MAX)return reply({error:'PDF 파일 크기는 12MB 이하여야 합니다.'},413);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')return reply({error:'유효한 PDF 파일이 아닙니다.'},400);
  const date=String(data.get('date')||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return reply({error:'주일 날짜를 확인해 주세요.'},400);
  const key='choir/'+date+'-'+crypto.randomUUID()+'.pdf';
  await env.SCORES.put(key,bytes,{httpMetadata:{contentType:'application/pdf',contentDisposition:'inline'},customMetadata:{originalName:String(file.name||'score.pdf').slice(0,160)}});
  return reply({url:'/api/scores/'+key,name:file.name});
 }catch{return reply({error:'PDF 업로드에 실패했습니다.'},500)}
}
