// Proxy publicly shared Google Drive PDFs for the in-page PDF viewer.
// Google Drive sometimes returns an HTML confirmation page from its legacy /uc endpoint.
const MAX_BYTES=20*1024*1024;
const isPdf=bytes=>bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
async function tryDownload(url){
 const response=await fetch(url,{redirect:'follow',headers:{accept:'application/pdf,application/octet-stream,*/*'}});
 if(!response.ok)return {error:'Google Drive HTTP '+response.status};
 const size=Number(response.headers.get('content-length')||0);
 if(size>MAX_BYTES)return {error:'PDF 파일이 20MB를 초과합니다.'};
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length>MAX_BYTES)return {error:'PDF 파일이 20MB를 초과합니다.'};
 if(isPdf(bytes))return {bytes};
 return {error:'Google Drive에서 PDF 대신 웹페이지를 반환했습니다.'};
}
export async function onRequestGet({params,env}){
 const m=/^([A-Za-z0-9_-]{15,})\.pdf$/.exec(params.id||'');
 if(!m)return new Response('Invalid Google Drive file ID',{status:400});
 const id=encodeURIComponent(m[1]);
 const urls=[];
 if(env.GOOGLE_DRIVE_API_KEY)urls.push('https://www.googleapis.com/drive/v3/files/'+id+'?alt=media&key='+encodeURIComponent(env.GOOGLE_DRIVE_API_KEY));
 urls.push('https://drive.usercontent.google.com/download?id='+id+'&export=download&confirm=t');
 urls.push('https://drive.google.com/uc?export=download&confirm=t&id='+id);
 let lastError='PDF를 가져오지 못했습니다.';
 for(const url of urls){
  try{
   const result=await tryDownload(url);
   if(result.bytes)return new Response(result.bytes,{headers:{'content-type':'application/pdf','content-disposition':'inline','cache-control':'public,max-age=600','x-content-type-options':'nosniff','content-length':String(result.bytes.length)}});
   lastError=result.error||lastError;
  }catch(e){lastError='Google Drive 연결에 실패했습니다.'}
 }
 return new Response('Google Drive PDF를 읽지 못했습니다. 파일 공유 설정을 "링크가 있는 모든 사용자 - 뷰어"로 변경하고 PDF 파일인지 확인해 주세요. ('+lastError+')',{status:502,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
}
