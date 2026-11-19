const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export const normalize=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').replace(/[–—~〜]/g,'-').replace(/：/g,':').trim();
export async function onRequestGet({request,env}){
 const reference=normalize(new URL(request.url).searchParams.get('reference'));
 if(!reference||reference.length>120)return reply({error:'invalid_reference'},400);
 if(!env.DB)return reply({error:'database_unavailable'},503);
 try{const row=await env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('scripture-krv-'+reference).first();return reply({reference,text:row?.body||'',translation:'개역개정',source:row?.body?'admin':'none'})}catch{return reply({error:'database_error'},500)}
}
