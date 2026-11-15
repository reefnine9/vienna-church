// Read registered responsive-reading text only; no invented or third-party text.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function onRequestGet({request,env}){
 const n=new URL(request.url).searchParams.get('number');
 if(!/^([1-9][0-9]{0,2})$/.test(n||'')||Number(n)>200)return reply({error:'invalid_number'},400);
 if(!env.DB)return reply({error:'database_unavailable'},503);
 try{const row=await env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('responsive-reading-'+Number(n)).first();
 if(row?.body)return reply({number:Number(n),text:row.body,source:'admin'});
  // Official 137-reading collection is loaded only after verified import.
  if(Number(n)<=137&&env.ASSETS){
   const asset=await env.ASSETS.fetch(new URL('/data/responsive-readings.json',request.url));
   if(asset.ok){const data=await asset.json();const item=data?.readings?.[String(Number(n))];if(item?.lines?.length)return reply({number:Number(n),title:item.title||'',text:item.lines.join('\\n'),source:'official-ppt'});}
  }
  return reply({number:Number(n),text:''});
 }catch{return reply({error:'database_error'},500)}
}
