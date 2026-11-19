import {reply,authenticated,sameOrigin} from '../../_lib/auth.js';
const books='창 출 레 민 신 수 삿 룻 삼상 삼하 왕상 왕하 대상 대하 스 느 에 욥 시 잠 전 아 사 렘 애 겔 단 호 욜 암 옵 욘 미 나 합 습 학 슥 말 마 막 눅 요 행 롬 고전 고후 갈 엡 빌 골 살전 살후 딤전 딤후 딛 몬 히 약 벧전 벧후 요일 요이 요삼 유 계'.split(' ');
export async function onRequestGet({request,env}){
 if(!await authenticated(request,env))return reply({error:'unauthorized'},401);
 try{const t=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bible_verses'").first();if(!t)return reply({count:0,ready:false});const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM bible_verses').first();return reply({count:row?.count||0,ready:true})}catch{return reply({error:'database_error'},500)}
}
export async function onRequestPost({request,env}){
 if(!await authenticated(request,env))return reply({error:'unauthorized'},401);
 if(!sameOrigin(request))return reply({error:'invalid_origin'},403);
 let body;try{body=await request.json()}catch{return reply({error:'invalid_json'},400)}
 const verses=body?.verses;
 if(!Array.isArray(verses)||!verses.length||verses.length>80)return reply({error:'invalid_batch'},400);
 const seen=new Set();
 for(const v of verses){
  if(!v||!books.includes(v.book)||!Number.isInteger(v.chapter)||v.chapter<1||v.chapter>150||!Number.isInteger(v.verse)||v.verse<1||v.verse>200||typeof v.text!=='string'||!v.text.trim()||v.text.length>2000)return reply({error:'invalid_verse'},400);
  const key=v.book+':'+v.chapter+':'+v.verse;if(seen.has(key))return reply({error:'duplicate_verse_in_batch'},400);seen.add(key);
 }
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS bible_verses (book TEXT NOT NULL,chapter INTEGER NOT NULL,verse INTEGER NOT NULL,text TEXT NOT NULL,PRIMARY KEY(book,chapter,verse))').run();
  const stmts=verses.map(v=>env.DB.prepare('INSERT INTO bible_verses(book,chapter,verse,text) VALUES(?,?,?,?) ON CONFLICT(book,chapter,verse) DO UPDATE SET text=excluded.text').bind(v.book,v.chapter,v.verse,v.text.trim()));
  await env.DB.batch(stmts);
  return reply({ok:true,saved:verses.length});
 }catch{return reply({error:'database_error'},500)}
}
