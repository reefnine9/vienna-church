// Public read-only endpoint. Never return draft bulletins or expose D1 writes.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export async function onRequestGet({env,params}) {
 if(!env.DB)return json({error:'database_not_configured'},503);
 const date=params.date;
 if(date&&!validDate(date))return json({error:'invalid_date'},400);
 try{
  let bulletin;
  if(date)bulletin=await env.DB.prepare("SELECT id,sunday_date,service_time,sermon_title,scripture_reference,preacher FROM bulletins WHERE sunday_date=? AND status='published'").bind(date).first();
  else bulletin=await env.DB.prepare("SELECT id,sunday_date,service_time,sermon_title,scripture_reference,preacher FROM bulletins WHERE status='published' ORDER BY sunday_date DESC LIMIT 1").first();
  if(!bulletin)return json({bulletin:null});
  const [items,announcements]=await Promise.all([
   env.DB.prepare('SELECT position,title,detail,kind,standing FROM worship_items WHERE bulletin_id=? ORDER BY position').bind(bulletin.id).all(),
   env.DB.prepare('SELECT title,body FROM announcements WHERE active=1 AND starts_on<=? AND ends_on>=? ORDER BY position').bind(bulletin.sunday_date,bulletin.sunday_date).all()
  ]);
  return json({bulletin:{...bulletin,items:items.results||[],announcements:announcements.results||[]}});
 }catch{return json({error:'database_query_failed'},500)}
}
