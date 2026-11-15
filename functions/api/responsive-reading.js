// Read registered responsive-reading text only; no invented or third-party text.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function onRequestGet({request,env}){
 const n=new URL(request.url).searchParams.get('number');
 if(!/^([1-9][0-9]{0,2})$/.test(n||'')||Number(n)>200)return reply({error:'invalid_number'},400);
 if(!env.DB)return reply({error:'database_unavailable'},503);
 try{const row=await env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('responsive-reading-'+Number(n)).first();
 return reply({number:Number(n),text:row?.body||''});
 }catch{return reply({error:'database_error'},500)}
}
