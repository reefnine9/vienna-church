export async function onRequestGet({env,params}){
 const n=String(params.number||'');
 const headers={'content-type':'application/json','cache-control':'no-store'};
 if(!/^(?:[1-9]|[1-9]\d|[1-5]\d\d|6[0-3]\d|64[0-5])$/.test(n))return new Response(JSON.stringify({exists:false}),{headers});
 try{
  const row=await env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('hymn-drive-'+n).first();
  const id=row?.body||'';
  const exists=/^[A-Za-z0-9_-]{15,}$/.test(id);
  return new Response(JSON.stringify({exists:true,url:exists?'/api/scores/google/'+id+'.pdf':'/api/scores/bibletoppt/'+n,source:exists?'drive':'bibletoppt'}),{headers});
 }catch{return new Response(JSON.stringify({exists:false,error:'database_error'}),{status:503,headers})}
}