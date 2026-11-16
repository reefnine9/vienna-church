import {reply,authenticated} from '../../_lib/auth.js';
export async function onRequestGet({env,request}){
 if(!await authenticated(request,env))return reply({error:'unauthorized'},401);
 const options=new Set();const driveFiles={};
 try{
  const rows=await env.DB.prepare("SELECT DISTINCT value FROM annual_schedule WHERE slot='choir_pdf_url' AND value<>'' ORDER BY value LIMIT 250").all();
  for(const r of rows.results||[])options.add(r.value);
 }catch{}
 if(env.SCORES)try{
  let cursor;
  do{
   const result=await env.SCORES.list({prefix:'choir/',limit:500,...(cursor?{cursor}:{})});
   for(const obj of result.objects||[])if(obj.key.endsWith('.pdf'))options.add('/api/scores/'+obj.key);
   cursor=result.truncated?result.cursor:null;
  }while(cursor&&options.size<1000);
 }catch{}
 try{
  const response=await fetch('https://api.github.com/repos/reefnine9/vienna-church/git/trees/main?recursive=1',{headers:{'user-agent':'vienna-church-score-list','accept':'application/vnd.github+json'}});
  if(response.ok){
   const tree=await response.json();
   for(const f of tree.tree||[])if(f.type==='blob'&&/^public\/scores\/.*\.pdf$/i.test(f.path))options.add('/'+f.path.slice(7));
  }
 }catch{}
 if(env.GOOGLE_DRIVE_API_KEY){
  try{
   const query="'1nqzbzyvLv-_qW4CGmAKZJpxU3mxYk6ep' in parents and mimeType = 'application/pdf' and trashed = false";
   const u='https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q:query,fields:'nextPageToken,files(id,name,mimeType)',pageSize:'1000',key:env.GOOGLE_DRIVE_API_KEY});
   const res=await fetch(u);
   if(res.ok){const data=await res.json();for(const f of data.files||[]){const url='/api/scores/drive/'+f.id+'.pdf';options.add(url);driveFiles[url]=f.name}}
  }catch{}
 }
 return reply({options:[...options].sort().reverse(),driveConfigured:!!env.GOOGLE_DRIVE_API_KEY,driveFiles});
}
