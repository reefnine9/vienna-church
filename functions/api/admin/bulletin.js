import { reviewBulletinNews } from '../../_lib/news-language-review.js';
import { readStoredNews } from '../../_lib/news-copy-edits.js';
import { issueBulletinReview, reply, sameOrigin, validBulletinReview } from '../../_lib/auth.js';
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s&&new Date(s+'T12:00:00Z').getUTCDay()===0;
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const idFor=d=>'bulletin-'+d;
const fail=(error,status=400)=>reply({error},status);
const reviewSnapshot = (data, extras, news, needsReview) => [
 data.date, data.time, data.sermon, data.scripture, data.preacher,
 data.rows.map(({ name, value, kind, standing }) => [name, value, kind, standing]),
 extras, news, needsReview,
];
const rosterDates=date=>Array.from({length:3},(_,i)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+7*i);return d.toISOString().slice(0,10)});
const shortDate=d=>Number(d.slice(5,7))+'/'+Number(d.slice(8,10));
const annualRowSlots={'경배 찬송':'opening_hymn','교독':'responsive_reading','교독문':'responsive_reading','대표 기도':'prayer_leader','봉헌 찬송':'offertory_hymn'};

function previousSundayFor(date) {
 const previous = new Date(date + 'T12:00:00Z');
 previous.setUTCDate(previous.getUTCDate() - 7);
 return previous.toISOString().slice(0, 10);
}

async function findReviewedNews(db, date) {
 const previousSunday = previousSundayFor(date);
 let rows;
 try {
  const result = await db.prepare('SELECT body FROM announcements WHERE id IN (?, ?)')
   .bind('weekly-' + date, 'weekly-' + previousSunday).all();
  rows = result.results ?? [];
 } catch {
  // A failed lookup should still let the current news go through a full review.
  return [];
 }
 const reviewed = [];
 for (const row of rows) {
  try {
   const stored = JSON.parse(row.body);
   if (typeof stored?.news === 'string' && (stored.newsConfirmed === true || stored.newsReviewed === true)) {
    reviewed.push(stored.news);
   }
  } catch {
   // Some older bulletin announcements are stored as plain text.
  }
 }
 return reviewed;
}

async function annualValues(env,date){const r=await env.DB.prepare("SELECT slot,value FROM annual_schedule WHERE sunday_date=?").bind(date).all();return Object.fromEntries((r.results||[]).filter(x=>x.slot!=='custom').map(x=>[x.slot,x.value]))}
function rowSlot(row,i,rows){if(annualRowSlots[row.name])return annualRowSlots[row.name];if(row.name==='찬송'){const hymns=rows.slice(0,i+1).filter(r=>r.name==='찬송').length;return hymns===1?'hymn':hymns===2?'choir':null}return null}
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

async function previousWeekNews(db, date) {
 const previousSunday = previousSundayFor(date);
 const announcement = await db.prepare('SELECT body FROM announcements WHERE id=?').bind('weekly-' + previousSunday).first();
 return readStoredNews(previousSunday, announcement?.body ?? '');
}

