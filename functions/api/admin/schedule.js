import {reply,sameOrigin} from '../../_lib/auth.js';
const slots=['opening_hymn','hymn','responsive_reading','offertory_hymn','prayer_leader','choir'];
const sunday=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s&&new Date(s+'T12:00:00Z').getUTCDay()===0;
export async function onRequestGet({request,env}){const year=Number(new URL(request.url).searchParams.get('year'));if(!Number.isInteger(year)||year<2020||year>2100)return reply({error:'invalid_year'},400);try{const result=await env.DB.prepare('SELECT sunday_date,slot,value FROM annual_schedule WHERE sunday_date>=? AND sunday_date<? ORDER BY sunday_date,slot').bind(year+'-01-01',(year+1)+'-01-01').all();return reply({year,entries:result.results||[]})}catch{return reply({error:'database_error'},500)}}
export async function onRequestPut({request,env}){if(!sameOrigin(request))return reply({error:'invalid_origin'},403);let body;try{body=await request.json()}catch{return reply({error:'invalid_json'},400)}const year=body?.year,entries=body?.entries;if(!Number.isInteger(year)||year<2020||year>2100||!Array.isArray(entries)||entries.length>330)return reply({error:'invalid_data'},400);const seen=new Set();for(const x of entries){if(!x||!sunday(x.date)||!x.date.startsWith(year+'-')||!slots.includes(x.slot)||typeof x.value!=='string'||x.value.length>300)return reply({error:'invalid_entry'},400);const k=x.date+'|'+x.slot;if(seen.has(k))return reply({error:'duplicate_entry'},400);seen.add(k)}try{
 const commands=[env.DB.prepare('DELETE FROM annual_schedule WHERE sunday_date>=? AND sunday_date<?').bind(year+'-01-01',(year+1)+'-01-01')];
 const byDate=new Map();
 for(const x of entries){if(!x.value.trim())continue;commands.push(env.DB.prepare('INSERT INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?)').bind(x.date+'-'+x.slot,x.date,x.slot,x.value.trim()));if(!byDate.has(x.date))byDate.set(x.date,{});byDate.get(x.date)[x.slot]=x.value.trim()}
 await env.DB.batch(commands);
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
