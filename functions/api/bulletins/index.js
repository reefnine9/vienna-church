// Public read-only endpoint. Never return draft bulletins or expose D1 writes.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export async function onRequestGet({env,params}) {
 if(!env.DB)return json({error:'database_not_configured'},503);
 const date=Array.isArray(params.date)?params.date[0]:params.date;
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
  const news=(announcements.results||[]).map(a=>{try{const v=JSON.parse(a.body);return v&&typeof v==='object'?{...a,body:v.news||'',extras:v.extras||{}}:a}catch{return a}});const start=new Date(bulletin.sunday_date+'T12:00:00Z');const dates=Array.from({length:3},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+7*i);return d.toISOString().slice(0,10)});
  const schedule=await env.DB.prepare("SELECT sunday_date,slot,value FROM annual_schedule WHERE sunday_date>=? AND sunday_date<=?").bind(dates[0],dates[2]).all();
  const map={};for(const e of schedule.results||[]){const v=map[e.sunday_date]||(map[e.sunday_date]={});if(e.slot==='custom'){try{Object.assign(v,JSON.parse(e.value))}catch{}}else v[e.slot]=e.value}
  const original=news.find(a=>a.extras)?.extras||{};
  const rows=(original.servants||'').split('\\n').filter(Boolean).map(line=>line.split('|').map(x=>x.trim()));
  const labels=['인도','대표기도','봉헌'],slots=['service_leader','prayer_leader','offering_leader'];
  const roster=[['구분',...dates.map(d=>String(Number(d.slice(5,7)))+'/'+String(Number(d.slice(8,10))))]];
  labels.forEach((label,i)=>{const prior=rows.find(r=>r[0]===label)||[];roster.push([label,...dates.map((d,j)=>map[d]?.[slots[i]]??prior[j+1]??'')])});
  const hasRoster=(schedule.results||[]).some(e=>['service_leader','prayer_leader','offering_leader','custom'].includes(e.slot))||!!original.servants;
  if(hasRoster){const target=news.find(a=>a.extras);if(target)target.extras={...original,servants:roster.map(r=>r.join(' | ')).join('\\n')};else news.push({body:'',extras:{servants:roster.map(r=>r.join(' | ')).join('\\n')}})}
  return json({bulletin:{...bulletin,items:items.results||[],announcements:news}});
 }catch{return json({error:'database_query_failed'},500)}
}
