import {reply,authenticated} from '../../_lib/auth.js';
export async function onRequestGet({request,env}){
 if(!await authenticated(request,env))return reply({error:'unauthorized'},401);
 try{
  const rows=await env.DB.prepare('SELECT book,chapter,MAX(verse) AS maxVerse FROM bible_verses GROUP BY book,chapter ORDER BY book,chapter').all();
  return reply({chapters:rows.results||[]});
 }catch{return reply({chapters:[],ready:false})}
}
