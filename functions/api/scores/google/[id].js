// Fetch a publicly shared Google Drive PDF without an API key.
// Only Google's fixed download endpoint is contacted; arbitrary URLs are never fetched.
export async function onRequestGet({params}){
 const m=/^([A-Za-z0-9_-]{15,})\.pdf$/.exec(params.id||'');
 if(!m)return new Response('Invalid Google Drive file ID',{status:400});
 const id=m[1];
 try{
  const response=await fetch('https://drive.google.com/uc?export=download&id='+encodeURIComponent(id),{redirect:'follow',headers:{'accept':'application/pdf,application/octet-stream'}});
  if(!response.ok)return new Response('Google Drive file is not publicly downloadable',{status:502});
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength<5||bytes.byteLength>20*1024*1024||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')
   return new Response('Google Drive did not return a PDF. Check that the file is shared with anyone who has the link.',{status:502});
  return new Response(bytes,{headers:{'content-type':'application/pdf','content-disposition':'inline','cache-control':'public,max-age=600','x-content-type-options':'nosniff'}});
 }catch{return new Response('Google Drive PDF could not be retrieved',{status:502})}
}
