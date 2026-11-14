import {reply,sameOrigin} from '../../_lib/auth.js';
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s&&new Date(s+'T12:00:00Z').getUTCDay()===0;
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const idFor=d=>'bulletin-'+d;
const fail=(error,status=400)=>reply({error},status);
const rosterDates=date=>Array.from({length:3},(_,i)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+7*i);return d.toISOString().slice(0,10)});
const shortDate=d=>Number(d.slice(5,7))+'/'+Number(d.slice(8,10));
async function annualRoster(env,date,stored=''){
 const dates=rosterDates(date);
 const result=await env.DB.prepare('SELECT sunday_date,slot,value FROM annual_schedule WHERE sunday_date>=? AND sunday_date<=?').bind(dates[0],dates[2]).all();
 const map={};for(const r of result.results||[]){const m=map[r.sunday_date]||(map[r.sunday_date]={});if(r.slot==='custom'){try{Object.assign(m,JSON.parse(r.value))}catch{}}else m[r.slot]=r.value}
 const old=stored.split('\n').filter(Boolean).map(line=>line.split('|').map(x=>x.trim()));
 const labels=['인도','대표기도','봉헌'],slots=['service_leader','prayer_leader','offering_leader'];
 const rows=[['구분',...dates.map(shortDate)]];
 labels.forEach((label,i)=>{const previous=old.find(r=>r[0]===label)||[];rows.push([label,...dates.map((d,j)=>map[d]?.[slots[i]]??'')])});
 return {servants:rows.map(row=>row.join(' | ')).join('\n'),dates};
}

export async function onRequestGet({env,request}){const date=new URL(request.url).searchParams.get('date');if(!validDate(date))return fail('invalid_sunday');try{const b=await env.DB.prepare('SELECT * FROM bulletins WHERE sunday_date=?').bind(date).first();if(!b){const roster=await annualRoster(env,date);return reply({bulletin:null,annualServants:roster.servants})}const [rows,ann]=await Promise.all([env.DB.prepare('SELECT title,detail,kind,standing FROM worship_items WHERE bulletin_id=? ORDER BY position').bind(b.id).all(),env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('weekly-'+date).first()]);const extras=(()=>{try{return JSON.parse(ann?.body||'').extras||{}}catch{return {}}})();extras.servants=(await annualRoster(env,date,extras.servants||'')).servants;return reply({bulletin:{date:b.sunday_date,time:b.service_time,sermon:b.sermon_title,scripture:b.scripture_reference,preacher:b.preacher,rows:(rows.results||[]).map(r=>({name:r.title,value:r.detail,kind:r.kind,standing:!!r.standing})),news:(()=>{try{const v=JSON.parse(ann?.body||'');return v&&typeof v==='object'?v.news||'':ann?.body||''}catch{return ann?.body||''}})(),extras,status:b.status}})}catch{return fail('database_error',500)}}
export async function onRequestPut({env,request}){if(!sameOrigin(request))return fail('invalid_origin',403);let data;try{data=await request.json()}catch{return fail('invalid_json')};if(!validDate(data?.date))return fail('invalid_sunday');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time))return fail('invalid_time');if(!Array.isArray(data.rows)||data.rows.length<1||data.rows.length>60)return fail('invalid_rows');if(data.rows.some(r=>!r||typeof r.name!=='string'||!r.name.trim()||r.name.length>120||typeof r.value!=='string'||r.value.length>500||!['text','hymn','reading','scripture'].includes(r.kind)||typeof r.standing!=='boolean'))return fail('invalid_row');if([data.sermon,data.scripture,data.preacher,data.news].some(v=>typeof v!=='string')||data.sermon.length>500||data.scripture.length>250||data.preacher.length>250||data.news.length>10000)return fail('invalid_fields');const extras=data.extras&&typeof data.extras==='object'?Object.fromEntries(['sendingSong','closingPrayer','servants','intercession'].map(k=>[k,clean(data.extras[k],6000)])):{ };const date=data.date,id=idFor(date),status=data.action==='publish'?'published':data.action==='draft'?'draft':null;if(!status)return fail('invalid_action');try{const existing=await env.DB.prepare('SELECT status FROM bulletins WHERE sunday_date=?').bind(date).first();if(existing?.status==='published'&&status==='draft')return fail('published_cannot_be_draft',409);const statements=[env.DB.prepare("INSERT INTO bulletins(id,sunday_date,service_time,sermon_title,scripture_reference,preacher,status,published_at) VALUES(?,?,?,?,?,?,?,CASE WHEN ?='published' THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(sunday_date) DO UPDATE SET service_time=excluded.service_time,sermon_title=excluded.sermon_title,scripture_reference=excluded.scripture_reference,preacher=excluded.preacher,status=excluded.status,published_at=CASE WHEN excluded.status='published' THEN COALESCE(bulletins.published_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP").bind(id,date,data.time,data.sermon,data.scripture,data.preacher,status,status),env.DB.prepare('DELETE FROM worship_items WHERE bulletin_id=?').bind(id)];data.rows.forEach((r,i)=>statements.push(env.DB.prepare('INSERT INTO worship_items(id,bulletin_id,position,title,detail,kind,standing) VALUES(?,?,?,?,?,?,?)').bind(id+'-'+i,id,i,clean(r.name,120),clean(r.value,500),r.kind,r.standing?1:0)));statements.push(env.DB.prepare("INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES(?,?,?,?,?,0,1) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind('weekly-'+date,'이번 주 교회 소식',JSON.stringify({news:data.news,extras}),date,date));
 // Commit bulletin and annual-plan changes together in one D1 transaction.
 const dates=rosterDates(date);
 const roster=(extras.servants||'').split('\n').filter(Boolean).map(line=>line.split('|').map(x=>x.trim()));
 const header=roster[0]||[];
 const fields=[['인도','service_leader'],['대표기도','prayer_leader'],['봉헌','offering_leader']];
 for(const target of dates){
  const column=header.findIndex((v,i)=>i>0&&v===shortDate(target));
  if(column<1)continue;
  const current=await env.DB.prepare("SELECT value FROM annual_schedule WHERE sunday_date=? AND slot='custom'").bind(target).first();
  let custom={};try{custom=JSON.parse(current?.value||'{}')}catch{}
  for(const [label,slot] of fields){
   const row=roster.find(r=>r[0]===label);
   if(!row)continue;
   const value=(row[column]||'').trim();
   if(slot==='prayer_leader'){
    if(value)statements.push(env.DB.prepare("INSERT INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?) ON CONFLICT(sunday_date,slot) DO UPDATE SET value=excluded.value").bind(target+'-'+slot,target,slot,value));
    else statements.push(env.DB.prepare("DELETE FROM annual_schedule WHERE sunday_date=? AND slot=?").bind(target,slot));
   }else custom[slot]=value;
  }
  if(custom.service_leader||custom.offering_leader)statements.push(env.DB.prepare("INSERT INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?) ON CONFLICT(sunday_date,slot) DO UPDATE SET value=excluded.value").bind(target+'-custom',target,'custom',JSON.stringify(custom)));
  else statements.push(env.DB.prepare("DELETE FROM annual_schedule WHERE sunday_date=? AND slot='custom'").bind(target));
 }
 await env.DB.batch(statements);
 return reply({ok:true,status,date})}catch{return fail('save_failed',500)}}
