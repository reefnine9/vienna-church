import {reply} from '../../_lib/auth.js';
export async function onRequestGet({env}){
 try{
  const rows=await env.DB.prepare("SELECT DISTINCT value FROM annual_schedule WHERE slot='choir_pdf_url' AND value<>'' ORDER BY value LIMIT 250").all();
  return reply({options:(rows.results||[]).map(r=>r.value)})
 }catch{return reply({options:[]})}
}
