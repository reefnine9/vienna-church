import {reply,sameOrigin} from '../../_lib/auth.js';
const slots=['opening_hymn','hymn','responsive_reading','offertory_hymn','prayer_leader','choir','service_leader','offering_leader'];
const sunday=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s&&new Date(s+'T12:00:00Z').getUTCDay()===0;
async function migrateHistoricalBulletins(env,year){
  const existing=await env.DB.prepare('SELECT sunday_date,slot FROM annual_schedule WHERE sunday_date>=? AND sunday_date<?').bind(year+'-01-01',(year+1)+'-01-01').all();
  const occupied=new Set((existing.results||[]).map(r=>r.sunday_date+'|'+r.slot));
  const rows=await env.DB.prepare("SELECT b.sunday_date,w.title,w.detail,w.position FROM bulletins b JOIN worship_items w ON w.bulletin_id=b.id WHERE b.sunday_date>=? AND b.sunday_date<? ORDER BY b.sunday_date,w.position").bind(year+'-01-01',(year+1)+'-01-01').all();
  const commands=[],hymnCounts={};
  for(const r of rows.results||[]){
   if(!r.detail?.trim())continue;
   let slot=({'경배 찬송':'opening_hymn','교독':'responsive_reading','교독문':'responsive_reading','대표 기도':'prayer_leader','봉헌 찬송':'offertory_hymn'})[r.title];
   if(r.title==='찬송'){const n=(hymnCounts[r.sunday_date]||0)+1;hymnCounts[r.sunday_date]=n;slot=n===1?'hymn':n===2?'choir':null}
   if(!slot)continue;
   const key=r.sunday_date+'|'+slot;if(occupied.has(key))continue;
   occupied.add(key);
   commands.push(env.DB.prepare('INSERT OR IGNORE INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?)').bind(r.sunday_date+'-'+slot,r.sunday_date,slot,r.detail.trim().slice(0,300)));
  }
  if(commands.length)await env.DB.batch(commands);
  return commands.length;
}
export async function onRequestGet({request,env}){const year=Number(new URL(request.url).searchParams.get('year'));if(!Number.isInteger(year)||year<2020||year>2100)return reply({error:'invalid_year'},400);try{await migrateHistoricalBulletins(env,year);const result=await env.DB.prepare('SELECT sunday_date,slot,value FROM annual_schedule WHERE sunday_date>=? AND sunday_date<? ORDER BY sunday_date,slot').bind(year+'-01-01',(year+1)+'-01-01').all();const entries=[];for(const e of result.results||[]){if(e.slot==='custom'){try{const x=JSON.parse(e.value);for(const slot of ['service_leader','offering_leader'])if(x[slot])entries.push({sunday_date:e.sunday_date,slot,value:x[slot]})}catch{}}else entries.push(e)}return reply({year,entries})}catch{return reply({error:'database_error'},500)}}
export async function onRequestPut({request,env}){if(!sameOrigin(request))return reply({error:'invalid_origin'},403);let body;try{body=await request.json()}catch{return reply({error:'invalid_json'},400)}const year=body?.year,entries=body?.entries;if(!Number.isInteger(year)||year<2020||year>2100||!Array.isArray(entries)||entries.length>440)return reply({error:'invalid_data'},400);const seen=new Set();for(const x of entries){if(!x||!sunday(x.date)||!x.date.startsWith(year+'-')||!slots.includes(x.slot)||typeof x.value!=='string'||x.value.length>300)return reply({error:'invalid_entry'},400);const k=x.date+'|'+x.slot;if(seen.has(k))return reply({error:'duplicate_entry'},400);seen.add(k)}try{
 const commands=[env.DB.prepare('DELETE FROM annual_schedule WHERE sunday_date>=? AND sunday_date<?').bind(year+'-01-01',(year+1)+'-01-01')];
 const byDate=new Map();
 for(const x of entries){if(!x.value.trim())continue;if(!byDate.has(x.date))byDate.set(x.date,{});byDate.get(x.date)[x.slot]=x.value.trim();if(['service_leader','offering_leader'].includes(x.slot))continue;commands.push(env.DB.prepare('INSERT INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?)').bind(x.date+'-'+x.slot,x.date,x.slot,x.value.trim()))}for(const [date,v] of byDate){if(v.service_leader||v.offering_leader)commands.push(env.DB.prepare('INSERT INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?)').bind(date+'-custom',date,'custom',JSON.stringify({service_leader:v.service_leader||'',offering_leader:v.offering_leader||''})))}
 await env.DB.batch(commands);
 // Existing bulletins keep their content and publication status.
 // The annual_schedule table is read directly by both bulletin views.
 const template=[['경배와 찬양','다같이'],['조용한 기도','다같이 (인도자)'],['경배 찬송',''],['죄의 고백 / 용서의 말씀','인도자'],['교독',''],['대표 기도',''],['찬송',''],['성경 봉독',''],['찬송',''],['말씀',''],['신앙 고백','사도신경'],['봉헌 찬송','']];
 const mappings={2:'opening_hymn',4:'responsive_reading',5:'prayer_leader',6:'hymn',8:'choir',11:'offertory_hymn'};
 let created=0;
 for(const [date,values] of byDate){
  const id='bulletin-'+date;
  const insert=await env.DB.prepare("INSERT OR IGNORE INTO bulletins(id,sunday_date,service_time,sermon_title,scripture_reference,preacher,status) VALUES(?,?,'12:00','','','','draft')").bind(id,date).run();
  if(!insert.meta?.changes)continue;
  const items=template.map(([title,detail],i)=>env.DB.prepare('INSERT INTO worship_items(id,bulletin_id,position,title,detail,kind,standing) VALUES(?,?,?,?,?,?,?)').bind(id+'-'+i,id,i,title,values[mappings[i]]||detail,i===4?'reading':([2,6,8,11].includes(i)?'hymn':i===7?'scripture':'text'),0));
  await env.DB.batch(items);
  created++;
 }
 return reply({ok:true,saved:commands.length-1,created});
 }catch{return reply({error:'save_failed'},500)}}