export async function onRequestGet({ env, request }) {
 const date = new URL(request.url).searchParams.get('date');
 if (!validDate(date)) return fail('invalid_sunday');
 try {
  const bulletin = await env.DB.prepare('SELECT * FROM bulletins WHERE sunday_date=?').bind(date).first();
  if (!bulletin) {
   const [roster, annual, previousNews] = await Promise.all([
    annualRoster(env, date), annualValues(env, date), previousWeekNews(env.DB, date),
   ]);
   return reply({ bulletin: null, annualServants: roster.servants, annualChoirPdfUrl: annual.choir_pdf_url || '', previousNews });
  }

  const [rows, announcement] = await Promise.all([
   env.DB.prepare('SELECT title,detail,kind,standing FROM worship_items WHERE bulletin_id=? ORDER BY position').bind(bulletin.id).all(),
   env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('weekly-' + date).first(),
  ]);
  const extras = (() => {
   try { return JSON.parse(announcement?.body || '').extras || {}; } catch { return {}; }
  })();
  const annual = await annualValues(env, date);
  const choirOverride = await env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('choir-score-weekly-' + date).first();
  const editorRows = (rows.results || []).map(row => ({ name: row.title, value: row.detail, kind: row.kind, standing: !!row.standing }));
  editorRows.forEach((row, index) => {
   const slot = rowSlot(row, index, editorRows);
   if (slot && Object.hasOwn(annual, slot)) row.value = annual[slot];
  });
  extras.choirPdfUrl = choirOverride ? choirOverride.body : (annual.choir_pdf_url || extras.choirPdfUrl || '');
  extras.servants = (await annualRoster(env, date, extras.servants || '')).servants;
  const news = announcement ? readStoredNews(date, announcement.body) : await previousWeekNews(env.DB, date);
  return reply({ bulletin: {
   date: bulletin.sunday_date, time: bulletin.service_time, sermon: bulletin.sermon_title,
   scripture: bulletin.scripture_reference, preacher: bulletin.preacher, rows: editorRows,
   news, extras, status: bulletin.status,
  } });
 } catch {
  return fail('database_error', 500);
 }
}
export async function onRequestPut({env,request}){if(!sameOrigin(request))return fail('invalid_origin',403);let data;try{data=await request.json()}catch{return fail('invalid_json')};if(!validDate(data?.date))return fail('invalid_sunday');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time))return fail('invalid_time');if(!Array.isArray(data.rows)||data.rows.length<1||data.rows.length>60)return fail('invalid_rows');if(data.rows.some(r=>!r||typeof r.name!=='string'||!r.name.trim()||r.name.length>120||typeof r.value!=='string'||r.value.length>500||!['text','hymn','reading','scripture'].includes(r.kind)||typeof r.standing!=='boolean'))return fail('invalid_row');if([data.sermon,data.scripture,data.preacher,data.news].some(v=>typeof v!=='string')||data.sermon.length>500||data.scripture.length>250||data.preacher.length>250||data.news.length>10000)return fail('invalid_fields');const extras=data.extras&&typeof data.extras==='object'?Object.fromEntries(['sendingSong','closingPrayer','servants','intercession','worshipPdfUrl','choirPdfUrl'].map(k=>[k,clean(data.extras[k],6000)])):{ };for(const url of [extras.worshipPdfUrl,extras.choirPdfUrl].filter(Boolean)){const safe=/^\/api\/scores\/google\/[A-Za-z0-9_-]+\.pdf$/.test(url)||/^\/api\/scores\/drive\/[A-Za-z0-9_-]+\.pdf$/.test(url)||/^\/api\/scores\/choir\/[a-zA-Z0-9._-]+\.pdf$/.test(url)||/^\/scores\/[a-zA-Z0-9_./%-]+\.pdf(?:\?[a-zA-Z0-9_=&%-]+)?$/i.test(url)||/^https:\/\/[^\s<>"']+\.pdf(?:\?[^\s<>"']*)?$/i.test(url);if(!safe)return fail('invalid_score_pdf_url');}const date=data.date,id=idFor(date);
 const preview = data.action === 'preview';
 const status = data.action === 'publish' ? 'published' : data.action === 'draft' ? 'draft' : null;
 if (!preview && !status) return fail('invalid_action');
 try {
 let news = data.news;
 let needsReview = data.newsNeedsReview === true;
 if (status === 'published') {
  const snapshot = reviewSnapshot(data, extras, news, needsReview);
  if (!await validBulletinReview(request, env, snapshot, data.reviewToken)) {
   return fail('게시 전에 교회 소식의 교정 내용을 다시 확인해 주세요.', 409);
  }
  if (data.confirmedNews !== undefined) {
   if (typeof data.confirmedNews !== 'string' || data.confirmedNews.length > 10000) {
    return fail('교회 소식은 10,000자 이내로 입력해 주세요.');
   }
   news = data.confirmedNews;
  }
 } else {
  if (!preview) {
   const existing = await env.DB.prepare('SELECT status FROM bulletins WHERE sunday_date=?').bind(date).first();
   if (existing?.status === 'published') return fail('published_cannot_be_draft',409);
  }
  const reviewedNews = data.news.trim() ? await findReviewedNews(env.DB, date) : [];
  let review;
  try {
   review = await reviewBulletinNews(date, data.news, env.NEWS_AI, reviewedNews, !preview);
  } catch {
   return fail('교회 소식의 문장 교정에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
  }
  news = review.news;
  needsReview = review.needsReview;
  if (news.length > 10000) return fail('교정한 교회 소식이 10,000자를 넘습니다. 내용을 줄여 주세요.');
  if (preview) {
   const snapshot = reviewSnapshot(data, extras, news, needsReview);
   const reviewToken = await issueBulletinReview(request, env, snapshot);
   return reply({ ok: true, news, newsNeedsReview: needsReview, reviewToken });
  }
 }
 const statements=[env.DB.prepare("INSERT INTO bulletins(id,sunday_date,service_time,sermon_title,scripture_reference,preacher,status,published_at) VALUES(?,?,?,?,?,?,?,CASE WHEN ?='published' THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(sunday_date) DO UPDATE SET service_time=excluded.service_time,sermon_title=excluded.sermon_title,scripture_reference=excluded.scripture_reference,preacher=excluded.preacher,status=excluded.status,published_at=CASE WHEN excluded.status='published' THEN COALESCE(bulletins.published_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP").bind(id,date,data.time,data.sermon,data.scripture,data.preacher,status,status),env.DB.prepare('DELETE FROM worship_items WHERE bulletin_id=?').bind(id)];data.rows.forEach((r,i)=>statements.push(env.DB.prepare('INSERT INTO worship_items(id,bulletin_id,position,title,detail,kind,standing) VALUES(?,?,?,?,?,?,?)').bind(id+'-'+i,id,i,clean(r.name,120),clean(r.value,500),r.kind,r.standing?1:0)));
 const storedAnnouncement = JSON.stringify({ news, extras, newsConfirmed: status === 'published', newsReviewed: status === 'draft' && !needsReview });
 statements.push(env.DB.prepare("INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES(?,?,?,?,?,0,1) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind('weekly-'+date,'이번 주 교회 소식',storedAnnouncement,date,date));
 // Keep the weekly choir score synchronized with the annual schedule.
 statements.push(env.DB.prepare("INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES(?,?,?, ?,?,0,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind('choir-score-weekly-'+date,'찬양대 악보 PDF',extras.choirPdfUrl,date,date));
 // Write annual-plan fields from the same worship rows edited in the bulletin.
 const annualFields=new Map();
 data.rows.forEach((r,i)=>{const slot=rowSlot(r,i,data.rows);if(slot&&slot!=='prayer_leader')annualFields.set(slot,r.value.trim())});
 for(const [slot,value] of annualFields){
  if(value)statements.push(env.DB.prepare("INSERT INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?) ON CONFLICT(sunday_date,slot) DO UPDATE SET value=excluded.value").bind(date+'-'+slot,date,slot,value));
  else statements.push(env.DB.prepare("DELETE FROM annual_schedule WHERE sunday_date=? AND slot=?").bind(date,slot));
 }
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
 return reply({ok:true,status,date,news,newsNeedsReview:needsReview})}catch{return fail('save_failed',500)}}
