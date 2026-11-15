import {reply} from '../_lib/auth.js';
export async function onRequestGet({env}){
 try{const row=await env.DB.prepare("SELECT body FROM announcements WHERE id='praise-score-global-v1'").first();return reply({url:row?.body||''})}
 catch{return reply({url:''})}
}
